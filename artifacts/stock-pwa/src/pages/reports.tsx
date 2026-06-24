import { useMemo, useState } from "react";
import { CalendarDays, CalendarRange, FileDown, FileText, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/lib/auth";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type ReportPeriod = "day" | "week" | "month";
type Status = "idle" | "success" | "error";

const reports: Array<{
  period: ReportPeriod;
  title: string;
  description: string;
  icon: typeof FileText;
  bullets: string[];
}> = [
  {
    period: "day",
    title: "Rapport Journalier",
    description: "Mouvements et stock pour une journee",
    icon: CalendarDays,
    bullets: ["Mouvements du jour", "Entrees et sorties", "Operateurs concernes", "Alertes stock bas"],
  },
  {
    period: "week",
    title: "Rapport Hebdomadaire",
    description: "Synthese de la semaine selectionnee",
    icon: CalendarRange,
    bullets: ["Mouvements de la semaine", "Consommation par projet", "Totaux par periode", "Alertes stock bas"],
  },
  {
    period: "month",
    title: "Rapport Mensuel",
    description: "Synthese du mois selectionne",
    icon: FileText,
    bullets: ["Stock actuel par categorie", "Mouvements du mois", "Consommation par projet", "Produits sous seuil"],
  },
];

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function Reports() {
  const { token } = useAuthStore();
  const [referenceDate, setReferenceDate] = useState(todayInputValue());
  const [loadingPeriod, setLoadingPeriod] = useState<ReportPeriod | null>(null);
  const [statusByPeriod, setStatusByPeriod] = useState<Record<ReportPeriod, Status>>({
    day: "idle",
    week: "idle",
    month: "idle",
  });

  const selectedDateLabel = useMemo(() => {
    const date = new Date(`${referenceDate}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return "Date invalide";
    return date.toLocaleDateString("fr-FR", { timeZone: "UTC" });
  }, [referenceDate]);

  const downloadPDF = async (period: ReportPeriod) => {
    setLoadingPeriod(period);
    setStatusByPeriod((current) => ({ ...current, [period]: "idle" }));
    try {
      const params = new URLSearchParams({ period, date: referenceDate });
      const res = await fetch(`${API_BASE}/api/reports/pdf?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erreur serveur");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rapport-stock-${period}-${referenceDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusByPeriod((current) => ({ ...current, [period]: "success" }));
    } catch {
      setStatusByPeriod((current) => ({ ...current, [period]: "error" }));
    } finally {
      setLoadingPeriod(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-mono uppercase tracking-tight">Rapports</h1>
          <p className="text-muted-foreground text-sm mt-1">Generation et export des rapports de gestion des stocks</p>
        </div>
        <div className="w-full md:w-64">
          <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Date de reference</label>
          <Input
            type="date"
            value={referenceDate}
            onChange={(event) => setReferenceDate(event.target.value)}
            className="mt-2 bg-card border-border"
          />
          <p className="text-xs text-muted-foreground mt-1 font-mono">{selectedDateLabel}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reports.map((report) => {
          const Icon = report.icon;
          const status = statusByPeriod[report.period];
          const loading = loadingPeriod === report.period;

          return (
            <Card key={report.period} className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-md">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-mono">{report.title}</CardTitle>
                    <CardDescription className="text-xs mt-0.5">{report.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="text-sm text-muted-foreground space-y-1.5">
                  {report.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      {bullet}
                    </li>
                  ))}
                </ul>

                {status === "success" && (
                  <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                    <CheckCircle className="h-4 w-4 shrink-0" />
                    PDF telecharge avec succes.
                  </div>
                )}
                {status === "error" && (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Erreur lors de la generation.
                  </div>
                )}

                <Button
                  className="w-full font-mono font-bold gap-2"
                  onClick={() => downloadPDF(report.period)}
                  disabled={loadingPeriod !== null}
                >
                  {loading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Generation...</>
                  ) : (
                    <><FileDown className="h-4 w-4" />Telecharger le PDF</>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
