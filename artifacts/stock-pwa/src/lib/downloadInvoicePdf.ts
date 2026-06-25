import { useAuthStore } from "@/lib/auth";
import { appPath } from "@/lib/paths";

export async function downloadInvoicePdf(invoiceId: number, invoiceNumber: string): Promise<void> {
  const token = useAuthStore.getState().token;
  const response = await fetch(appPath(`/api/invoices/${invoiceId}/pdf`), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
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
