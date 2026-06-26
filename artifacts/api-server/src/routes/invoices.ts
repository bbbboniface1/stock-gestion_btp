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
  const PAGE_BOTTOM = 720;
  const PAGE_MARGIN = 50;

  let currentPageY = PAGE_MARGIN;

  // Helper pour ajouter une nouvelle page et réinitialiser Y
  function addNewPage() {
    doc.addPage();
    currentPageY = PAGE_MARGIN;
    return currentPageY;
  }

  // Helper pour vérifier et ajouter une page si nécessaire
  function checkPageSpace(neededSpace: number) {
    if (currentPageY + neededSpace > PAGE_BOTTOM) {
      currentPageY = addNewPage();
    }
  }

  // ---- Header background band ----
  doc.rect(PAGE_MARGIN, currentPageY, W, 90).fill(DARK);

  // Load and display logo if URL exists
  let logoLoaded = false;
  if (company.logoUrl) {
    const logoAbortController = new AbortController();
    const logoTimeoutId = setTimeout(() => logoAbortController.abort(), 5000);
    try {
      const logoResponse = await fetch(company.logoUrl, { signal: logoAbortController.signal });
      if (logoResponse.ok) {
        const contentType = logoResponse.headers.get('content-type');
        if (contentType && contentType.startsWith('image/')) {
          const logoBuffer = Buffer.from(await logoResponse.arrayBuffer());
          doc.image(logoBuffer, PAGE_MARGIN + 15, currentPageY + 5, { width: 80, height: 80 });
          logoLoaded = true;
        } else {
          console.error('Logo URL is not an image:', contentType);
        }
      } else {
        console.error('Logo fetch failed:', logoResponse.status);
      }
    } catch (err) {
      console.error('Error loading logo:', err);
    } finally {
      clearTimeout(logoTimeoutId);
    }
  }

  // Company name (offset if logo exists)
  const nameX = logoLoaded ? PAGE_MARGIN + 110 : PAGE_MARGIN + 15;
  doc.fillColor("white").fontSize(22).font("Helvetica-Bold")
    .text(company.name, nameX, currentPageY + 15, { width: 300 - (logoLoaded ? 95 : 0) });

  // Company details (right side of header)
  doc.fontSize(8).font("Helvetica").fillColor("#d6d3d1");
  let hY = currentPageY + 18;
  if (company.address) { doc.text(company.address, PAGE_MARGIN + 300, hY, { width: 180, align: "right" }); hY += 11; }
  if (company.phone) { doc.text(company.phone, PAGE_MARGIN + 300, hY, { width: 180, align: "right" }); hY += 11; }
  if (company.email) { doc.text(company.email, PAGE_MARGIN + 300, hY, { width: 180, align: "right" }); hY += 11; }
  if (company.taxNumber) { doc.text(`N° TVA: ${company.taxNumber}`, PAGE_MARGIN + 300, hY, { width: 180, align: "right" }); }

  currentPageY += 100;

  // ---- Invoice title strip ----
  doc.rect(PAGE_MARGIN, currentPageY, W, 28).fill(ORANGE);
  doc.fillColor("white").fontSize(13).font("Helvetica-Bold")
    .text("FACTURE", PAGE_MARGIN + 15, currentPageY + 7);
  doc.fontSize(11).font("Helvetica")
    .text(`N° ${data.invoiceNumber}`, PAGE_MARGIN + 15, currentPageY + 8, { align: "right", width: W - 30 });

  currentPageY += 42;

  // ---- Invoice meta ----
  doc.fillColor(DARK).fontSize(9).font("Helvetica-Bold").text("DATE", PAGE_MARGIN + 15, currentPageY);
  doc.font("Helvetica").fillColor(GRAY).text(new Date(data.date + "T00:00:00Z").toLocaleDateString("fr-FR"), PAGE_MARGIN + 15, currentPageY + 12);

  doc.fillColor(DARK).font("Helvetica-Bold").text("STATUT", PAGE_MARGIN + 150, currentPageY);
  const sLabel = statusLabel[data.status] ?? data.status;
  const sColor = data.status === "paid" ? "#16a34a" : data.status === "unpaid" ? "#dc2626" : GRAY;
  doc.font("Helvetica").fillColor(sColor).text(sLabel, PAGE_MARGIN + 150, currentPageY + 12);

  currentPageY += 30;

  // ---- Client block ----
  checkPageSpace(100);
  doc.rect(PAGE_MARGIN, currentPageY, W, 80).fill(LIGHT_BG);
  doc.fillColor(DARK).font("Helvetica-Bold").fontSize(9).text("FACTURER À", PAGE_MARGIN + 15, currentPageY + 8);
  doc.font("Helvetica-Bold").fontSize(11).fillColor(DARK).text(data.clientName, PAGE_MARGIN + 15, currentPageY + 21);
  doc.font("Helvetica").fontSize(8).fillColor(GRAY);
  let cY = currentPageY + 35;
  if (data.clientAddress) { doc.text(data.clientAddress, PAGE_MARGIN + 15, cY); cY += 11; }
  if (data.clientPhone) { doc.text(data.clientPhone, PAGE_MARGIN + 15, cY); cY += 11; }
  if (data.clientEmail) { doc.text(data.clientEmail, PAGE_MARGIN + 15, cY); }

  currentPageY += 95;

  // ---- Items table ----
  checkPageSpace(50);
  const colDesc = PAGE_MARGIN + 15, colQty = PAGE_MARGIN + 280, colPrix = PAGE_MARGIN + 340, colTotal = PAGE_MARGIN + 410;
  const MAX_ITEMS_PER_PAGE = 18;

  // Table header
  doc.rect(PAGE_MARGIN, currentPageY, W, 22).fill(DARK);
  doc.fillColor("white").font("Helvetica-Bold").fontSize(8.5)
    .text("DESCRIPTION", colDesc, currentPageY + 7)
    .text("QTÉ", colQty, currentPageY + 7)
    .text("PRIX UNIT.", colPrix, currentPageY + 7)
    .text("TOTAL", colTotal, currentPageY + 7);

  currentPageY += 22;
  let rowAlt = false;
  let itemsOnPage = 0;

  for (const item of data.items) {
    // Check if we need a new page
    if (itemsOnPage >= MAX_ITEMS_PER_PAGE) {
      doc.rect(PAGE_MARGIN, currentPageY + 4, W, 0.5).fill("#e7e5e4");
      currentPageY = addNewPage();
      // Re-add table header on new page
      doc.rect(PAGE_MARGIN, currentPageY, W, 22).fill(DARK);
      doc.fillColor("white").font("Helvetica-Bold").fontSize(8.5)
        .text("DESCRIPTION", colDesc, currentPageY + 7)
        .text("QTÉ", colQty, currentPageY + 7)
        .text("PRIX UNIT.", colPrix, currentPageY + 7)
        .text("TOTAL", colTotal, currentPageY + 7);
      currentPageY += 22;
      itemsOnPage = 0;
      rowAlt = false;
    }

    const rowH = 22;
    if (rowAlt) doc.rect(PAGE_MARGIN, currentPageY, W, rowH).fill("#fafaf9");
    rowAlt = !rowAlt;
    doc.fillColor(DARK).font("Helvetica").fontSize(8.5)
      .text(item.description, colDesc, currentPageY + 7, { width: 255, ellipsis: true })
      .text(String(item.quantity), colQty, currentPageY + 7, { width: 50, align: "right" })
      .text(fmt(item.unitPrice), colPrix, currentPageY + 7, { width: 60, align: "right" })
      .text(fmt(item.totalPrice), colTotal, currentPageY + 7, { width: 70, align: "right" });
    currentPageY += rowH;
    itemsOnPage++;
  }

  // Divider
  doc.rect(PAGE_MARGIN, currentPageY + 4, W, 0.5).fill("#e7e5e4");
  currentPageY += 14;

  // ---- Totals ----
  checkPageSpace(100);
  const totX = PAGE_MARGIN + 320;
  const totW = 175;
  doc.fillColor(GRAY).font("Helvetica").fontSize(9)
    .text("Sous-total", totX, currentPageY, { width: 95 })
    .text(fmt(data.subtotal), totX + 95, currentPageY, { width: 80, align: "right" });
  currentPageY += 14;

  if (data.taxRate > 0) {
    doc.text(`TVA (${data.taxRate}%)`, totX, currentPageY, { width: 95 })
      .text(fmt(data.taxAmount), totX + 95, currentPageY, { width: 80, align: "right" });
    currentPageY += 14;
  }

  // Total row
  doc.rect(totX - 5, currentPageY - 2, totW + 10, 22).fill(ORANGE);
  doc.fillColor("white").font("Helvetica-Bold").fontSize(10)
    .text("TOTAL", totX, currentPageY + 4, { width: 95 })
    .text(fmt(data.total), totX + 95, currentPageY + 4, { width: 80, align: "right" });
  currentPageY += 30;

  // Notes
  if (data.notes) {
    checkPageSpace(50);
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(8).text("NOTES", PAGE_MARGIN + 15, currentPageY);
    doc.font("Helvetica").fillColor(GRAY).fontSize(8).text(data.notes, PAGE_MARGIN + 15, currentPageY + 12, { width: 300 });
    currentPageY += 30;
  }

  // Signature
  if (company.signatureText) {
    checkPageSpace(30);
    currentPageY = Math.max(currentPageY, 650);
    doc.fillColor(GRAY).font("Helvetica").fontSize(8)
      .text(company.signatureText, PAGE_MARGIN + 15, currentPageY, { width: W, align: "center" });
  }

  // Footer line on each page
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    doc.moveTo(PAGE_MARGIN, 750).lineTo(PAGE_MARGIN + W, 750).strokeColor("#e7e5e4").lineWidth(0.5).stroke();
    doc.fillColor(GRAY).font("Helvetica").fontSize(7)
      .text(company.name, PAGE_MARGIN + 15, 755, { width: W / 2 });
    if (company.taxNumber) {
      doc.text(`N° TVA: ${company.taxNumber}`, PAGE_MARGIN + 15, 755, { width: W, align: "right" });
    }
    if (range.count > 1) {
      doc.text(`Page ${i + 1}/${range.count}`, PAGE_MARGIN + 15, 755, { width: W, align: "center" });
    }
  }

  doc.end();
});

export default router;
