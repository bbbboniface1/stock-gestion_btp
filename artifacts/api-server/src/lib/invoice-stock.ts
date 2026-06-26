import {
  db,
  productsTable,
  stockMovementsTable,
  invoiceSequencesTable,
  type StockMovement,
} from "@workspace/db";
import { and, eq, gte, sql, isNull } from "drizzle-orm";

type DbClient = Pick<typeof db, "select" | "insert" | "update" | "delete" | "execute">;

export type InvoiceStockItem = {
  productId?: number | null;
  description: string;
  quantity: number;
};

export type InvoiceStatus = "draft" | "unpaid" | "paid";

const ALLOWED_STATUS_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ["draft", "unpaid", "paid"],
  unpaid: ["unpaid", "draft", "paid"],
  paid: ["paid", "unpaid", "draft"],
};

export function validateStatusTransition(from: InvoiceStatus, to: InvoiceStatus): string | null {
  if (from === to) return null;
  if (!ALLOWED_STATUS_TRANSITIONS[from]?.includes(to)) {
    return `Transition de statut interdite : ${from} → ${to}`;
  }
  return null;
}

export async function getNextInvoiceNumber(tx: DbClient): Promise<string> {
  const year = new Date().getFullYear();
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"invoice_seq_" + year}))`);

  const [existing] = await tx
    .select()
    .from(invoiceSequencesTable)
    .where(eq(invoiceSequencesTable.year, year))
    .for("update");

  let nextNumber: number;
  if (!existing) {
    nextNumber = 1;
    await tx.insert(invoiceSequencesTable).values({ year, lastNumber: nextNumber });
  } else {
    nextNumber = existing.lastNumber + 1;
    await tx
      .update(invoiceSequencesTable)
      .set({ lastNumber: nextNumber })
      .where(eq(invoiceSequencesTable.year, year));
  }

  return `FAC-${year}-${String(nextNumber).padStart(4, "0")}`;
}

export async function validateInvoiceStockItems(
  tx: DbClient,
  items: InvoiceStockItem[],
): Promise<string | null> {
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      return `Quantité entière requise (minimum 1) pour "${item.description}"`;
    }
    if (!item.productId) continue;

    const [product] = await tx
      .select({ id: productsTable.id, name: productsTable.name })
      .from(productsTable)
      .where(eq(productsTable.id, item.productId));

    if (!product) {
      return `Produit introuvable (id ${item.productId}) pour "${item.description}"`;
    }
  }
  return null;
}

export async function validateStockAvailabilityForPaid(
  tx: DbClient,
  items: InvoiceStockItem[],
): Promise<string | null> {
  const baseError = await validateInvoiceStockItems(tx, items);
  if (baseError) return baseError;

  const requiredByProduct = new Map<number, { quantity: number; label: string }>();
  for (const item of items) {
    if (!item.productId) continue;
    const current = requiredByProduct.get(item.productId);
    if (current) {
      current.quantity += item.quantity;
    } else {
      requiredByProduct.set(item.productId, { quantity: item.quantity, label: item.description });
    }
  }

  for (const [productId, { quantity, label }] of requiredByProduct) {
    const [product] = await tx
      .select({
        name: productsTable.name,
        quantityInStock: productsTable.quantityInStock,
      })
      .from(productsTable)
      .where(eq(productsTable.id, productId));

    if (!product) {
      return `Produit introuvable pour "${label}"`;
    }
    if (product.quantityInStock < quantity) {
      return `Stock insuffisant pour ${product.name} (requis: ${quantity}, disponible: ${product.quantityInStock})`;
    }
  }

  return null;
}

export async function deductStockForPaidInvoice(
  tx: DbClient,
  invoiceId: number,
  invoiceNumber: string,
  items: InvoiceStockItem[],
  userId: number,
): Promise<string | null> {
  const stockError = await validateStockAvailabilityForPaid(tx, items);
  if (stockError) return stockError;

  for (const item of items) {
    if (!item.productId) continue;

    const qty = item.quantity;
    const [updated] = await tx
      .update(productsTable)
      .set({ quantityInStock: sql`${productsTable.quantityInStock} - ${qty}` })
      .where(and(eq(productsTable.id, item.productId), gte(productsTable.quantityInStock, qty)))
      .returning();

    if (!updated) {
      return `Stock insuffisant pour l'article "${item.description}"`;
    }

    await tx.insert(stockMovementsTable).values({
      productId: item.productId,
      type: "OUT",
      quantity: qty,
      reason: `Facture ${invoiceNumber}`,
      invoiceId,
      createdById: userId,
    });
  }
  return null;
}

export async function reverseStockForUnpaidInvoice(
  tx: DbClient,
  invoiceId: number,
  invoiceNumber: string,
  userId: number,
): Promise<void> {
  const outMovements = await tx
    .select()
    .from(stockMovementsTable)
    .where(and(
      eq(stockMovementsTable.invoiceId, invoiceId),
      eq(stockMovementsTable.type, "OUT"),
      isNull(stockMovementsTable.reversedByMovementId),
    ));

  for (const mov of outMovements) {
    if (!mov.productId) continue;

    const [inMovement] = await tx
      .insert(stockMovementsTable)
      .values({
        productId: mov.productId,
        type: "IN",
        quantity: mov.quantity,
        reason: `Annulation facture ${invoiceNumber}`,
        invoiceId,
        createdById: userId,
      })
      .returning();

    await tx
      .update(productsTable)
      .set({ quantityInStock: sql`${productsTable.quantityInStock} + ${mov.quantity}` })
      .where(eq(productsTable.id, mov.productId));

    await tx
      .update(stockMovementsTable)
      .set({ reversedByMovementId: inMovement.id })
      .where(eq(stockMovementsTable.id, mov.id));
  }
}

export function calculateInvoiceTotals(
  items: Array<{ quantity: number; unitPrice: number }>,
  taxRate = 0,
) {
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const taxAmount = Math.round(subtotal * taxRate) / 100;
  const total = subtotal + taxAmount;
  return { subtotal, taxAmount, total };
}

export type { StockMovement };
