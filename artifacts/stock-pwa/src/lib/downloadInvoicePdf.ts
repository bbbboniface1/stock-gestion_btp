import { useAuthStore } from "@/lib/auth";
import { appPath } from "@/lib/paths";

export async function downloadInvoicePdf(invoiceId: number, invoiceNumber: string): Promise<void> {
  const token = useAuthStore.getState().token;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000); // PDF generation can take a moment
  let response: Response;
  try {
    response = await fetch(appPath(`/api/invoices/${invoiceId}/pdf`), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    throw new Error("Erreur lors du téléchargement du PDF");
  }
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `facture-${invoiceNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
