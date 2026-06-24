import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useGetProduct, useGetMe, useCreateStockMovement, useListProjects } from "@workspace/api-client-react";
import { useAuthStore } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListProductsQueryKey,
  getListStockMovementsQueryKey,
  getGetProductQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetRecentMovementsQueryKey,
  getGetLowStockProductsQueryKey,
} from "@workspace/api-client-react";
import { HardHat, ArrowUp, ArrowDown, CheckCircle2, XCircle, Package, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ScreenState = "form" | "success" | "error";

const NONE_PROJECT = "__none__";

function useProductIdFromUrl(): number | null {
  const search = window.location.search;
  const params = new URLSearchParams(search);
  const raw = params.get("product_id");
  const n = raw ? parseInt(raw) : NaN;
  return isNaN(n) ? null : n;
}

export default function ScanPage() {
  const [, setLocation] = useLocation();
  const { token } = useAuthStore();
  const productId = useProductIdFromUrl();

  const { data: product, isLoading: loadingProduct } = useGetProduct(productId ?? 0, {
    query: { enabled: !!productId && !!token } as any,
  });
  const { data: me } = useGetMe({ query: { enabled: !!token } as any });
  const { data: projects } = useListProjects({}, { query: { enabled: !!token } as any });
  const createMovement = useCreateStockMovement();
  const queryClient = useQueryClient();

  const [type, setType] = useState<"IN" | "OUT">("OUT");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [projectId, setProjectId] = useState(NONE_PROJECT);
  const [screen, setScreen] = useState<ScreenState>("form");
  const [errorMsg, setErrorMsg] = useState("");
  const [confirmedQty, setConfirmedQty] = useState(0);
  const [confirmedType, setConfirmedType] = useState<"IN" | "OUT">("OUT");

  useEffect(() => {
    if (!token) {
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const returnTo = window.location.pathname + window.location.search;
      setLocation(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    }
  }, [token, setLocation]);

  const handleSubmit = () => {
    if (!me || !product) return;
    const qty = parseInt(quantity);
    if (!qty || qty < 1) return;
    if (!reason.trim()) return;
    if (type === "OUT" && qty > product.quantityInStock) return;

    const resolvedProject = projectId !== NONE_PROJECT ? parseInt(projectId) : null;

    createMovement.mutate({
      data: {
        productId: product.id,
        type,
        quantity: qty,
        reason: reason.trim(),
        projectId: resolvedProject,
        createdById: me.id,
      },
    }, {
      onSuccess: () => {
        setConfirmedQty(qty);
        setConfirmedType(type);
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListStockMovementsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetRecentMovementsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetLowStockProductsQueryKey() });
        if (product.id) {
          queryClient.invalidateQueries({ queryKey: getGetProductQueryKey(product.id) });
        }
        setScreen("success");
      },
      onError: (err: any) => {
        setErrorMsg(err?.data?.error ?? "Erreur lors de l'enregistrement");
        setScreen("error");
      },
    });
  };

  const isOutOfStock = type === "OUT" && product && parseInt(quantity) > product.quantityInStock;
  const canSubmit = reason.trim().length > 0 && parseInt(quantity) >= 1 && !isOutOfStock && !createMovement.isPending && !!me && !!product;

  if (!token) return null;

  return (
    <div className="min-h-screen bg-background font-mono flex flex-col">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <div className="h-8 w-8 rounded-sm bg-primary/15 flex items-center justify-center">
          <HardHat className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="font-bold text-sm uppercase tracking-wider text-primary">STOCK BTP</div>
          <div className="text-xs text-muted-foreground uppercase">Scan rapide</div>
        </div>
        <div className="ml-auto">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground uppercase"
            onClick={() => setLocation("/")}
          >
            Dashboard
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col px-4 py-6 gap-5 max-w-md mx-auto w-full">

        {/* Loading */}
        {loadingProduct && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <div className="text-muted-foreground uppercase text-sm">Chargement du produit...</div>
          </div>
        )}

        {/* Product not found */}
        {!loadingProduct && !product && productId && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <Package className="h-14 w-14 text-muted-foreground" />
            <div className="text-lg font-bold uppercase">Produit introuvable</div>
            <div className="text-sm text-muted-foreground">L'ID produit {productId} n'existe pas.</div>
          </div>
        )}

        {/* No product_id */}
        {!productId && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <Package className="h-14 w-14 text-muted-foreground" />
            <div className="text-lg font-bold uppercase">QR Code invalide</div>
            <div className="text-sm text-muted-foreground">Aucun produit spécifié dans l'URL.</div>
          </div>
        )}

        {/* SUCCESS */}
        {screen === "success" && product && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center">
            <div className={`h-20 w-20 rounded-full flex items-center justify-center ${confirmedType === "IN" ? "bg-green-500/20" : "bg-orange-500/20"}`}>
              <CheckCircle2 className={`h-12 w-12 ${confirmedType === "IN" ? "text-green-500" : "text-orange-500"}`} />
            </div>
            <div>
              <div className="text-2xl font-bold uppercase">Enregistré !</div>
              <div className={`text-4xl font-bold font-mono mt-2 ${confirmedType === "IN" ? "text-green-500" : "text-orange-500"}`}>
                {confirmedType === "IN" ? "+" : "-"}{confirmedQty}
              </div>
              <div className="text-muted-foreground uppercase text-sm mt-1">{product.name}</div>
            </div>
            <div className="flex flex-col gap-3 w-full">
              <Button
                className="w-full uppercase font-bold h-14 text-base"
                onClick={() => {
                  setScreen("form");
                  setQuantity("1");
                  setReason("");
                  setProjectId(NONE_PROJECT);
                }}
              >
                Nouveau mouvement
              </Button>
              <Button
                variant="outline"
                className="w-full uppercase font-bold border-border"
                onClick={() => setLocation("/")}
              >
                Retour au dashboard
              </Button>
            </div>
          </div>
        )}

        {/* ERROR */}
        {screen === "error" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center">
            <div className="h-20 w-20 rounded-full bg-destructive/15 flex items-center justify-center">
              <XCircle className="h-12 w-12 text-destructive" />
            </div>
            <div>
              <div className="text-2xl font-bold uppercase">Erreur</div>
              <div className="text-sm text-muted-foreground mt-2">{errorMsg}</div>
            </div>
            <div className="flex flex-col gap-3 w-full">
              <Button className="w-full uppercase font-bold h-12" onClick={() => setScreen("form")}>
                Réessayer
              </Button>
              <Button variant="outline" className="w-full uppercase font-bold border-border" onClick={() => setLocation("/")}>
                Retour
              </Button>
            </div>
          </div>
        )}

        {/* FORM */}
        {screen === "form" && !loadingProduct && product && (
          <>
            {/* Product card */}
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="text-xs text-muted-foreground uppercase mb-1">Produit scanné</div>
              <div className="font-bold text-xl uppercase">{product.name}</div>
              <div className="text-sm text-muted-foreground uppercase mt-0.5">{product.category}</div>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <div className="text-xs text-muted-foreground uppercase">Stock actuel</div>
                  <div className={`text-3xl font-bold font-mono ${product.quantityInStock < product.minimumThreshold ? "text-destructive" : "text-foreground"}`}>
                    {product.quantityInStock}
                    <span className="text-sm font-normal text-muted-foreground ml-1">{product.unit}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground uppercase">Seuil min</div>
                  <div className="text-lg font-bold font-mono text-muted-foreground">{product.minimumThreshold} {product.unit}</div>
                </div>
              </div>
              {product.quantityInStock < product.minimumThreshold && (
                <div className="mt-2 text-xs text-destructive font-bold uppercase animate-pulse">
                  ⚠ Stock en dessous du seuil minimum
                </div>
              )}
            </div>

            {/* Type toggle */}
            <div>
              <div className="text-xs text-muted-foreground uppercase font-bold mb-2">Type de mouvement</div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setType("IN")}
                  className={`h-16 rounded-lg border-2 flex flex-col items-center justify-center gap-1 transition-all font-bold uppercase text-sm ${
                    type === "IN"
                      ? "border-green-500 bg-green-500/20 text-green-500"
                      : "border-border bg-card text-muted-foreground hover:border-green-500/50"
                  }`}
                >
                  <ArrowUp className="h-6 w-6" />
                  Entrée IN
                </button>
                <button
                  type="button"
                  onClick={() => setType("OUT")}
                  className={`h-16 rounded-lg border-2 flex flex-col items-center justify-center gap-1 transition-all font-bold uppercase text-sm ${
                    type === "OUT"
                      ? "border-orange-500 bg-orange-500/20 text-orange-500"
                      : "border-border bg-card text-muted-foreground hover:border-orange-500/50"
                  }`}
                >
                  <ArrowDown className="h-6 w-6" />
                  Sortie OUT
                </button>
              </div>
            </div>

            {/* Quantity */}
            <div>
              <div className="text-xs text-muted-foreground uppercase font-bold mb-2">
                Quantité ({product.unit})
              </div>
              <div className="flex gap-3 items-center">
                <button
                  type="button"
                  onClick={() => setQuantity(q => String(Math.max(1, parseInt(q) - 1)))}
                  className="h-14 w-14 rounded-lg border-2 border-border bg-card text-2xl font-bold flex items-center justify-center hover:border-primary/50 transition-all shrink-0"
                >
                  −
                </button>
                <Input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="flex-1 h-14 text-center text-2xl font-bold font-mono bg-card border-border"
                />
                <button
                  type="button"
                  onClick={() => setQuantity(q => String(parseInt(q) + 1))}
                  className="h-14 w-14 rounded-lg border-2 border-border bg-card text-2xl font-bold flex items-center justify-center hover:border-primary/50 transition-all shrink-0"
                >
                  +
                </button>
              </div>
              {isOutOfStock && (
                <div className="mt-2 text-xs text-destructive font-bold uppercase">
                  ✗ Stock insuffisant — disponible : {product.quantityInStock} {product.unit}
                </div>
              )}
            </div>

            {/* Reason */}
            <div>
              <div className="text-xs text-muted-foreground uppercase font-bold mb-2">Motif</div>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex: Chantier Route N5, Livraison..."
                className="h-12 bg-card border-border text-sm"
              />
            </div>

            {/* Project */}
            <div>
              <div className="text-xs text-muted-foreground uppercase font-bold mb-2">Projet (optionnel)</div>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="h-12 bg-card border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_PROJECT}>Aucun projet</SelectItem>
                  {projects?.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Submit */}
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`w-full h-16 text-base font-bold uppercase rounded-lg transition-all ${
                type === "IN"
                  ? "bg-green-500 hover:bg-green-600 text-white"
                  : "bg-orange-500 hover:bg-orange-600 text-white"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {createMovement.isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Enregistrement...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {type === "IN" ? <ArrowUp className="h-6 w-6" /> : <ArrowDown className="h-6 w-6" />}
                  Confirmer {type === "IN" ? "Entrée" : "Sortie"}
                </span>
              )}
            </Button>

            {/* Operator */}
            {me && (
              <div className="text-center text-xs text-muted-foreground font-mono uppercase pb-2">
                Opérateur : {me.fullName}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
