import { useState } from "react";
import { useLocation } from "wouter";
import { useListInvoices } from "@/lib/invoiceApi";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FileText, Plus, Search, Download } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: "Brouillon", className: "bg-muted text-muted-foreground border-muted-foreground/30" },
  unpaid: { label: "Non payée", className: "bg-destructive/20 text-destructive border-destructive/30" },
  paid: { label: "Payée", className: "bg-green-500/20 text-green-500 border-green-500/30" },
};

function fmt(n: number, currency = "EUR") {
  const sym = currency === "EUR" ? "€" : currency === "USD" ? "$" : currency;
  return `${n.toFixed(2)} ${sym}`;
}

export default function Invoices() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const { data: invoices, isLoading, isError } = useListInvoices();
  const company = useCompany();

  const filtered = invoices?.filter(inv =>
    inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
    inv.clientName.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const totalPaid = invoices?.filter(i => i.status === "paid").reduce((s, i) => s + i.total, 0) ?? 0;
  const totalUnpaid = invoices?.filter(i => i.status === "unpaid").reduce((s, i) => s + i.total, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight">Factures</h1>
          <p className="text-muted-foreground text-sm uppercase tracking-wider mt-1">
            {invoices?.length ?? 0} facture{(invoices?.length ?? 0) !== 1 ? "s" : ""}
          </p>
        </div>
        <Button className="uppercase font-bold tracking-wide" onClick={() => setLocation("/invoices/new")}>
          <Plus className="h-4 w-4 mr-2" /> Nouvelle Facture
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Total facturé</div>
            <div className="text-2xl font-bold font-mono mt-1">{fmt(totalPaid + totalUnpaid, company?.currency)}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Payé</div>
            <div className="text-2xl font-bold font-mono text-green-500 mt-1">{fmt(totalPaid, company?.currency)}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">En attente</div>
            <div className="text-2xl font-bold font-mono text-destructive mt-1">{fmt(totalUnpaid, company?.currency)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par numéro ou client..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 bg-card border-border"
        />
      </div>

      {isError ? (
        <div className="flex flex-col items-center gap-3 p-12 text-center">
          <p className="text-destructive font-mono uppercase text-sm">Impossible de charger les factures</p>
          <button onClick={() => window.location.reload()} className="text-xs text-primary hover:underline font-mono uppercase">Réessayer</button>
        </div>
      ) : isLoading ? (
        <div className="text-muted-foreground uppercase text-sm animate-pulse p-8">Chargement...</div>
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            {filtered.length > 0 ? (
              <div className="divide-y divide-border">
                {filtered.map(invoice => {
                  const st = statusConfig[invoice.status] ?? statusConfig.draft;
                  return (
                    <div
                      key={invoice.id}
                      className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setLocation(`/invoices/${invoice.id}`)}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="h-10 w-10 rounded-sm bg-primary/10 flex items-center justify-center shrink-0">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold font-mono text-sm">{invoice.invoiceNumber}</div>
                          <div className="text-sm text-foreground font-medium truncate">{invoice.clientName}</div>
                          <div className="text-xs text-muted-foreground uppercase">
                            {new Date(invoice.date).toLocaleDateString("fr-FR")}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <div className="font-bold font-mono">{fmt(invoice.total, company?.currency)}</div>
                          {invoice.taxRate > 0 && (
                            <div className="text-xs text-muted-foreground">TVA {invoice.taxRate}%</div>
                          )}
                        </div>
                        <Badge className={`uppercase text-xs ${st.className}`}>{st.label}</Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0"
                          onClick={e => {
                            e.stopPropagation();
                            window.open(`/api/invoices/${invoice.id}/pdf`, "_blank");
                          }}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground uppercase text-sm">Aucune facture trouvée</p>
                <Button className="mt-4 uppercase font-bold" onClick={() => setLocation("/invoices/new")}>
                  <Plus className="h-4 w-4 mr-2" /> Créer une facture
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
