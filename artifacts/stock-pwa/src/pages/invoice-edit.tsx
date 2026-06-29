import { useState, useMemo, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useGetInvoice, useUpdateInvoice, getInvoiceApiError, type CreateInvoiceItemInput } from "@/lib/invoiceApi";
import { useListProducts } from "@workspace/api-client-react";
import { useCompany } from "@/contexts/CompanyContext";
import { CompanyBranding } from "@/components/CompanyBranding";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, Search, Package, FileText } from "lucide-react";

interface LineItem extends CreateInvoiceItemInput {
  _key: number;
  _fromStock?: boolean;
}

let keyCounter = 0;
function nextKey() { return ++keyCounter; }

function fmt(n: number) { return n.toFixed(2); }

export default function InvoiceEdit() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0", 10);
  const [, setLocation] = useLocation();
  const company = useCompany();
  const { toast } = useToast();

  const { data: invoice, isLoading, isError } = useGetInvoice(id);
  const updateInvoice = useUpdateInvoice(id);

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [taxRate, setTaxRate] = useState(0);
  const [items, setItems] = useState<LineItem[]>([]);
  const [initialized, setInitialized] = useState(false);

  const [productSearch, setProductSearch] = useState("");
  const [showPicker, setShowPicker] = useState(false);

  const { data: products } = useListProducts({ limit: 200 });

  useEffect(() => {
    if (!invoice || initialized) return;
    if (invoice.status !== "draft") {
      toast({ variant: "destructive", title: "Seules les factures brouillon peuvent être modifiées" });
      setLocation(`/invoices/${id}`);
      return;
    }
    setClientName(invoice.clientName);
    setClientPhone(invoice.clientPhone ?? "");
    setClientEmail(invoice.clientEmail ?? "");
    setClientAddress(invoice.clientAddress ?? "");
    setDate(invoice.date);
    setNotes(invoice.notes ?? "");
    setTaxRate(invoice.taxRate);
    setItems(invoice.items.map(item => ({
      _key: nextKey(),
      productId: item.productId ?? undefined,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      _fromStock: !!item.productId,
    })));
    setInitialized(true);
  }, [invoice, initialized, id, setLocation, toast]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    const q = productSearch.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
    );
  }, [products, productSearch]);

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const taxAmount = Math.round(subtotal * taxRate) / 100;
  const total = subtotal + taxAmount;

  const addProductToInvoice = (product: { id: number; name: string; quantityInStock: number; unit: string }) => {
    const existing = items.find(i => i.productId === product.id);
    if (existing) {
      setItems(prev => prev.map(i =>
        i._key === existing._key ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      setItems(prev => [...prev, {
        _key: nextKey(),
        productId: product.id,
        description: product.name,
        quantity: 1,
        unitPrice: 0,
        _fromStock: true,
      }]);
    }
  };

  const addBlankLine = () => {
    setItems(prev => [...prev, {
      _key: nextKey(),
      description: "",
      quantity: 0,
      unitPrice: 0,
    }]);
  };

  const updateItem = (key: number, field: Partial<LineItem>) => {
    setItems(prev => prev.map(i => i._key === key ? { ...i, ...field } : i));
  };

  const removeItem = (key: number) => {
    setItems(prev => prev.filter(i => i._key !== key));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) { toast({ variant: "destructive", title: "Nom du client requis" }); return; }
    if (items.length === 0) { toast({ variant: "destructive", title: "Au moins un article requis" }); return; }
    const badItems = items.filter(i => !i.description.trim());
    if (badItems.length > 0) { toast({ variant: "destructive", title: "Tous les articles doivent avoir une description" }); return; }

    const invalidQty = items.filter(i => !Number.isInteger(i.quantity) || i.quantity < 1);
    if (invalidQty.length > 0) {
      toast({ variant: "destructive", title: "Les quantités doivent être des entiers positifs" });
      return;
    }

    updateInvoice.mutate({
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim() || undefined,
      clientEmail: clientEmail.trim() || undefined,
      clientAddress: clientAddress.trim() || undefined,
      date,
      notes: notes.trim() || undefined,
      taxRate,
      items: items.map(({ _key, _fromStock, ...rest }) => rest),
    }, {
      onSuccess: () => {
        toast({ title: "Facture mise à jour" });
        setLocation(`/invoices/${id}`);
      },
      onError: (err) => {
        toast({ variant: "destructive", title: getInvoiceApiError(err, "Erreur lors de la mise à jour") });
      },
    });
  };

  const currency = company?.currency ?? "EUR";
  const currSym = currency === "EUR" ? "€" : currency === "USD" ? "$" : currency;

  if (isLoading || (!initialized && invoice)) {
    return <div className="text-muted-foreground uppercase text-sm animate-pulse p-8">Chargement...</div>;
  }

  if (isError || !invoice) {
    return (
      <div className="p-8 text-center">
        <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-destructive uppercase text-sm font-mono">Impossible de charger la facture</p>
        <Button className="mt-4" onClick={() => setLocation("/invoices")}>Retour aux factures</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation(`/invoices/${id}`)} className="h-8 w-8 p-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight">Modifier {invoice.invoiceNumber}</h1>
          <p className="text-muted-foreground text-sm uppercase tracking-wider mt-1">Brouillon — édition autorisée</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <CompanyBranding />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-card border-border">
            <CardHeader className="border-b border-border pb-3">
              <CardTitle className="text-xs font-bold uppercase tracking-wider">Informations Client</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div>
                <label className="text-xs uppercase text-muted-foreground font-bold">Nom *</label>
                <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Nom du client" className="bg-background mt-1" />
              </div>
              <div>
                <label className="text-xs uppercase text-muted-foreground font-bold">Téléphone</label>
                <Input value={clientPhone} onChange={e => setClientPhone(e.target.value)} className="bg-background mt-1" />
              </div>
              <div>
                <label className="text-xs uppercase text-muted-foreground font-bold">Email</label>
                <Input value={clientEmail} onChange={e => setClientEmail(e.target.value)} className="bg-background mt-1" />
              </div>
              <div>
                <label className="text-xs uppercase text-muted-foreground font-bold">Adresse</label>
                <Input value={clientAddress} onChange={e => setClientAddress(e.target.value)} className="bg-background mt-1" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="border-b border-border pb-3">
              <CardTitle className="text-xs font-bold uppercase tracking-wider">Paramètres Facture</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div>
                <label className="text-xs uppercase text-muted-foreground font-bold">Date *</label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-background mt-1" />
              </div>
              <div>
                <label className="text-xs uppercase text-muted-foreground font-bold">TVA (%)</label>
                <Input type="number" min={0} max={100} value={taxRate} onChange={e => setTaxRate(Number(e.target.value))} className="bg-background mt-1" />
              </div>
              <div>
                <label className="text-xs uppercase text-muted-foreground font-bold">Notes</label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} className="bg-background mt-1" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card border-border">
          <CardHeader className="border-b border-border pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider">Articles</CardTitle>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" className="uppercase text-xs font-bold" onClick={() => setShowPicker(!showPicker)}>
                  <Package className="h-3 w-3 mr-1" />
                  {showPicker ? "Masquer stock" : "Ajouter du stock"}
                </Button>
                <Button type="button" size="sm" variant="outline" className="uppercase text-xs font-bold" onClick={addBlankLine}>
                  <Plus className="h-3 w-3 mr-1" /> Ligne libre
                </Button>
              </div>
            </div>
          </CardHeader>

          {showPicker && (
            <div className="border-b border-border p-4 bg-muted/20">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher dans le stock..."
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  className="pl-9 bg-background"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                {filteredProducts.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addProductToInvoice(p)}
                    className="flex items-center justify-between p-2 rounded border border-border hover:border-primary/60 hover:bg-primary/5 transition-all text-left"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground uppercase">{p.category} · {p.quantityInStock} {p.unit}</div>
                    </div>
                    <Plus className="h-4 w-4 text-primary shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <CardContent className="p-0">
            {items.length > 0 ? (
              <>
                <div className="hidden md:grid grid-cols-[1fr_80px_100px_100px_40px] gap-2 px-4 py-2 bg-muted/30 text-xs font-bold uppercase text-muted-foreground border-b border-border">
                  <span>Description</span>
                  <span>Qté</span>
                  <span>Prix unit. ({currSym})</span>
                  <span className="text-right">Total</span>
                  <span></span>
                </div>
                <div className="divide-y divide-border">
                  {items.map(item => (
                    <div key={item._key} className="grid grid-cols-1 md:grid-cols-[1fr_80px_100px_100px_40px] gap-2 p-3 items-center">
                      <div className="flex items-center gap-2">
                        {item._fromStock && <Package className="h-3 w-3 text-primary shrink-0" />}
                        <Input
                          value={item.description}
                          onChange={e => updateItem(item._key, { description: e.target.value })}
                          className="bg-background text-sm h-8"
                        />
                      </div>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={item.quantity}
                        onChange={e => updateItem(item._key, { quantity: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                        className="bg-background text-sm h-8"
                      />
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={item.unitPrice}
                        onChange={e => updateItem(item._key, { unitPrice: Number(e.target.value) })}
                        className="bg-background text-sm h-8"
                      />
                      <div className="text-right font-mono font-bold text-sm pr-1">
                        {fmt(item.quantity * item.unitPrice)} {currSym}
                      </div>
                      <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10" onClick={() => removeItem(item._key)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="p-8 text-center text-muted-foreground text-sm uppercase">
                Aucun article
              </div>
            )}
          </CardContent>
        </Card>

        {items.length > 0 && (
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex flex-col items-end gap-1 text-sm">
                <div className="flex justify-between w-full max-w-xs">
                  <span className="text-muted-foreground uppercase">Sous-total</span>
                  <span className="font-mono font-bold">{fmt(subtotal)} {currSym}</span>
                </div>
                {taxRate > 0 && (
                  <div className="flex justify-between w-full max-w-xs">
                    <span className="text-muted-foreground uppercase">TVA ({taxRate}%)</span>
                    <span className="font-mono">{fmt(taxAmount)} {currSym}</span>
                  </div>
                )}
                <div className="flex justify-between w-full max-w-xs pt-2 border-t border-border">
                  <span className="font-bold uppercase text-primary">Total</span>
                  <span className="font-mono font-bold text-xl text-primary">{fmt(total)} {currSym}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" className="uppercase font-bold" onClick={() => setLocation(`/invoices/${id}`)}>
            Annuler
          </Button>
          <Button type="submit" className="uppercase font-bold tracking-wide" disabled={updateInvoice.isPending}>
            {updateInvoice.isPending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </form>
    </div>
  );
}
