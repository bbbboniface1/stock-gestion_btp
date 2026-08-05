import {
  useGetDashboardSummary,
  useGetLowStockProducts,
  useGetRecentMovements,
  useGetStockByCategory,
  customFetch,
} from "@workspace/api-client-react";
import type { CategoryStat } from "@workspace/api-zod";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie,
} from "recharts";
import {
  Package, AlertTriangle, ArrowDownCircle, FolderOpen,
  TrendingUp, TrendingDown,
} from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { OnlineStatusBadge } from "@/components/OnlineStatusBadge";
import { cn } from "@/lib/utils";

/* ─── types locaux (hooks retournent any quand lib non buildée) ── */
type DayBucket   = { date: string; IN: number; OUT: number };
type CatItem     = { category: string; totalQuantity: number; color: string; pct: number };
type RecentMvt   = { id: number; productName: string; type: string; quantity: number; createdAt: string; createdByName: string };
type LowProduct  = { id: number; name: string; category: string; unit: string; quantityInStock: number; minimumThreshold: number };

function useMovementsByDay(from: string, to: string) {
  return useQuery<DayBucket[]>({
    queryKey: ["dashboard", "movements-by-day", from, to],
    queryFn: () =>
      customFetch<DayBucket[]>(
        `/api/dashboard/movements-by-day?from=${from}&to=${to}`,
      ),
  });
}

/* ─── couleurs catégories ────────────────────────────────────── */
const CAT_COLORS = [
  "#6366f1","#f97316","#22c55e","#eab308",
  "#3b82f6","#ec4899","#14b8a6","#a855f7","#ef4444","#84cc16",
];

