import { useGetDashboardSummary, useGetLowStockProducts, useGetRecentMovements, useGetStockByCategory, customFetch } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, AlertTriangle, ArrowRightLeft, Activity, TrendingUp, PieChart as PieIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from "recharts";

type DayBucket = { date: string; IN: number; OUT: number };

function useMovementsByDay(from: string, to: string) {
  return useQuery<DayBucket[]>({
    queryKey: ["dashboard", "movements-by-day", from, to],
    queryFn: () => customFetch<DayBucket[]>(`/api/dashboard/movements-by-day?from=${from}&to=${to}`),
  });
}

const COLORS = ["#ea580c", "#f97316", "#fb923c", "#fdba74", "#ffd7b5", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#1d4ed8", "#7c3aed", "#a855f7"];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded px-3 py-2 text-xs font-mono shadow-lg">
        {label && <p className="text-muted-foreground uppercase mb-1">{label}</p>}
        {payload.map((entry: any, i: number) => (
          <p key={i} style={{ color: entry.color || entry.fill }} className="font-bold">
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const CustomPieLegend = ({ payload }: any) => (
  <ul className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-2">
    {payload?.map((entry: any, i: number) => (
      <li key={i} className="flex items-center gap-1.5 text-xs font-mono">
        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: entry.color }} />
        <span className="text-muted-foreground">{entry.value}</span>
      </li>
    ))}
  </ul>
);

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();
  const { data: lowStock, isLoading: loadingLowStock } = useGetLowStockProducts();
  const { data: recent, isLoading: loadingRecent } = useGetRecentMovements({ limit: 20 });
  const { data: byCategory, isLoading: loadingCategory } = useGetStockByCategory();
  const today = new Date();
  const chartFrom = new Date(today);
  chartFrom.setUTCDate(chartFrom.getUTCDate() - 6);
  const chartFromDate = chartFrom.toISOString().slice(0, 10);
  const chartToDate = today.toISOString().slice(0, 10);
  const { data: rawByDay, isLoading: loadingChartMovements } = useMovementsByDay(chartFromDate, chartToDate);

  const mvtByDate = (rawByDay ?? []).map((d) => ({
    key: d.date,
    date: format(new Date(`${d.date}T00:00:00Z`), "dd/MM", { locale: fr }),
    IN: d.IN,
    OUT: d.OUT,
  })).sort((a, b) => a.key.localeCompare(b.key));

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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
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
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Quantites Aujourd'hui</CardTitle>
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart: Entrées vs Sorties */}
        <Card className="bg-card border-border">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Entrees / Sorties - 7 jours
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {loadingChartMovements ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm uppercase animate-pulse">Chargement...</div>
            ) : mvtByDate.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm uppercase">Aucun mouvement récent</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={mvtByDate} barGap={4}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: "monospace", fill: "#6b7280" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fontFamily: "monospace", fill: "#6b7280" }} axisLine={false} tickLine={false} width={35} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="IN" name="Entrées" fill="#22c55e" radius={[3, 3, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="OUT" name="Sorties" fill="#f97316" radius={[3, 3, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            )}
            <div className="flex gap-4 justify-center mt-2">
              <span className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                <span className="w-3 h-3 rounded-sm bg-green-500" /> Entrées
              </span>
              <span className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                <span className="w-3 h-3 rounded-sm bg-orange-500" /> Sorties
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Pie Chart: Stock par catégorie */}
        <Card className="bg-card border-border">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <PieIcon className="h-4 w-4 text-primary" />
              Stock par catégorie
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {loadingCategory ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm uppercase animate-pulse">Chargement...</div>
            ) : !byCategory?.length ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm uppercase">Aucune donnée</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={byCategory}
                    dataKey="totalQuantity"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                    innerRadius={35}
                    paddingAngle={2}
                  >
                    {byCategory.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} formatter={(v: any, n: any) => [v, n]} />
                  <Legend content={<CustomPieLegend />} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alerts + Recent Movements */}
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
                {recent.slice(0, 8).map(m => (
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
                    <div className="font-bold font-mono">{m.quantity}</div>
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
