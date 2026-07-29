/**
 * Formate un montant avec séparateurs de milliers et symbole devise,
 * en respectant les devises sans décimales (XOF/XAF).
 */
export function formatCurrency(amount: number, currencyCode: string): string {
  const isZeroDecimal = currencyCode === "XOF" || currencyCode === "XAF";
  const formatted = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: isZeroDecimal ? 0 : 2,
    maximumFractionDigits: isZeroDecimal ? 0 : 2,
  }).format(amount);

  const symbol =
    currencyCode === "EUR" ? "€" :
    currencyCode === "USD" ? "$" :
    currencyCode === "GBP" ? "£" :
    currencyCode === "MAD" ? "DH" :
    currencyCode === "XOF" ? "FCFA" :
    currencyCode === "XAF" ? "FCFA" :
    currencyCode;

  return `${formatted} ${symbol}`;
}
