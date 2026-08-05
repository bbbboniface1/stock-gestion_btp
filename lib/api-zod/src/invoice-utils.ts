/**
 * Calcul des totaux de facture — partagé entre backend et frontend.
 * Source unique de vérité pour subtotal / taxAmount / total.
 */
export function calculateInvoiceTotals(
  items: Array<{ quantity: number; unitPrice: number }>,
  taxRate = 0,
) {
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const taxAmount = Math.round(subtotal * taxRate) / 100;
  const total = subtotal + taxAmount;
  return { subtotal, taxAmount, total };
}
