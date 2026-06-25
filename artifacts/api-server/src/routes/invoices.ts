import { Router, IRouter } from "express";
import { db, invoicesTable, invoiceItemsTable, companySettingsTable, productsTable, stockMovementsTable } from "@workspace/db";
import { eq, and, gte, sql, isNotNull } from "drizzle-orm";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middlewares/auth";
import { serializeDates } from "../lib/serialize";
import { recordAuditLog } from "../lib/audit";
import { z } from "zod";
import PDFDocument from "pdfkit";

const router: IRouter = Router();

const InvoiceItemInput = z.object({
  productId: z.number().int().positive().optional(),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
});

const CreateInvoiceBody = z.object({
  clientName: z.string().min(1),
  clientPhone: z.string().optional(),
  clientEmail: z.string().optional(),
  clientAddress: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["draft", "unpaid", "paid"]).optional().default("draft"),
  notes: z.string().optional(),
  taxRate: z.number().min(0).max(100).optional().default(0),
  items: z.array(InvoiceItemInput).min(1),
});

async function getNextInvoiceNumber(client: Pick<typeof db, "select">): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `FAC-${year}-`;
  const [last] = await client
    .select({ n: invoicesTable.invoiceNumber })
    .from(invoicesTable)
    .where(sql`${invoicesTable.invoiceNumber} LIKE ${prefix + "%"}`)
    .orderBy(sql`${invoicesTable.invoiceNumber} DESC`)
    .limit(1);
  if (!last) return `${prefix}0001`;
  const seq = parseInt(last.n.slice(prefix.length), 10) || 0;
  return `${prefix}${String(seq + 1).padStart(4, "0")}`;
}

async function getInvoiceWithItems(id: number) {
  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
  if (!invoice) return null;
  const items = await db
    .select({
      id: invoiceItemsTable.id,
      invoiceId: invoiceItemsTable.invoiceId,
      productId: invoiceItemsTable.productId,
      description: invoiceItemsTable.description,
      quantity: invoiceItemsTable.quantity,
      unitPrice: invoiceItemsTable.unitPrice,
      totalPrice: invoiceItemsTable.totalPrice,
      position: invoiceItemsTable.position,
    })
    .from(invoiceItemsTable)
    .where(eq(invoiceItemsTable.invoiceId, id))
    .orderBy(invoiceItemsTable.position);
  return { ...serializeDates(invoice), items: serializeDates(items) };
}

router.get("/invoices", requireAuth, requireRole("admin", "manager"), async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(invoicesTable)
    .orderBy(sql`${invoicesTable.createdAt} DESC`);
  res.json(serializeDates(rows));
});

router.post("/invoices", requireAuth, requireRole("admin", "manager"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateInvoiceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { items, taxRate = 0, status = "draft", ...invoiceData } = parsed.data;
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const taxAmount = Math.round(subtotal * taxRate) / 100;
  const total = subtotal + taxAmount;

  const result = await db.transaction(async (tx) => {
    const invoiceNumber = await getNextInvoiceNumber(tx);
    const [invoice] = await tx.insert(invoicesTable).values({
      invoiceNumber,
      ...invoiceData,
      status,
      taxRate,
      subtotal,
      taxAmount,
      total,
      createdById: req.user!.id,
    }).returning();

    await tx.insert(invoiceItemsTable).values(
      items.map((item, i) => ({
        invoiceId: invoice.id,
        productId: item.productId ?? null,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.quantity * item.unitPrice,
        position: i,
      }))
    );

    if (status === "paid") {
      for (const item of items) {
        if (!item.productId) continue;
        const qty = Math.round(item.quantity);
        const [updated] = await tx.update(productsTable)
          .set({ quantityInStock: sql`${productsTable.quantityInStock} - ${qty}` })
          .where(and(eq(productsTable.id, item.productId), gte(productsTable.quantityInStock, qty)))
          .returning();
        if (!updated) return { error: `Stock insuffisant pour l'article "${item.description}"` };
        await tx.insert(stockMovementsTable).values({
          productId: item.productId,
          type: "OUT",
          quantity: qty,
          reason: `Facture ${invoiceNumber}`,
          createdById: req.user!.id,
        });
      }
    }

    return { invoice };
  });

  if ("error" in result) { res.status(400).json({ error: result.error }); return; }
  const full = await getInvoiceWithItems(result.invoice.id);
  void recordAuditLog({ action: "create", entityType: "invoice", entityId: result.invoice.id, user: req.user, newValue: { invoiceNumber: result.invoice.invoiceNumber, clientName: result.invoice.clientName, total: result.invoice.total, status: result.invoice.status } });
  res.status(201).json(full);
});