/* ─── tooltip ────────────────────────────────────────────────── */
function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-1.5 text-xs shadow-xl">
      {label && <p className="text-muted-foreground mb-1">{label}</p>}
      {payload.map((e: any, i: number) => (
        <p key={i} style={{ color: e.color ?? e.fill }} className="font-semibold">
          {e.name}: {e.value}
        </p>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   DASHBOARD — grille calquée sur design_5
══════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const company = useCompany();

  /* data */
  const { data: summary, isLoading: lSum, isError: eSum } = useGetDashboardSummary();
  const { data: lowStock } = useGetLowStockProducts();
  const { data: recent, isLoading: lRec } = useGetRecentMovements({ limit: 8 });
  const { data: byCategory, isLoading: lCat } = useGetStockByCategory();

  const today = new Date();
  const d7 = new Date(today);
  d7.setUTCDate(d7.getUTCDate() - 6);
  const { data: rawByDay, isLoading: lDay } = useMovementsByDay(
    d7.toISOString().slice(0, 10),
    today.toISOString().slice(0, 10),
  );

  /* chart data */
  const areaData = (rawByDay ?? [])
    .map((d) => ({
      _k: d.date,
      jour: format(new Date(`${d.date}T00:00:00Z`), "EEE", { locale: fr }),
      Entrées: d.IN,
      Sorties: d.OUT,
    }))
    .sort((a, b) => a._k.localeCompare(b._k));

  const totalIn  = areaData.reduce((s, d) => s + d.Entrées, 0);
  const totalOut = areaData.reduce((s, d) => s + d.Sorties, 0);
  const diffPct  = totalIn + totalOut > 0
    ? Math.round(((totalIn - totalOut) / (totalIn + totalOut)) * 100)
    : 0;

  /* catégories avec % */
  const catTotal = (byCategory ?? []).reduce((s: number, c: CategoryStat) => s + (c.totalQuantity ?? 0), 0);
  const catData: CatItem[] = (byCategory ?? []).map((c: CategoryStat, i: number) => ({
    ...c,
    color: CAT_COLORS[i % CAT_COLORS.length],
    pct: catTotal > 0 ? Math.round((c.totalQuantity / catTotal) * 100) : 0,
  }));

  if (eSum) return (
    <div className="flex flex-col items-center gap-3 p-16 text-center">
      <AlertTriangle className="w-8 h-8 text-destructive" />
      <p className="text-destructive font-semibold text-sm">Tableau de bord indisponible</p>
      <button onClick={() => window.location.reload()} className="text-xs text-primary hover:underline">
        Réessayer
      </button>
    </div>
  );

  /* ── KPI config ──────────────────────────────────────────── */
  const kpis = [
    {
      label: "Total Produits",
      value: summary?.totalProducts ?? 0,
      icon: Package,
      bg: "bg-indigo-500/15 dark:bg-indigo-500/20",
      ic: "text-indigo-500",
    },
    {
      label: "Stock Critique",
      value: summary?.lowStockCount ?? 0,
      icon: AlertTriangle,
      bg: (summary?.lowStockCount ?? 0) > 0
        ? "bg-destructive/15"
        : "bg-emerald-500/15",
      ic: (summary?.lowStockCount ?? 0) > 0
        ? "text-destructive"
        : "text-emerald-500",
    },
    {
      label: "Entrées aujourd'hui",
      value: summary?.todayMovementsIn ?? 0,
      icon: ArrowDownCircle,
      bg: "bg-emerald-500/15",
      ic: "text-emerald-500",
    },
    {
      label: "Projets actifs",
      value: summary?.activeProjects ?? 0,
      icon: FolderOpen,
      bg: "bg-orange-500/15",
      ic: "text-orange-500",
    },
  ];

  return (
    /* wrapper — même padding que la zone contenu de l'app */
    <div className="flex flex-col gap-4">

      {/* ── Row 0 : titre page ─────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground leading-tight">
            Tableau de Bord
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {company?.name ?? "Stock BTP"} · {format(today, "d MMM yyyy", { locale: fr })}
          </p>
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-1.5
                        bg-card border border-border/60 rounded-lg px-2.5 py-1.5">
          <OnlineStatusBadge />
        </div>
      </div>

      {/* ── Row 1 : 4 KPI cards ────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="bg-card border border-border/50 rounded-xl px-4 py-3
                       flex items-center gap-3 shadow-sm"
          >
            {/* icon box — exactement comme design_5 */}
            <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0", k.bg)}>
              <k.icon className={cn("w-5 h-5", k.ic)} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground leading-none truncate">{k.label}</p>
              {lSum
                ? <Skeleton className="h-7 w-12 mt-1" />
                : <p className="text-2xl font-bold text-foreground mt-0.5 leading-none">{k.value}</p>
              }
            </div>
          </div>
        ))}
      </div>

      {/* ── Row 2 : grand chart (≈65%) + donut (≈35%) ────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

        {/* Area chart — mouvements 7 jours */}
        <div className="lg:col-span-2 bg-card border border-border/50 rounded-xl p-4 shadow-sm">
          {/* header exactement comme design_5 */}
          <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Mouvements de stock</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">7 derniers jours</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
                <span className="text-muted-foreground">Entrées</span>
                <span className="font-semibold text-foreground">{totalIn}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
                <span className="text-muted-foreground">Sorties</span>
                <span className="font-semibold text-foreground">{totalOut}</span>
              </span>
              {totalIn + totalOut > 0 && (
                <span className={cn(
                  "flex items-center gap-0.5 font-semibold",
                  diffPct >= 0 ? "text-emerald-500" : "text-destructive",
                )}>
                  {diffPct >= 0
                    ? <TrendingUp className="w-3 h-3" />
                    : <TrendingDown className="w-3 h-3" />
                  }
                  {Math.abs(diffPct)}%
                </span>
              )}
            </div>
          </div>

          {lDay ? (
            <Skeleton className="h-[170px] w-full rounded-lg" />
          ) : areaData.length === 0 ? (
            <div className="h-[170px] flex items-center justify-center text-xs text-muted-foreground">
              Aucun mouvement cette semaine
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={170}>
              <AreaChart data={areaData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                <defs>
                  <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f97316" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="jour"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false} tickLine={false} width={24} allowDecimals={false} />
                <Tooltip content={<Tip />} />
                <Area type="monotone" dataKey="Entrées" stroke="#6366f1" strokeWidth={2}
                  fill="url(#gIn)" dot={false} activeDot={{ r: 3, strokeWidth: 0 }} />
                <Area type="monotone" dataKey="Sorties" stroke="#f97316" strokeWidth={2}
                  fill="url(#gOut)" dot={false} activeDot={{ r: 3, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Donut + légende — exactement comme "Sale by city" dans design_5 */}
        <div className="bg-card border border-border/50 rounded-xl p-4 shadow-sm flex flex-col">
          <p className="text-sm font-semibold text-foreground mb-0.5">Stock par catégorie</p>
          <p className="text-[11px] text-muted-foreground mb-3">Répartition quantités</p>

          {lCat ? (
            <div className="flex-1 flex items-center justify-center">
              <Skeleton className="w-28 h-28 rounded-full" />
            </div>
          ) : !catData.length ? (
            <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
              Aucune donnée
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie data={catData} dataKey="totalQuantity" nameKey="category"
                    cx="50%" cy="50%" outerRadius={50} innerRadius={22}
                    paddingAngle={2} strokeWidth={0}>
                    {catData.map((_: CatItem, i: number) => (
                      <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<Tip />} />
                </PieChart>
              </ResponsiveContainer>
              {/* légende listée — exactement comme design_5 */}
              <ul className="space-y-1.5 mt-2">
                {catData.slice(0, 5).map((c: CatItem, i: number) => (
                  <li key={i} className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5 truncate">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
                      <span className="text-muted-foreground truncate">{c.category}</span>
                    </span>
                    <span className="font-semibold text-foreground ml-2 shrink-0">{c.pct}%</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {/* ── Row 3 : bar chart + légende (50%) | table (50%) ─ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

        {/* "Channels" de design_5 → Entrées/Sorties empilées + légende côte à côte */}
        <div className="bg-card border border-border/50 rounded-xl p-4 shadow-sm">
          <p className="text-sm font-semibold text-foreground mb-3">Entrées / Sorties</p>
          {lDay ? (
            <Skeleton className="h-[160px] w-full rounded-lg" />
          ) : areaData.length === 0 ? (
            <div className="h-[160px] flex items-center justify-center text-xs text-muted-foreground">
              Aucun mouvement
            </div>
          ) : (
            /* bar chart + légende côte à côte exactement comme design_5 */
            <div className="flex gap-4 items-end">
              <ResponsiveContainer width="60%" height={155}>
                <BarChart data={areaData} barSize={14}
                  margin={{ top: 0, right: 0, bottom: 0, left: -28 }}>
                  <XAxis dataKey="jour"
                    tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false} tickLine={false} width={24} allowDecimals={false} />
                  <Tooltip content={<Tip />} />
                  <Bar dataKey="Entrées" stackId="s" fill="#6366f1" radius={[0,0,0,0]} />
                  <Bar dataKey="Sorties" stackId="s" fill="#f97316" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
              {/* légende à droite comme design_5 */}
              <ul className="flex-1 space-y-2 pb-4 text-[11px]">
                {areaData.slice(0, 6).map((d, i) => {
                  const tot = d.Entrées + d.Sorties;
                  const pct = tot > 0 ? Math.round((d.Entrées / tot) * 100) : 0;
                  return (
                    <li key={i} className="flex items-center justify-between gap-1">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                        <span className="text-muted-foreground">{d.jour}</span>
                      </span>
                      <span className="font-semibold text-foreground">{pct}%</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        {/* "Top selling products" de design_5 → Derniers mouvements */}
        <div className="bg-card border border-border/50 rounded-xl p-4 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-foreground">Derniers mouvements</p>
            {recent && (
              <span className="text-[11px] text-muted-foreground">
                {recent.length} récents
              </span>
            )}
          </div>
          {lRec ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full rounded" />
              ))}
            </div>
          ) : !recent?.length ? (
            <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
              Aucun mouvement
            </div>
          ) : (
            /* table exactement comme "Top selling products" de design_5 */
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="text-left text-muted-foreground font-medium pb-2 pr-2">Produit</th>
                  <th className="text-center text-muted-foreground font-medium pb-2 px-2">Type</th>
                  <th className="text-right text-muted-foreground font-medium pb-2 px-2">Qté</th>
                  <th className="text-right text-muted-foreground font-medium pb-2 pl-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {(recent as RecentMvt[]).slice(0, 7).map((m: RecentMvt) => (
                  <tr key={m.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                    <td className="py-1.5 pr-2">
                      <p className="font-medium text-foreground truncate max-w-[100px]">{m.productName}</p>
                      <p className="text-muted-foreground/60 truncate max-w-[100px] text-[10px]">{m.createdByName}</p>
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      <span className={cn(
                        "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-semibold text-[10px]",
                        m.type === "IN"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : "bg-orange-500/15 text-orange-600 dark:text-orange-400",
                      )}>
                        {m.type === "IN"
                          ? <TrendingUp className="w-2.5 h-2.5" />
                          : <TrendingDown className="w-2.5 h-2.5" />}
                        {m.type}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-right font-semibold text-foreground">
                      {m.type === "IN" ? "+" : "-"}{m.quantity}
                    </td>
                    <td className="py-1.5 pl-2 text-right text-muted-foreground whitespace-nowrap">
                      {format(new Date(m.createdAt), "dd/MM HH:mm", { locale: fr })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Row 4 : alerte stock critique (conditionnelle) ── */}
      {lowStock && lowStock.length > 0 && (
        <div className="bg-destructive/5 border border-destructive/25 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
            <p className="text-sm font-semibold text-foreground">
              Produits en alerte de stock
            </p>
            <span className="ml-auto text-[11px] font-semibold text-destructive
                             bg-destructive/10 px-2 py-0.5 rounded-full">
              {lowStock.length}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {(lowStock as LowProduct[]).map((p: LowProduct) => (
              <div key={p.id}
                className="flex items-center justify-between bg-card
                           border border-destructive/20 rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground">{p.category}</p>
                </div>
                <div className="text-right ml-2 shrink-0">
                  <p className="text-sm font-bold text-destructive">
                    {p.quantityInStock}
                    <span className="text-[10px] font-normal ml-0.5">{p.unit}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground">/ {p.minimumThreshold}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
