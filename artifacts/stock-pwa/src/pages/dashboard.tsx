import {
  useGetDashboardSummary,
  useGetLowStockProducts,
  useGetRecentMovements,
  useGetStockByCategory,
  customFetch,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from "recharts";
import {
  Package, AlertTriangle, TrendingUp, TrendingDown,
  ArrowDownCircle, ArrowUpCircle, Activity, FolderOpen,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth";
import { useCompany } from "@/contexts/CompanyContext";
import { OnlineStatusBadge } from "@/components/OnlineStatusBadge";
import { cn } from "@/lib/utils";

/* ─── Types ─────────────────────────────────────────────────── */
type DayBucket = { date: string; IN: number; OUT: number };

function useMovementsByDay(from: string, to: string) {
  return useQuery<DayBucket[]>({
    queryKey: ["dashboard", "movements-by-day", from, to],
    queryFn: () =>
      customFetch<DayBucket[]>(
        `/api/dashboard/movements-by-day?from=${from}&to=${to}`,
      ),
  });
}

/* ─── Palette catégories ─────────────────────────────────────── */
const CAT_COLORS = [
  "#6366f1", "#f97316", "#22c55e", "#eab308",
  "#3b82f6", "#ec4899", "#14b8a6", "#a855f7",
  "#ef4444", "#84cc16",
];

/* ─── Tooltip custom ─────────────────────────────────────────── */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-xl px-3 py-2 text-xs shadow-xl">
      {label && (
        <p className="text-muted-foreground mb-1.5 font-medium">{label}</p>
      )}
      {payload.map((e: any, i: number) => (
        <p key={i} style={{ color: e.color || e.fill }} className="font-semibold">
          {e.name}: {e.value}
        </p>
      ))}
    </div>
  );
}

/* ─── KPI Card ───────────────────────────────────────────────── */
interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  sub?: React.ReactNode;
  loading?: boolean;
  alert?: boolean;
}
function KpiCard({
  label, value, icon: Icon, iconBg, iconColor, sub, loading, alert,
}: KpiCardProps) {
  return (
    <div
      className={cn(
        "bg-card rounded-2xl p-5 flex items-center gap-4 shadow-sm border",
        alert ? "border-destructive/30" : "border-border/60",
      )}
    >
      <div
        className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
          iconBg,
        )}
      >
        <Icon className={cn("w-6 h-6", iconColor)} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider truncate">
          {label}
        </p>
        {loading ? (
          <Skeleton className="h-8 w-20 mt-1" />
        ) : (
          <p
            className={cn(
              "text-2xl font-bold leading-tight mt-0.5",
              alert ? "text-destructive" : "text-foreground",
            )}
          >
            {value}
          </p>
        )}
        {sub && !loading && (
          <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
        )}
      </div>
    </div>
  );
}

