import { useGetDashboardSummary, useGetLowStockProducts, useGetRecentMovements } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, AlertTriangle, ArrowRightLeft, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();
  const { data: lowStock, isLoading: loadingLowStock } = useGetLowStockProducts();
  const { data: recent, isLoading: loadingRecent } = useGetRecentMovements();

  if (loadingSummary) {
    return <div className="p-8 text-muted-foreground animate-pulse font-mono uppercase">Chargement des données...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight text-foreground">Tableau de Bord</h1>
          <p className="text-muted-foreground text-sm uppercase tracking-wider mt-1">Aperçu en temps réel du stock</p>
        </div>
        <div className="text-xs text-muted-foreground font-mono bg-card px-3 py-1 rounded-sm border border-border">
          STATUS: <span className="text-green-500 font-bold">ONLINE</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Total Produits</CardTitle>
            <Package className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summary?.totalProducts || 0}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-destructive">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase text-destructive">Stock Critique</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{summary?.lowStockCount || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Mouvements (Aujourd'hui)</CardTitle>
            <ArrowRightLeft className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              <span className="text-green-500">+{summary?.todayMovementsIn || 0}</span>
              <span className="text-muted-foreground mx-2">/</span>
              <span className="text-orange-500">-{summary?.todayMovementsOut || 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Projets Actifs</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{summary?.activeProjects || 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border flex flex-col">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Produits en Alerte
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            {loadingLowStock ? (
              <div className="p-4 text-sm text-muted-foreground uppercase">Analyse en cours...</div>
            ) : lowStock && lowStock.length > 0 ? (
              <div className="divide-y divide-border">
                {lowStock.map(p => (
                  <div key={p.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                    <div>
                      <div className="font-bold text-foreground">{p.name}</div>
                      <div className="text-xs text-muted-foreground uppercase">{p.category}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-destructive">{p.quantityInStock} {p.unit}</div>
                      <div className="text-xs text-muted-foreground uppercase">Seuil: {p.minimumThreshold}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground uppercase text-sm">Aucun produit en rupture</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border flex flex-col">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-primary" />
              Derniers Mouvements
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            {loadingRecent ? (
              <div className="p-4 text-sm text-muted-foreground uppercase">Chargement de l'historique...</div>
            ) : recent && recent.length > 0 ? (
              <div className="divide-y divide-border">
                {recent.map(m => (
                  <div key={m.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Badge variant={m.type === "IN" ? "default" : "secondary"} className={`font-mono font-bold ${m.type === 'IN' ? 'bg-green-500/20 text-green-500 border-green-500/50' : 'bg-orange-500/20 text-orange-500 border-orange-500/50'}`}>
                        {m.type === "IN" ? "+ IN" : "- OUT"}
                      </Badge>
                      <div>
                        <div className="font-bold text-foreground text-sm">{m.productName}</div>
                        <div className="text-xs text-muted-foreground">{format(new Date(m.createdAt), "dd MMM HH:mm", { locale: fr })} par {m.createdByName}</div>
                      </div>
                    </div>
                    <div className="font-bold font-mono">
                      {m.quantity}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground uppercase text-sm">Aucun mouvement récent</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
