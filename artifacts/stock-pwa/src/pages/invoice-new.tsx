import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useCreateInvoice, type CreateInvoiceItemInput } from "@/lib/invoiceApi";
import { useListProducts } from "@workspace/api-client-react";
import { useCompany } from "@/contexts/CompanyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, Search, Package, X } from "lucide-react";

interface LineItem extends CreateInvoiceItemInput {
  _key: number;
  _fromStock?: boolean;
}

let keyCounter = 0;
function nextKey() { return ++keyCounter; }

function fmt(n: number) { return n.toFixed(2); }

export default function InvoiceNew() {
  const [, setLocation] = useLocation();
  const company = useCompany();
  const { toast } = useToast();
  const createInvoice = useCreateInvoice();

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<"draft" | "unpaid" | "paid">("draft");
  const [notes, setNotes] = useState("");
  const [taxRate, setTaxRate] = useState(0);
  const [items, setItems] = useState<LineItem[]>([]);

  const [productSearch, setProductSearch] = useState("");
  const [showPicker, setShowPicker] = useState(false);

  const { data: products } = useListProducts({ limit: 200 });

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
      quantity: 1,
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

    createInvoice.mutate({
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim() || undefined,
      clientEmail: clientEmail.trim() || undefined,
      clientAddress: clientAddress.trim() || undefined,
      date,
      status,
      notes: notes.trim() || undefined,
      taxRate,
      items: items.map(({ _key, _fromStock, ...rest }) => rest),
    }, {
      onSuccess: (inv) => {
        toast({ title: `Facture ${inv.invoiceNumber} créée` });
        setLocation(`/invoices/${inv.id}`);
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: err.message ?? "Erreur lors de la création" });
      },
    });
  };

  const currency = company?.currency ?? "EUR";
  const currSym = currency === "EUR" ? "€" : currency === "USD" ? "$" : currency;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/invoices")} className="h-8 w-8 p-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight">Nouvelle Facture</h1>
          <p className="text-muted-foreground text-sm uppercase tracking-wider mt-1">
            {company?.name ?? "Mon Entreprise"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
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
                <Input value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="+33 6 00 00 00 00" className="bg-background mt-1" />
              </div>
              <div>
                <label className="text-xs uppercase text-muted-foreground font-bold">Email</label>
                <Input value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="client@example.com" className="bg-background mt-1" />
              </div>
              <div>
                <label className="text-xs uppercase text-muted-foreground font-bold">Adresse</label>
                <Input value={clientAddress} onChange={e => setClientAddress(e.target.value)} placeholder="Adresse complète" className="bg-background mt-1" />
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
                <label className="text-xs uppercase text-muted-foreground font-bold">Statut</label>
                <Select value={status} onValueChange={v => setStatus(v as any)}>
                  <SelectTrigger className="bg-background mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Brouillon</SelectItem>
                    <SelectItem value="unpaid">Non payée</SelectItem>
                    <SelectItem value="paid">Payée</SelectItem>
                  </SelectContent>
                </Select>
                {status === "paid" && (
                  <p className="text-xs text-orange-400 mt-1">⚠ Le stock sera débité automatiquement pour les articles liés</p>
                )}
              </div>
              <div>
                <label className="text-xs uppercase text-muted-foreground font-bold">TVA (%)</label>
                <Input type="number" min={0} max={100} value={taxRate} onChange={e => setTaxRate(Number(e.target.value))} className="bg-background mt-1" />
              </div>
              <div>
                <label className="text-xs uppercase text-muted-foreground font-bold">Notes</label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes optionnelles" className="bg-background mt-1" />
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
                {filteredProducts.length === 0 && (
                  <div className="col-span-2 text-center text-muted-foreground text-sm uppercase py-4">Aucun produit trouvé</div>
                )}
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
                          placeholder="Description de l'article"
                          className="bg-background text-sm h-8"
                        />
                      </div>
                      <Input
                        type="number"
                        min={0.01}
                        step={0.01}
                        value={item.quantity}
                        onChange={e => updateItem(item._key, { quantity: Number(e.target.value) })}
                        className="bg-background text-sm h-8"
                      />
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={item.unitPrice}
                        onChange={e => updateItem(item._key, { unitPrice: Number(e.target.value) })}
                        className="bg-background text-sm h-8"
                        placeholder="0.00"
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
                Aucun article — ajoutez des produits du stock ou des lignes libres
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
          <Button type="button" variant="outline" className="uppercase font-bold" onClick={() => setLocation("/invoices")}>
            Annuler
          </Button>
          <Button type="submit" className="uppercase font-bold tracking-wide" disabled={createInvoice.isPending}>
            {createInvoice.isPending ? "Création..." : "Créer la facture"}
          </Button>
        </div>
      </form>
    </div>
  );
}