router.get("/invoices/:id", requireAuth, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!id) { res.status(400).json({ error: "ID invalide" }); return; }
  const data = await getInvoiceWithItems(id);
  if (!data) { res.status(404).json({ error: "Facture introuvable" }); return; }
  res.json(data);
});

router.patch("/invoices/:id/status", requireAuth, requireRole("admin", "manager"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!id) { res.status(400).json({ error: "ID invalide" }); return; }

  const bodyParsed = z.object({ status: z.enum(["draft", "unpaid", "paid"]) }).safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  const { status } = bodyParsed.data;

  const result = await db.transaction(async (tx) => {
    const [invoice] = await tx.select().from(invoicesTable).where(eq(invoicesTable.id, id));
    if (!invoice) return { error: "Facture introuvable" };

    if (status === "paid" && invoice.status !== "paid") {
      const items = await tx.select().from(invoiceItemsTable)
        .where(and(eq(invoiceItemsTable.invoiceId, id), isNotNull(invoiceItemsTable.productId)));

      for (const item of items) {
        if (!item.productId) continue;
        const qty = Math.round(item.quantity);
        const [updated] = await tx.update(productsTable)
          .set({ quantityInStock: sql`${productsTable.quantityInStock} - ${qty}` })
          .where(and(eq(productsTable.id, item.productId), gte(productsTable.quantityInStock, qty)))
          .returning();
        if (!updated) {
          const [prod] = await tx.select({ name: productsTable.name }).from(productsTable).where(eq(productsTable.id, item.productId));
          return { error: `Stock insuffisant pour ${prod?.name ?? "ce produit"}` };
        }
        await tx.insert(stockMovementsTable).values({
          productId: item.productId,
          type: "OUT",
          quantity: qty,
          reason: `Facture ${invoice.invoiceNumber}`,
          createdById: req.user!.id,
        });
      }
    }

    if (invoice.status === "paid" && status !== "paid") {
      const outMovements = await tx
        .select()
        .from(stockMovementsTable)
        .where(and(
          eq(stockMovementsTable.reason, `Facture ${invoice.invoiceNumber}`),
          eq(stockMovementsTable.type, "OUT"),
        ));

      for (const mov of outMovements) {
        if (!mov.productId) continue;
        await tx.update(productsTable)
          .set({ quantityInStock: sql`${productsTable.quantityInStock} + ${mov.quantity}` })
          .where(eq(productsTable.id, mov.productId));
        await tx.insert(stockMovementsTable).values({
          productId: mov.productId,
          type: "IN",
          quantity: mov.quantity,
          reason: `Annulation facture ${invoice.invoiceNumber}`,
          createdById: req.user!.id,
        });
      }
    }

    const [updated] = await tx.update(invoicesTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(invoicesTable.id, id))
      .returning();
    return { invoice: updated };
  });

  if ("error" in result) { res.status(400).json({ error: result.error }); return; }
  void recordAuditLog({ action: "update_status", entityType: "invoice", entityId: id, user: req.user, newValue: { status: result.invoice.status, invoiceNumber: result.invoice.invoiceNumber } });
  res.json(serializeDates(result.invoice));
});

