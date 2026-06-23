import { useState, useMemo } from "react";
import { useListStockMovements, useListUsers, useListProducts } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ClipboardList, ArrowUp, ArrowDown, User, TrendingUp, TrendingDown, Activity } from "lucide-react";

export default function Audit() {
  const [userFilter, setUserFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const params: Record<string, string | number> = { limit: 200 };
  if (typeFilter !== "all") params.type = typeFilter;
  if (productFilter !== "all") params.product_id = parseInt(productFilter);
  if (fromDate) params.from_date = fromDate;
  if (toDate) params.to_date = toDate;
  if (userFilter !== "all") params.created_by_id = parseInt(userFilter);

  const { data: movements, isLoading } = useListStockMovements(params as any);
  const { data: users } = useListUsers();
  const { data: products } = useListProducts({});

  const userStats = useMemo(() => {
    if (!movements) return [];
    const map: Record<number, { id: number; name: string; totalIn: number; totalOut: number; count: number }> = {};
    movements.forEach((m) => {
      if (!map[m.createdById]) {
        map[m.createdById] = { id: m.createdById, name: m.createdByName ?? "Inconnu", totalIn: 0, totalOut: 0, count: 0 };
      }
      map[m.createdById].count += 1;
      if (m.type === "IN") map[m.createdById].totalIn += m.quantity;
      else map[m.createdById].totalOut += m.quantity;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [movements]);

  const resetFilters = () => {
    setUserFilter("all");
    setProductFilter("all");
    setTypeFilter("all");
    setFromDate("");
    setToDate("");
  };

  const hasFilters = userFilter !== "all" || productFilter !== "all" || typeFilter !== "all" || fromDate || toDate;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight flex items-center gap-3">
            <ClipboardList className="h-7 w-7 text-primary" />
            Traçabilité
          </h1>
          <p className="text-muted-foreground text-sm uppercase tracking-wider mt-1">
            Historique complet des actions par utilisateur
          </p>
        </div>
        <div className="text-xs font-mono bg-card border border-border rounded-sm px-3 py-1.5 text-muted-foreground">
          {movements?.length ?? 0} entrée{(movements?.length ?? 0) !== 1 ? "s" : ""} affichée{(movements?.length ?? 0) !== 1 ? "s" : ""}
        </div>
      </div>

      {/* User activity summary cards */}
      {!isLoading && userStats.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {userStats.map((u) => (
            <Card
              key={u.id}
              className={`bg-card border-border cursor-pointer transition-all hover:border-primary/50 ${userFilter === String(u.id) ? "border-primary ring-1 ring-primary/30" : ""}`}
              onClick={() => setUserFilter(userFilter === String(u.id) ? "all" : String(u.id))}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-sm bg-primary/15 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <div className="font-bold text-sm leading-tight uppercase">{u.name}</div>
                      <div className="text-xs text-muted-foreground">{u.count} opération{u.count !== 1 ? "s" : ""}</div>
                    </div>
                  </div>
                  <Activity className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                </div>
                <div className="flex gap-3 mt-3">
                  <div className="flex items-center gap-1.5 text-xs font-mono">
                    <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                    <span className="text-green-500 font-bold">+{u.totalIn}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-mono">
                    <TrendingDown className="h-3.5 w-3.5 text-orange-500" />
                    <span className="text-orange-500 font-bold">-{u.totalOut}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border pb-3 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Filtres</CardTitle>
            {hasFilters && (
              <button onClick={resetFilters} className="text-xs text-primary hover:underline font-mono uppercase">
                Effacer tout
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue placeholder="Utilisateur" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les utilisateurs</SelectItem>
                {users?.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>{u.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={productFilter} onValueChange={setProductFilter}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue placeholder="Produit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les produits</SelectItem>
                {products?.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Entrées + Sorties</SelectItem>
                <SelectItem value="IN">Entrées seulement</SelectItem>
                <SelectItem value="OUT">Sorties seulement</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-background border-border text-sm"
              placeholder="Depuis"
            />
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-background border-border text-sm"
              placeholder="Jusqu'au"
            />
          </div>
        </CardContent>
      </Card>

      {/* Movements table */}
      {isLoading ? (
        <div className="text-muted-foreground uppercase text-sm animate-pulse p-8 font-mono">Chargement de l'historique...</div>
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            {movements && movements.length > 0 ? (
              <>
                {/* Table header */}
                <div className="hidden md:grid grid-cols-[40px_1fr_120px_140px_160px_160px] gap-4 px-4 py-2 border-b border-border bg-muted/30">
                  <div />
                  <div className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Produit / Motif</div>
                  <div className="text-xs font-bold uppercase text-muted-foreground tracking-wider text-right">Quantité</div>
                  <div className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Projet</div>
                  <div className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Opérateur</div>
                  <div className="text-xs font-bold uppercase text-muted-foreground tracking-wider text-right">Date / Heure</div>
                </div>

                <div className="divide-y divide-border">
                  {movements.map((m) => (
                    <div
                      key={m.id}
                      className="flex flex-col md:grid md:grid-cols-[40px_1fr_120px_140px_160px_160px] md:items-center gap-2 md:gap-4 px-4 py-3 hover:bg-muted/20 transition-colors"
                    >
                      {/* Icon */}
                      <div className={`flex h-8 w-8 items-center justify-center rounded-sm shrink-0 ${m.type === "IN" ? "bg-green-500/15" : "bg-orange-500/15"}`}>
                        {m.type === "IN"
                          ? <ArrowUp className="h-4 w-4 text-green-500" />
                          : <ArrowDown className="h-4 w-4 text-orange-500" />
                        }
                      </div>

                      {/* Product + reason */}
                      <div className="min-w-0">
                        <div className="font-bold text-foreground text-sm truncate">{m.productName}</div>
                        <div className="text-xs text-muted-foreground truncate">{m.reason}</div>
                      </div>

                      {/* Quantity */}
                      <div className={`font-bold font-mono text-lg text-right ${m.type === "IN" ? "text-green-500" : "text-orange-500"}`}>
                        {m.type === "IN" ? "+" : "-"}{m.quantity}
                      </div>

                      {/* Project */}
                      <div>
                        {m.projectName
                          ? <Badge variant="outline" className="font-mono text-xs border-primary/40 text-primary truncate max-w-[130px]">{m.projectName}</Badge>
                          : <span className="text-xs text-muted-foreground font-mono">—</span>
                        }
                      </div>

                      {/* Operator */}
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-sm bg-primary/10 flex items-center justify-center shrink-0">
                          <User className="h-3 w-3 text-primary" />
                        </div>
                        <span className="text-sm font-medium uppercase truncate">{m.createdByName ?? "—"}</span>
                      </div>

                      {/* Date */}
                      <div className="text-right text-xs text-muted-foreground font-mono">
                        <div className="font-bold text-foreground">{format(new Date(m.createdAt), "dd MMM yyyy", { locale: fr })}</div>
                        <div>{format(new Date(m.createdAt), "HH:mm:ss")}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground font-mono uppercase bg-muted/20">
                  {movements.length} entrée{movements.length !== 1 ? "s" : ""} affichée{movements.length !== 1 ? "s" : ""}
                  {movements.length === 200 && " — Limite atteinte, affinez vos filtres pour voir plus"}
                </div>
              </>
            ) : (
              <div className="p-16 text-center">
                <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground uppercase text-sm font-mono">Aucune opération trouvée</p>
                {hasFilters && (
                  <button onClick={resetFilters} className="mt-3 text-xs text-primary hover:underline font-mono uppercase">
                    Effacer les filtres
                  </button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