/* ─── Section header ─────────────────────────────────────────── */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold text-foreground">{children}</h2>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const { user } = useAuthStore();
  const company = useCompany();

  /* ── Data ─────────────────────────────────────────────────── */
  const {
    data: summary, isLoading: loadingSummary, isError: errorSummary,
  } = useGetDashboardSummary();
  const { data: lowStock, isLoading: loadingLowStock } = useGetLowStockProducts();
  const { data: recent, isLoading: loadingRecent } = useGetRecentMovements({ limit: 10 });
  const { data: byCategory, isLoading: loadingCategory } = useGetStockByCategory();

  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);
  const { data: rawByDay, isLoading: loadingByDay } = useMovementsByDay(
    sevenDaysAgo.toISOString().slice(0, 10),
    today.toISOString().slice(0, 10),
  );

  /* ── Chart data ───────────────────────────────────────────── */
  const areaData = (rawByDay ?? [])
    .map((d) => ({
      key: d.date,
      jour: format(new Date(`${d.date}T00:00:00Z`), "EEE dd", { locale: fr }),
      Entrées: d.IN,
      Sorties: d.OUT,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  const totalIn7 = areaData.reduce((s, d) => s + d.Entrées, 0);
  const totalOut7 = areaData.reduce((s, d) => s + d.Sorties, 0);

  /* ── Error state ──────────────────────────────────────────── */
  if (errorSummary) {
    return (
      <div className="flex flex-col items-center gap-3 p-16 text-center">
        <AlertTriangle className="w-10 h-10 text-destructive" />
        <p className="text-destructive font-semibold">
          Impossible de charger le tableau de bord
        </p>
        <button
          onClick={() => window.location.reload()}
          className="text-xs text-primary hover:underline"
        >
          Réessayer
        </button>
      </div>
    );
  }

  /* ── Greeting ─────────────────────────────────────────────── */
  const hour = today.getHours();
  const greeting =
    hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";
  const firstName = user?.fullName?.split(" ")[0] ?? "";

  return (
    <div className="space-y-6 pb-8">

      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {greeting}{firstName ? `, ${firstName}` : ""} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {company?.name ?? "Stock BTP"} —{" "}
            {format(today, "EEEE d MMMM yyyy", { locale: fr })}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-card border border-border/60 rounded-xl px-3 py-1.5 self-start sm:self-auto">
          <OnlineStatusBadge />
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Total produits"
          value={summary?.totalProducts ?? 0}
          icon={Package}
          iconBg="bg-indigo-500/10"
          iconColor="text-indigo-500"
          sub="références en stock"
          loading={loadingSummary}
        />
        <KpiCard
          label="Stock critique"
          value={summary?.lowStockCount ?? 0}
          icon={AlertTriangle}
          iconBg="bg-destructive/10"
          iconColor="text-destructive"
          sub={
            (summary?.lowStockCount ?? 0) > 0
              ? "produits sous le seuil"
              : "aucune alerte"
          }
          loading={loadingSummary}
          alert={(summary?.lowStockCount ?? 0) > 0}
        />
        <KpiCard
          label="Entrées aujourd'hui"
          value={
            <span className="text-emerald-500">
              +{summary?.todayMovementsIn ?? 0}
            </span>
          }
          icon={ArrowDownCircle}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-500"
          sub={`${totalIn7} sur 7 jours`}
          loading={loadingSummary}
        />
        <KpiCard
          label="Sorties aujourd'hui"
          value={
            <span className="text-orange-500">
              -{summary?.todayMovementsOut ?? 0}
            </span>
          }
          icon={ArrowUpCircle}
          iconBg="bg-orange-500/10"
          iconColor="text-orange-500"
          sub={`${totalOut7} sur 7 jours`}
          loading={loadingSummary}
        />
      </div>

      {/* ── Charts row ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Area chart — Entrées / Sorties 7 jours */}
        <div className="lg:col-span-2 bg-card border border-border/60 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <SectionTitle>Mouvements — 7 derniers jours</SectionTitle>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
                Entrées
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block" />
                Sorties
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Quantités réelles enregistrées dans l'app
          </p>
          {loadingByDay ? (
            <Skeleton className="h-[200px] w-full rounded-xl" />
          ) : areaData.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
              Aucun mouvement cette semaine
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={areaData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="gradIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="jour"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false} tickLine={false} width={28}
                  allowDecimals={false}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone" dataKey="Entrées" stroke="#6366f1"
                  strokeWidth={2.5} fill="url(#gradIn)" dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
                <Area
                  type="monotone" dataKey="Sorties" stroke="#f97316"
                  strokeWidth={2.5} fill="url(#gradOut)" dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Donut — Stock par catégorie */}
        <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm flex flex-col">
          <SectionTitle>Stock par catégorie</SectionTitle>
          <p className="text-xs text-muted-foreground mb-3 mt-0.5">
            Répartition des quantités réelles
          </p>
          {loadingCategory ? (
            <div className="flex-1 flex items-center justify-center">
              <Skeleton className="h-36 w-36 rounded-full" />
            </div>
          ) : !byCategory?.length ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Aucune donnée
            </div>
          ) : (
            <div className="flex-1">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={byCategory}
                    dataKey="totalQuantity"
                    nameKey="category"
                    cx="50%" cy="50%"
                    outerRadius={65} innerRadius={30}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {byCategory.map((_, i) => (
                      <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="space-y-1.5 mt-1">
                {byCategory.slice(0, 6).map((cat, i) => {
                  const total = byCategory.reduce((s, c) => s + c.totalQuantity, 0);
                  const pct = total > 0 ? Math.round((cat.totalQuantity / total) * 100) : 0;
                  return (
                    <li key={i} className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-1.5 truncate">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: CAT_COLORS[i % CAT_COLORS.length] }}
                        />
                        <span className="text-muted-foreground truncate">{cat.category}</span>
                      </span>
                      <span className="font-semibold text-foreground shrink-0">{pct}%</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom row ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Stacked bar — comparaison entrées/sorties par jour */}
        <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <SectionTitle>Comparaison Entrées / Sorties</SectionTitle>
          </div>
          <p className="text-xs text-muted-foreground mb-4 mt-0.5">
            Vue empilée sur 7 jours
          </p>
          {loadingByDay ? (
            <Skeleton className="h-[180px] w-full rounded-xl" />
          ) : areaData.length === 0 ? (
            <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground">
              Aucun mouvement
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={areaData} barSize={20} margin={{ top: 0, right: 4, bottom: 0, left: -20 }}>
                <XAxis
                  dataKey="jour"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false} tickLine={false} width={28}
                  allowDecimals={false}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="Entrées" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Sorties" stackId="a" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="flex gap-4 mt-3">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block" />
              Entrées ({totalIn7})
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-sm bg-orange-400 inline-block" />
              Sorties ({totalOut7})
            </span>
          </div>
        </div>

        {/* Table — Derniers mouvements */}
        <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle>Derniers mouvements</SectionTitle>
            {recent && recent.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {recent.length} récents
              </span>
            )}
          </div>
          {loadingRecent ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : !recent?.length ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Aucun mouvement
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left text-muted-foreground font-medium pb-2 pr-2">Produit</th>
                    <th className="text-center text-muted-foreground font-medium pb-2 px-2">Type</th>
                    <th className="text-right text-muted-foreground font-medium pb-2 px-2">Qté</th>
                    <th className="text-right text-muted-foreground font-medium pb-2 pl-2 hidden sm:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {recent.slice(0, 8).map((m) => (
                    <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2 pr-2">
                        <p className="font-medium text-foreground truncate max-w-[120px]">
                          {m.productName}
                        </p>
                        <p className="text-muted-foreground/70 truncate max-w-[120px]">
                          {m.createdByName}
                        </p>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold text-[10px]",
                            m.type === "IN"
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                              : "bg-orange-500/15 text-orange-600 dark:text-orange-400",
                          )}
                        >
                          {m.type === "IN" ? (
                            <TrendingUp className="w-2.5 h-2.5" />
                          ) : (
                            <TrendingDown className="w-2.5 h-2.5" />
                          )}
                          {m.type}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right font-semibold text-foreground">
                        {m.type === "IN" ? "+" : "-"}{m.quantity}
                      </td>
                      <td className="py-2 pl-2 text-right text-muted-foreground hidden sm:table-cell">
                        {format(new Date(m.createdAt), "dd/MM HH:mm", { locale: fr })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Produits en alerte ───────────────────────────────── */}
      {(loadingLowStock || (lowStock && lowStock.length > 0)) && (
        <div className="bg-card border border-destructive/25 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <SectionTitle>Produits en alerte de stock</SectionTitle>
            {!loadingLowStock && lowStock && (
              <span className="ml-auto text-xs font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                {lowStock.length} produit{lowStock.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
          {loadingLowStock ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {lowStock!.map((p) => {
                const pct = p.minimumThreshold > 0
                  ? Math.min(100, Math.round((p.quantityInStock / p.minimumThreshold) * 100))
                  : 0;
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between bg-destructive/5 border border-destructive/20 rounded-xl px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground text-sm truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.category}</p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-lg font-bold text-destructive leading-tight">
                        {p.quantityInStock}
                        <span className="text-xs font-normal text-muted-foreground ml-1">{p.unit}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        seuil : {p.minimumThreshold} — {pct}%
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
