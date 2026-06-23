import { useState } from "react";
import { FileDown, FileText, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/lib/auth";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Reports() {
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const now = new Date();
  const monthNames = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
  const currentMonth = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

  const downloadPDF = async () => {
    setLoading(true);
    setStatus("idle");
    try {
      const res = await fetch(`${API_BASE}/api/reports/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erreur serveur");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rapport-stock-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus("success");
    } catch {
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-mono uppercase tracking-tight">Rapports</h1>
        <p className="text-muted-foreground text-sm mt-1">Génération et export des rapports de gestion des stocks</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="border-2 hover:border-primary/50 transition-colors">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-md">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base font-mono">Rapport Mensuel PDF</CardTitle>
                <CardDescription className="text-xs mt-0.5">{currentMonth}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="text-sm text-muted-foreground space-y-1.5">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                Stock actuel par produit et catégorie
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                Mouvements entrées / sorties du mois
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                Consommation par projet (actif / terminé)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
                Alertes produits sous le seuil minimum
              </li>
            </ul>

            {status === "success" && (
              <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                <CheckCircle className="h-4 w-4 shrink-0" />
                PDF téléchargé avec succès !
              </div>
            )}
            {status === "error" && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Erreur lors de la génération. Réessayez.
              </div>
            )}

            <Button
              className="w-full font-mono font-bold gap-2"
              onClick={downloadPDF}
              disabled={loading}
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Génération en cours…</>
              ) : (
                <><FileDown className="h-4 w-4" />Télécharger le PDF</>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-2 border-dashed border-muted opacity-50 cursor-not-allowed">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-md">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-base font-mono text-muted-foreground">Rapport Annuel</CardTitle>
                <CardDescription className="text-xs mt-0.5">Bientôt disponible</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Synthèse annuelle des stocks et consommations par projet.</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-dashed border-muted opacity-50 cursor-not-allowed">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-md">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-base font-mono text-muted-foreground">Export CSV</CardTitle>
                <CardDescription className="text-xs mt-0.5">Bientôt disponible</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Export tableur de l'inventaire complet pour Excel.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
