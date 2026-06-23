import { useParams, useLocation } from "wouter";
import {
  useGetProduct, useListStockMovements, getListProductsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowUp, ArrowDown, Package } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import MovementDialog from "@/components/MovementDialog";
import { useQueryClient } from "@tanstack/react-query";
import { getGetProductQueryKey, getListStockMovementsQueryKey } from "@workspace/api-client-react";

export default function ProductDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0", 10);
  const [, setLocation] = useLocation();
  const [movementOpen, setMovementOpen] = useState(false);
  const [movementType, setMovementType] = useState<"IN" | "OUT">("IN");
  const queryClient = useQueryClient();

  const { data: product, isLoading } = useGetProduct(id, { query: { enabled: !!id, queryKey: getGetProductQueryKey(id) } });
  const { data: movements, isLoading: loadingMovements } = useListStockMovements(
    { product_id: id },
    { query: { enabled: !!id, queryKey: getListStockMovementsQueryKey({ product_id: id }) } }
  );

  if (isLoading) return <div className="p-8 text-muted-foreground uppercase animate-pulse">Chargement...</div>;
  if (!product) return <div className="p-8 text-muted-foreground uppercase">Produit introuvable</div>;

  const isLow = product.quantityInStock < product.minimumThreshold;
  const locationLabels: Record<string, string> = { warehouse: "Entrepôt", site: "Chantier", project: "Projet" };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/products")} className="uppercase text-xs">
          <ArrowLeft className="h-4 w-4 mr-2" /> Retour
        </Button>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold uppercase tracking-tight">{product.name}</h1>
            {isLow && <Badge variant="destructive" className="uppercase text-xs">Stock Critique</Badge>}
          </div>
          <p className="text-muted-foreground text-sm uppercase tracking-wider mt-1">
            {product.category} · {locationLabels[product.location]}
          </p>
        </div>
        <div className="flex gap-2">
          <Button className="bg-green-500/15 border border-green-500/30 text-green-500 hover:bg-green-500/25 uppercase font-bold text-xs"
            onClick={() => { setMovementType("IN"); setMovementOpen(true); }}
            data-testid="button-product-in">
            <ArrowUp className="h-4 w-4 mr-2" /> Entrée IN
          </Button>
          <Button className="bg-orange-500/15 border border-orange-500/30 text-orange-500 hover:bg-orange-500/25 uppercase font-bold text-xs"
            onClick={() => { setMovementType("OUT"); setMovementOpen(true); }}
            data-testid="button-product-out">
            <ArrowDown className="h-4 w-4 mr-2" /> Sortie OUT
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase mb-1">Stock Actuel</div>
            <div className={`text-3xl font-bold font-mono ${isLow ? "text-destructive" : "text-foreground"}`}>
              {product.quantityInStock}
            </div>
            <div className="text-xs text-muted-foreground uppercase">{product.unit}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase mb-1">Seuil Min</div>
            <div className="text-3xl font-bold font-mono">{product.minimumThreshold}</div>
            <div className="text-xs text-muted-foreground uppercase">{product.unit}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase mb-1">Unité</div>
            <div className="text-2xl font-bold uppercase">{product.unit}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase mb-1">Emplacement</div>
            <div className="text-lg font-bold uppercase">{locationLabels[product.location]}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-sm font-bold uppercase tracking-wider">Historique des mouvements</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingMovements ? (
            <div className="p-4 text-muted-foreground uppercase text-sm animate-pulse">Chargement...</div>
          ) : movements && movements.length > 0 ? (
            <div className="divide-y divide-border">
              {movements.map(m => (
                <div key={m.id} className="p-4 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-sm shrink-0 ${m.type === "IN" ? "bg-green-500/15" : "bg-orange-500/15"}`}>
                      {m.type === "IN" ? <ArrowUp className="h-4 w-4 text-green-500" /> : <ArrowDown className="h-4 w-4 text-orange-500" />}
                    </div>
                    <div>
                      <div className="text-sm font-bold">{m.reason}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(m.createdAt), "dd MMM yyyy HH:mm", { locale: fr })} · {m.createdByName}
                        {m.projectName && ` · ${m.projectName}`}
                      </div>
                    </div>
                  </div>
                  <div className={`font-bold font-mono text-lg ${m.type === "IN" ? "text-green-500" : "text-orange-500"}`}>
                    {m.type === "IN" ? "+" : "-"}{m.quantity}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground uppercase text-sm">Aucun mouvement</div>
          )}
        </CardContent>
      </Card>

      {movementOpen && (
        <MovementDialog
          open={movementOpen}
          onClose={() => {
            setMovementOpen(false);
            queryClient.invalidateQueries({ queryKey: getGetProductQueryKey(id) });
            queryClient.invalidateQueries({ queryKey: getListStockMovementsQueryKey({ product_id: id }) });
            queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          }}
          productId={product.id}
          productName={product.name}
          currentStock={product.quantityInStock}
          initialType={movementType}
        />
      )}
    </div>
  );
}
