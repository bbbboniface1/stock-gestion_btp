import { Router, IRouter } from "express";
import { db, invoicesTable, invoiceItemsTable, companySettingsTable, stockMovementsTable, productsTable } from "@workspace/db";
import { eq, sql, and, desc } from "drizzle-orm";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middlewares/auth";
import { serializeDates } from "../lib/serialize";
import { recordAuditLog } from "../lib/audit";
import {
  getNextInvoiceNumber,
  validateInvoiceStockItems,
  validateStockAvailabilityForPaid,
  deductStockForPaidInvoice,
  reverseStockForUnpaidInvoice,
  validateStatusTransition,
  calculateInvoiceTotals,
  type InvoiceStatus,
} from "../lib/invoice-stock";
import { CreateInvoiceBody, UpdateInvoiceStatusBody } from "@workspace/api-zod";
import { z } from "zod";
import PDFDocument from "pdfkit";
import { resolveCompanyLogo } from "../lib/company-logo";

const router: IRouter = Router();

const UpdateInvoiceBody = CreateInvoiceBody.omit({ status: true });

function validateCreateInvoiceInput(data: {
  date: string;
  items: Array<{ description: string; quantity: number; unitPrice: number }>;
}): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    return "Date invalide (YYYY-MM-DD)";
  }
  for (const item of data.items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      return `Quantité entière requise (minimum 1) pour "${item.description}"`;
    }
    if (item.unitPrice < 0) {
      return `Prix unitaire invalide pour "${item.description}"`;
    }
  }
  return null;
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

  const stockMovements = await db
    .select({
      id: stockMovementsTable.id,
      productId: stockMovementsTable.productId,
      productName: productsTable.name,
      type: stockMovementsTable.type,
      quantity: stockMovementsTable.quantity,
      reason: stockMovementsTable.reason,
      createdAt: stockMovementsTable.createdAt,
      reversedByMovementId: stockMovementsTable.reversedByMovementId,
    })
    .from(stockMovementsTable)
    .leftJoin(productsTable, eq(stockMovementsTable.productId, productsTable.id))
    .where(eq(stockMovementsTable.invoiceId, id))
    .orderBy(desc(stockMovementsTable.createdAt));

  return {
    ...serializeDates(invoice),
    items: serializeDates(items),
    stockMovements: serializeDates(stockMovements),
  };
}

router.get("/invoices", requireAuth, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const statusFilter = z.enum(["draft", "unpaid", "paid"]).optional().safeParse(req.query.status);
  if (!statusFilter.success && req.query.status) {
    res.status(400).json({ error: "Statut de filtre invalide" });
    return;
  }

  const rows = statusFilter.data
    ? await db.select().from(invoicesTable).where(eq(invoicesTable.status, statusFilter.data)).orderBy(desc(invoicesTable.createdAt))
    : await db.select().from(invoicesTable).orderBy(desc(invoicesTable.createdAt));

  res.json(serializeDates(rows));
});

