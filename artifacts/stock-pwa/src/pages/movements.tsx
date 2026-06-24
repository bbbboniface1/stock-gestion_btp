import { useState } from "react";
import { useLocation } from "wouter";
import { useListStockMovements, useListProducts, useListProjects, getListStockMovementsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Plus, ArrowRightLeft, ArrowUp, ArrowDown, ChevronDown } from "lucide-react";
import MovementDialog from "@/components/MovementDialog";

const PAGE_SIZE = 100;

export default function Movements() {
  const [typeFilter, setTypeFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const queryClient = useQueryClient();

  const resetLimit = () => setLimit(PAGE_SIZE);

  const params: Record<string, string | number> = { limit };
  if (typeFilter !== "all") params.type = typeFilter;
  if (productFilter !== "all") params.product_id = parseInt(productFilter);
  if (projectFilter !== "all") params.project_id = parseInt(projectFilter);
  if (fromDate) params.from_date = fromDate;
  if (toDate) params.to_date = toDate;

  const { data: movements, isLoading } = useListStockMovements(params);
  const { data: products } = useListProducts({});
  const { data: projects } = useListProjects({});

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight">Mouvements de Stock</h1>
          <p className="text-muted-foreground text-sm uppercase tracking-wider mt-1">{movements?.length ?? 0} mouvements trouvés</p>
        </div>
        <Button onClick={() => setOpenNew(true)} data-testid="button-new-movement" className="uppercase font-bold tracking-wide">
          <Plus className="h-4 w-4 mr-2" /> Nouveau Mouvement
        </Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); resetLimit(); }}>
          <SelectTrigger className="bg-card border-border" data-testid="select-type-filter">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous types</SelectItem>
            <SelectItem value="IN">Entrées (IN)</SelectItem>
            <SelectItem value="OUT">Sorties (OUT)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={productFilter} onValueChange={v => { setProductFilter(v); resetLimit(); }}>
          <SelectTrigger className="bg-card border-border" data-testid="select-product-filter">
            <SelectValue placeholder="Produit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous produits</SelectItem>
            {products?.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={projectFilter} onValueChange={v => { setProjectFilter(v); resetLimit(); }}>
          <SelectTrigger className="bg-card border-border" data-testid="select-project-filter">
            <SelectValue placeholder="Projet" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous projets</SelectItem>
            {projects?.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); resetLimit(); }} className="bg-card border-border text-sm" data-testid="input-from-date" />
        <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="bg-card border-border text-sm" data-testid="input-to-date" />
      </div>

      {isLoading ? (
        <div className="text-muted-foreground uppercase text-sm animate-pulse p-8">Chargement de l'historique...</div>
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            {movements && movements.length > 0 ? (
              <div className="divide-y divide-border">
                {movements.map(m => (
                  <div key={m.id} data-testid={`row-movement-${m.id}`} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-sm shrink-0 ${m.type === "IN" ? "bg-green-500/15" : "bg-orange-500/15"}`}>
                        {m.type === "IN" ? <ArrowUp className="h-5 w-5 text-green-500" /> : <ArrowDown className="h-5 w-5 text-orange-500" />}
                      </div>
                      <div>
                        <div className="font-bold text-foreground">{m.productName}</div>
                        <div className="text-xs text-muted-foreground">{m.reason}</div>
                        {m.projectName && <div className="text-xs text-primary uppercase font-mono">{m.projectName}</div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-6 md:ml-auto">
                      <div className="text-right">
                        <div className={`font-bold font-mono text-xl ${m.type === "IN" ? "text-green-500" : "text-orange-500"}`}>
                          {m.type === "IN" ? "+" : "-"}{m.quantity}
                        </div>
                      </div>
                      <div className="text-right text-xs text-muted-foreground min-w-[120px]">
                        <div>{format(new Date(m.createdAt), "dd MMM yyyy", { locale: fr })}</div>
                        <div>{format(new Date(m.createdAt), "HH:mm")}</div>
                        <div className="uppercase">{m.createdByName}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center">
                <ArrowRightLeft className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground uppercase text-sm">Aucun mouvement trouvé</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {movements && movements.length === limit && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            className="uppercase font-bold tracking-wide border-border gap-2"
            onClick={() => setLimit(l => l + PAGE_SIZE)}
          >
            <ChevronDown className="h-4 w-4" />
            Charger {PAGE_SIZE} suivants
          </Button>
        </div>
      )}

      {openNew && (
        <MovementDialog
          open={openNew}
          onClose={() => {
            setOpenNew(false);
            queryClient.invalidateQueries({ queryKey: getListStockMovementsQueryKey() });
          }}
          productId={null}
          productName={null}
          currentStock={null}
          initialType="IN"
        />
      )}
    </div>
  );
}