router.get("/invoices/:id/pdf", requireAuth, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!id) { res.status(400).json({ error: "ID invalide" }); return; }
  const data = await getInvoiceWithItems(id);
  if (!data) { res.status(404).json({ error: "Facture introuvable" }); return; }

  let [company] = await db.select().from(companySettingsTable).limit(1);
  if (!company) company = { id: 0, name: "Mon Entreprise", currency: "EUR", logoUrl: null, address: null, phone: null, email: null, taxNumber: null, signatureText: null, updatedAt: new Date() };

  const currencySymbol = company.currency === "EUR" ? "€" : company.currency === "USD" ? "$" : company.currency;
  const fmt = (n: number) => `${n.toFixed(2)} ${currencySymbol}`;

  const statusLabel: Record<string, string> = { draft: "Brouillon", unpaid: "Non payée", paid: "Payée" };

  const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="facture-${data.invoiceNumber}.pdf"`);
  doc.pipe(res);

  const W = 495;
  const ORANGE = "#ea580c";
  const DARK = "#1c1917";
  const GRAY = "#78716c";
  const LIGHT_BG = "#f5f5f4";
  const PAGE_BOTTOM = 750;

  // Helper pour ajouter une nouvelle page
  function addNewPage() {
    doc.addPage();
    return 50;
  }

  // Helper pour vérifier et ajouter une page si nécessaire
  function checkPageSpace(currentY: number, neededSpace: number): number {
    if (currentY + neededSpace > PAGE_BOTTOM) {
      return addNewPage();
    }
    return currentY;
  }

  // ---- Header background band ----
  doc.rect(50, 50, W, 90).fill(DARK);

  // Load and display logo if URL exists
  if (company.logoUrl) {
    try {
      const logoResponse = await fetch(company.logoUrl);
      if (logoResponse.ok) {
        const logoBuffer = Buffer.from(await logoResponse.arrayBuffer());
        doc.image(logoBuffer, 65, 55, { width: 80, height: 80 });
      }
    } catch (err) {
      // Silently fail if logo cannot be loaded
    }
  }

  // Company name (offset if logo exists)
  const nameX = company.logoUrl ? 160 : 65;
  doc.fillColor("white").fontSize(22).font("Helvetica-Bold")
    .text(company.name, nameX, 65, { width: 300 - (company.logoUrl ? 95 : 0) });

  // Company details (right side of header)
  doc.fontSize(8).font("Helvetica").fillColor("#d6d3d1");
  let hY = 68;
  if (company.address) { doc.text(company.address, 350, hY, { width: 180, align: "right" }); hY += 11; }
  if (company.phone) { doc.text(company.phone, 350, hY, { width: 180, align: "right" }); hY += 11; }
  if (company.email) { doc.text(company.email, 350, hY, { width: 180, align: "right" }); hY += 11; }
  if (company.taxNumber) { doc.text(`N° TVA: ${company.taxNumber}`, 350, hY, { width: 180, align: "right" }); }

  // ---- Invoice title strip ----
  doc.rect(50, 140, W, 28).fill(ORANGE);
  doc.fillColor("white").fontSize(13).font("Helvetica-Bold")
    .text("FACTURE", 65, 147);
  doc.fontSize(11).font("Helvetica")
    .text(`N° ${data.invoiceNumber}`, 65, 148, { align: "right", width: W - 30 });

  // ---- Invoice meta ----
  let y = 182;
  doc.fillColor(DARK).fontSize(9).font("Helvetica-Bold").text("DATE", 65, y);
  doc.font("Helvetica").fillColor(GRAY).text(new Date(data.date + "T00:00:00Z").toLocaleDateString("fr-FR"), 65, y + 12);

  doc.fillColor(DARK).font("Helvetica-Bold").text("STATUT", 200, y);
  const sLabel = statusLabel[data.status] ?? data.status;
  const sColor = data.status === "paid" ? "#16a34a" : data.status === "unpaid" ? "#dc2626" : GRAY;
  doc.font("Helvetica").fillColor(sColor).text(sLabel, 200, y + 12);

  // ---- Client block ----
  y = checkPageSpace(y + 10, 100);
  doc.rect(50, y, W, 80).fill(LIGHT_BG);
  doc.fillColor(DARK).font("Helvetica-Bold").fontSize(9).text("FACTURER À", 65, y + 8);
  doc.font("Helvetica-Bold").fontSize(11).fillColor(DARK).text(data.clientName, 65, y + 21);
  doc.font("Helvetica").fontSize(8).fillColor(GRAY);
  let cY = y + 35;
  if (data.clientAddress) { doc.text(data.clientAddress, 65, cY); cY += 11; }
  if (data.clientPhone) { doc.text(data.clientPhone, 65, cY); cY += 11; }
  if (data.clientEmail) { doc.text(data.clientEmail, 65, cY); }

  // ---- Items table ----
  y = checkPageSpace(cY + 15, 50);
  const colDesc = 65, colQty = 330, colPrix = 390, colTotal = 460;
  const MAX_ITEMS_PER_PAGE = 20;

  // Table header
  doc.rect(50, y, W, 22).fill(DARK);
  doc.fillColor("white").font("Helvetica-Bold").fontSize(8.5)
    .text("DESCRIPTION", colDesc, y + 7)
    .text("QTÉ", colQty, y + 7)
    .text("PRIX UNIT.", colPrix, y + 7)
    .text("TOTAL", colTotal, y + 7);

  y += 22;
  let rowAlt = false;
  let itemsOnPage = 0;

  for (const item of data.items) {
    // Check if we need a new page
    if (itemsOnPage >= MAX_ITEMS_PER_PAGE) {
      doc.rect(50, y + 4, W, 0.5).fill("#e7e5e4");
      y = addNewPage();
      // Re-add table header on new page
      doc.rect(50, y, W, 22).fill(DARK);
      doc.fillColor("white").font("Helvetica-Bold").fontSize(8.5)
        .text("DESCRIPTION", colDesc, y + 7)
        .text("QTÉ", colQty, y + 7)
        .text("PRIX UNIT.", colPrix, y + 7)
        .text("TOTAL", colTotal, y + 7);
      y += 22;
      itemsOnPage = 0;
      rowAlt = false;
    }

    const rowH = 22;
    if (rowAlt) doc.rect(50, y, W, rowH).fill("#fafaf9");
    rowAlt = !rowAlt;
    doc.fillColor(DARK).font("Helvetica").fontSize(8.5)
      .text(item.description, colDesc, y + 7, { width: 255, ellipsis: true })
      .text(String(item.quantity), colQty, y + 7, { width: 50, align: "right" })
      .text(fmt(item.unitPrice), colPrix, y + 7, { width: 60, align: "right" })
      .text(fmt(item.totalPrice), colTotal, y + 7, { width: 70, align: "right" });
    y += rowH;
    itemsOnPage++;
  }

  // Divider
  doc.rect(50, y + 4, W, 0.5).fill("#e7e5e4");
  y += 14;

  // ---- Totals ----
  y = checkPageSpace(y, 100);
  const totX = 370;
  const totW = 175;
  doc.fillColor(GRAY).font("Helvetica").fontSize(9)
    .text("Sous-total", totX, y, { width: 95 })
    .text(fmt(data.subtotal), totX + 95, y, { width: 80, align: "right" });
  y += 14;

  if (data.taxRate > 0) {
    doc.text(`TVA (${data.taxRate}%)`, totX, y, { width: 95 })
      .text(fmt(data.taxAmount), totX + 95, y, { width: 80, align: "right" });
    y += 14;
  }

  // Total row
  doc.rect(totX - 5, y - 2, totW + 10, 22).fill(ORANGE);
  doc.fillColor("white").font("Helvetica-Bold").fontSize(10)
    .text("TOTAL", totX, y + 4, { width: 95 })
    .text(fmt(data.total), totX + 95, y + 4, { width: 80, align: "right" });
  y += 30;

  // Notes
  if (data.notes) {
    y = checkPageSpace(y, 50);
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(8).text("NOTES", 65, y);
    doc.font("Helvetica").fillColor(GRAY).fontSize(8).text(data.notes, 65, y + 12, { width: 300 });
    y += 30;
  }

  // Signature
  if (company.signatureText) {
    y = checkPageSpace(y, 30);
    y = Math.max(y, 680);
    doc.fillColor(GRAY).font("Helvetica").fontSize(8)
      .text(company.signatureText, 65, y, { width: W, align: "center" });
  }

  // Footer line on each page
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    doc.moveTo(50, 780).lineTo(545, 780).strokeColor("#e7e5e4").lineWidth(0.5).stroke();
    doc.fillColor(GRAY).font("Helvetica").fontSize(7)
      .text(company.name, 65, 785, { width: W / 2 });
    if (company.taxNumber) {
      doc.text(`N° TVA: ${company.taxNumber}`, 65, 785, { width: W, align: "right" });
    }
    if (range.count > 1) {
      doc.text(`Page ${i + 1}/${range.count}`, 65, 785, { width: W, align: "center" });
    }
  }

  doc.end();
});

export default router;