router.post("/invoices", requireAuth, requireRole("admin", "manager"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateInvoiceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const validationError = validateCreateInvoiceInput(parsed.data);
  if (validationError) { res.status(400).json({ error: validationError }); return; }

  const { items, taxRate = 0, status = "draft", ...invoiceData } = parsed.data;
  const { subtotal, taxAmount, total } = calculateInvoiceTotals(items, taxRate);

  const result = await db.transaction(async (tx) => {
    const productError = await validateInvoiceStockItems(tx, items);
    if (productError) return { error: productError };

    if (status === "paid") {
      const stockError = await validateStockAvailabilityForPaid(tx, items);
      if (stockError) return { error: stockError };
    }

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
      const stockError = await deductStockForPaidInvoice(
        tx,
        invoice.id,
        invoiceNumber,
        items,
        req.user!.id,
      );
      if (stockError) return { error: stockError };
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

router.patch("/invoices/:id", requireAuth, requireRole("admin", "manager"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!id) { res.status(400).json({ error: "ID invalide" }); return; }

  const parsed = UpdateInvoiceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const validationError = validateCreateInvoiceInput(parsed.data);
  if (validationError) { res.status(400).json({ error: validationError }); return; }

  const { items, taxRate = 0, ...invoiceData } = parsed.data;
  const { subtotal, taxAmount, total } = calculateInvoiceTotals(items, taxRate);

  const result = await db.transaction(async (tx) => {
    const [invoice] = await tx.select().from(invoicesTable).where(eq(invoicesTable.id, id));
    if (!invoice) return { error: "Facture introuvable" };
    if (invoice.status !== "draft") {
      return { error: "Seules les factures brouillon peuvent être modifiées" };
    }

    const productError = await validateInvoiceStockItems(tx, items);
    if (productError) return { error: productError };

    await tx.delete(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, id));
    await tx.insert(invoiceItemsTable).values(
      items.map((item, i) => ({
        invoiceId: id,
        productId: item.productId ?? null,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.quantity * item.unitPrice,
        position: i,
      }))
    );

    await tx.update(invoicesTable)
      .set({
        ...invoiceData,
        taxRate,
        subtotal,
        taxAmount,
        total,
        updatedAt: new Date(),
      })
      .where(eq(invoicesTable.id, id));

    return { ok: true };
  });

  if ("error" in result) { res.status(400).json({ error: result.error }); return; }
  const full = await getInvoiceWithItems(id);
  void recordAuditLog({ action: "update", entityType: "invoice", entityId: id, user: req.user, newValue: { invoiceNumber: full?.invoiceNumber, clientName: full?.clientName, total: full?.total } });
  res.json(full);
});

router.delete("/invoices/:id", requireAuth, requireRole("admin", "manager"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!id) { res.status(400).json({ error: "ID invalide" }); return; }

  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
  if (!invoice) { res.status(404).json({ error: "Facture introuvable" }); return; }
  if (invoice.status !== "draft") {
    res.status(400).json({ error: "Seules les factures brouillon peuvent être supprimées" });
    return;
  }

  const [movement] = await db
    .select({ id: stockMovementsTable.id })
    .from(stockMovementsTable)
    .where(eq(stockMovementsTable.invoiceId, id))
    .limit(1);
  if (movement) {
    res.status(400).json({ error: "Impossible de supprimer une facture liée à des mouvements de stock" });
    return;
  }

  await db.delete(invoicesTable).where(eq(invoicesTable.id, id));
  void recordAuditLog({ action: "delete", entityType: "invoice", entityId: id, user: req.user, oldValue: { invoiceNumber: invoice.invoiceNumber, clientName: invoice.clientName } });
  res.sendStatus(204);
});

router.patch("/invoices/:id/status", requireAuth, requireRole("admin", "manager"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!id) { res.status(400).json({ error: "ID invalide" }); return; }

  const bodyParsed = UpdateInvoiceStatusBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  const { status } = bodyParsed.data;

  const result = await db.transaction(async (tx) => {
    const [invoice] = await tx.select().from(invoicesTable).where(eq(invoicesTable.id, id));
    if (!invoice) return { error: "Facture introuvable" };

    const transitionError = validateStatusTransition(invoice.status as InvoiceStatus, status);
    if (transitionError) return { error: transitionError };

    if (status === "paid" && invoice.status !== "paid") {
      const items = await tx.select().from(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, id));
      const stockError = await deductStockForPaidInvoice(
        tx,
        invoice.id,
        invoice.invoiceNumber,
        items,
        req.user!.id,
      );
      if (stockError) return { error: stockError };
    }

    if (invoice.status === "paid" && status !== "paid") {
      await reverseStockForUnpaidInvoice(tx, invoice.id, invoice.invoiceNumber, req.user!.id);
    }

    await tx.update(invoicesTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(invoicesTable.id, id));

    return { ok: true };
  });

  if ("error" in result) { res.status(400).json({ error: result.error }); return; }
  const full = await getInvoiceWithItems(id);
  void recordAuditLog({ action: "update_status", entityType: "invoice", entityId: id, user: req.user, newValue: { status, invoiceNumber: full?.invoiceNumber } });
  res.json(full);
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

  try {
    const logo = await resolveCompanyLogo(company.logoUrl);
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

    function addNewPage() {
      doc.addPage();
      return 50;
    }

    function checkPageSpace(currentY: number, neededSpace: number): number {
      if (currentY + neededSpace > PAGE_BOTTOM) {
        return addNewPage();
      }
      return currentY;
    }

    doc.rect(50, 50, W, 90).fill(DARK);

    const logoBox = 68;
    let textStartX = 65;
    if (logo) {
      doc.image(logo.buffer, 58, 58, { fit: [logoBox, logoBox] });
      textStartX = 58 + logoBox + 12;
    }

    doc.fillColor("white").fontSize(22).font("Helvetica-Bold")
      .text(company.name, textStartX, 65, { width: Math.max(180, 340 - (textStartX - 65)) });

    doc.fontSize(8).font("Helvetica").fillColor("#d6d3d1");
    let hY = 68;
    if (company.address) { doc.text(company.address, 350, hY, { width: 180, align: "right" }); hY += 11; }
    if (company.phone) { doc.text(company.phone, 350, hY, { width: 180, align: "right" }); hY += 11; }
    if (company.email) { doc.text(company.email, 350, hY, { width: 180, align: "right" }); hY += 11; }
    if (company.taxNumber) { doc.text(`N° TVA: ${company.taxNumber}`, 350, hY, { width: 180, align: "right" }); }

    doc.rect(50, 140, W, 28).fill(ORANGE);
    doc.fillColor("white").fontSize(13).font("Helvetica-Bold")
      .text("FACTURE", 65, 147);
    doc.fontSize(11).font("Helvetica")
      .text(`N° ${data.invoiceNumber}`, 65, 148, { align: "right", width: W - 30 });

    let y = 182;
    doc.fillColor(DARK).fontSize(9).font("Helvetica-Bold").text("DATE", 65, y);
    doc.font("Helvetica").fillColor(GRAY).text(new Date(data.date + "T00:00:00Z").toLocaleDateString("fr-FR"), 65, y + 12);

    doc.fillColor(DARK).font("Helvetica-Bold").text("STATUT", 200, y);
    const sLabel = statusLabel[data.status] ?? data.status;
    const sColor = data.status === "paid" ? "#16a34a" : data.status === "unpaid" ? "#dc2626" : GRAY;
    doc.font("Helvetica").fillColor(sColor).text(sLabel, 200, y + 12);

    y = checkPageSpace(y + 10, 100);
    doc.rect(50, y, W, 80).fill(LIGHT_BG);
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(9).text("FACTURER À", 65, y + 8);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(DARK).text(data.clientName, 65, y + 21);
    doc.font("Helvetica").fontSize(8).fillColor(GRAY);
    let cY = y + 35;
    if (data.clientAddress) { doc.text(data.clientAddress, 65, cY); cY += 11; }
    if (data.clientPhone) { doc.text(data.clientPhone, 65, cY); cY += 11; }
    if (data.clientEmail) { doc.text(data.clientEmail, 65, cY); }

    y = checkPageSpace(cY + 15, 50);
    const colDesc = 65, colQty = 330, colPrix = 390, colTotal = 460;
    const MAX_ITEMS_PER_PAGE = 20;

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
      if (itemsOnPage >= MAX_ITEMS_PER_PAGE) {
        y = addNewPage();
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

    doc.rect(50, y + 4, W, 0.5).fill("#e7e5e4");
    y += 14;

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

    doc.rect(totX - 5, y - 2, totW + 10, 22).fill(ORANGE);
    doc.fillColor("white").font("Helvetica-Bold").fontSize(10)
      .text("TOTAL", totX, y + 4, { width: 95 })
      .text(fmt(data.total), totX + 95, y + 4, { width: 80, align: "right" });
    y += 30;

    if (data.notes) {
      y = checkPageSpace(y, 50);
      doc.fillColor(DARK).font("Helvetica-Bold").fontSize(8).text("NOTES", 65, y);
      doc.font("Helvetica").fillColor(GRAY).fontSize(8).text(data.notes, 65, y + 12, { width: 300 });
    }

    if (company.signatureText) {
      y = checkPageSpace(y + 30, 30);
      y = Math.max(y, 660);
      doc.fillColor(GRAY).font("Helvetica").fontSize(8)
        .text(company.signatureText, 65, y, { width: W, align: "center" });
      y += 18;
    }

    const footerParts = [company.name, company.address, company.phone, company.email, company.taxNumber ? `N° TVA: ${company.taxNumber}` : null]
      .filter(Boolean);
    if (footerParts.length > 0) {
      y = checkPageSpace(y + 10, 20);
      doc.fillColor(GRAY).font("Helvetica").fontSize(7)
        .text(footerParts.join(" · "), 50, Math.max(y, 730), { width: W, align: "center" });
    }

    doc.end();
  } catch {
    if (!res.headersSent) {
      res.status(500).json({ error: "Erreur lors de la génération du PDF" });
    }
  }
});

export default router;
