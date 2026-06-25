import { useParams, useLocation } from "wouter";
import { useGetInvoice, useUpdateInvoiceStatus } from "@/lib/invoiceApi";
import { useCompany } from "@/contexts/CompanyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Package, CheckCircle, Clock, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/lib/auth";
import { customFetch } from "@workspace/api-client-react";

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: "Brouillon", className: "bg-muted text-muted-foreground border-muted-foreground/30" },
  unpaid: { label: "Non payée", className: "bg-destructive/20 text-destructive border-destructive/30" },
  paid: { label: "Payée", className: "bg-green-500/20 text-green-500 border-green-500/30" },
};

function fmt(n: number, currency = "EUR") {
  const sym = currency === "EUR" ? "€" : currency === "USD" ? "$" : currency;
  return `${n.toFixed(2)} ${sym}`;
}

export default function InvoiceDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const company = useCompany();
  const { user } = useAuthStore();
  const canManage = user?.role === "admin" || user?.role === "manager";

  const { data: invoice, isLoading } = useGetInvoice(id);
  const updateStatus = useUpdateInvoiceStatus();

  if (isLoading) {
    return <div className="text-muted-foreground uppercase text-sm animate-pulse p-8">Chargement...</div>;
  }

  if (!invoice) {
    return (
      <div className="p-8 text-center">
        <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground uppercase text-sm">Facture introuvable</p>
        <Button className="mt-4" onClick={() => setLocation("/invoices")}>Retour aux factures</Button>
      </div>
    );
  }

  const st = statusConfig[invoice.status] ?? statusConfig.draft;
  const currency = company?.currency ?? "EUR";

  const handleStatusChange = (newStatus: "draft" | "unpaid" | "paid") => {
    if (newStatus === "paid" && invoice.status !== "paid") {
      const hasStock = invoice.items.some(i => i.productId);
      if (hasStock && !confirm("Passer en Payée va débiter automatiquement le stock pour les articles liés. Confirmer ?")) return;
    }
    updateStatus.mutate({ id, status: newStatus }, {
      onSuccess: () => toast({ title: "Statut mis à jour" }),
      onError: (err: any) => toast({ variant: "destructive", title: err.message ?? "Erreur" }),
    });
  };

  const handleDownloadPdf = async () => {
    try {
      const response = await fetch(`/api/invoices/${id}/pdf`, {
        headers: {
          'Authorization': `Bearer ${useAuthStore.getState().token}`
        }
      });
      if (!response.ok) throw new Error('Erreur lors du téléchargement');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `facture-${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast({ variant: "destructive", title: "Erreur lors du téléchargement du PDF" });
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/invoices")} className="h-8 w-8 p-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold uppercase tracking-tight font-mono">{invoice.invoiceNumber}</h1>
            <Badge className={`uppercase text-xs ${st.className}`}>{st.label}</Badge>
          </div>
          <p className="text-muted-foreground text-sm uppercase tracking-wider mt-1">{invoice.clientName}</p>
        </div>
        <Button
          variant="outline"
          className="uppercase font-bold text-xs shrink-0"
          onClick={handleDownloadPdf}
        >
          <Download className="h-4 w-4 mr-2" /> PDF
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-xs font-bold uppercase tracking-wider">Client</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-1 text-sm">
            <div className="font-bold">{invoice.clientName}</div>
            {invoice.clientPhone && <div className="text-muted-foreground">{invoice.clientPhone}</div>}
            {invoice.clientEmail && <div className="text-muted-foreground">{invoice.clientEmail}</div>}
            {invoice.clientAddress && <div className="text-muted-foreground">{invoice.clientAddress}</div>}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-xs font-bold uppercase tracking-wider">Détails</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground uppercase text-xs">Date</span>
              <span className="font-mono">{new Date(invoice.date + "T00:00:00Z").toLocaleDateString("fr-FR")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground uppercase text-xs">Émis le</span>
              <span className="font-mono">{new Date(invoice.createdAt).toLocaleDateString("fr-FR")}</span>
            </div>
            {invoice.notes && (
              <div className="pt-2 border-t border-border text-muted-foreground italic text-xs">{invoice.notes}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border pb-3">
          <CardTitle className="text-xs font-bold uppercase tracking-wider">Articles</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="hidden md:grid grid-cols-[1fr_80px_100px_100px] gap-2 px-4 py-2 bg-muted/30 text-xs font-bold uppercase text-muted-foreground border-b border-border">
            <span>Description</span>
            <span>Qté</span>
            <span>Prix unit.</span>
            <span className="text-right">Total</span>
          </div>
          <div className="divide-y divide-border">
            {invoice.items.map(item => (
              <div key={item.id} className="grid grid-cols-1 md:grid-cols-[1fr_80px_100px_100px] gap-2 px-4 py-3 items-center">
                <div className="flex items-center gap-2">
                  {item.productId && <Package className="h-3 w-3 text-primary shrink-0" />}
                  <span className="text-sm font-medium">{item.description}</span>
                </div>
                <span className="font-mono text-sm text-muted-foreground">{item.quantity}</span>
                <span className="font-mono text-sm text-muted-foreground">{fmt(item.unitPrice, currency)}</span>
                <span className="font-mono font-bold text-sm text-right">{fmt(item.totalPrice, currency)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-border p-4 flex flex-col items-end gap-1 text-sm">
            <div className="flex justify-between w-full max-w-xs">
              <span className="text-muted-foreground uppercase">Sous-total</span>
              <span className="font-mono font-bold">{fmt(invoice.subtotal, currency)}</span>
            </div>
            {invoice.taxRate > 0 && (
              <div className="flex justify-between w-full max-w-xs">
                <span className="text-muted-foreground uppercase">TVA ({invoice.taxRate}%)</span>
                <span className="font-mono">{fmt(invoice.taxAmount, currency)}</span>
              </div>
            )}
            <div className="flex justify-between w-full max-w-xs pt-2 border-t border-border">
              <span className="font-bold uppercase text-primary">Total</span>
              <span className="font-mono font-bold text-xl text-primary">{fmt(invoice.total, currency)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {canManage && (
        <Card className="bg-card border-border">
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-xs font-bold uppercase tracking-wider">Changer le statut</CardTitle>
          </CardHeader>
          <CardContent className="p-4 flex flex-wrap gap-3">
            <Button
              variant={invoice.status === "draft" ? "default" : "outline"}
              className="uppercase font-bold text-xs"
              onClick={() => handleStatusChange("draft")}
              disabled={invoice.status === "draft" || updateStatus.isPending}
            >
              <FileText className="h-3 w-3 mr-2" /> Brouillon
            </Button>
            <Button
              variant={invoice.status === "unpaid" ? "default" : "outline"}
              className="uppercase font-bold text-xs border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={() => handleStatusChange("unpaid")}
              disabled={invoice.status === "unpaid" || updateStatus.isPending}
            >
              <Clock className="h-3 w-3 mr-2" /> Non payée
            </Button>
            <Button
              variant={invoice.status === "paid" ? "default" : "outline"}
              className="uppercase font-bold text-xs border-green-500/40 text-green-500 hover:bg-green-500/10"
              onClick={() => handleStatusChange("paid")}
              disabled={invoice.status === "paid" || updateStatus.isPending}
            >
              <CheckCircle className="h-3 w-3 mr-2" /> Payée
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
