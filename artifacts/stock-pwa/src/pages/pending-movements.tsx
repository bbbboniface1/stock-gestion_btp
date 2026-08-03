import { useLocation } from "wouter";
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, Clock, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSyncQueue } from "@/hooks/useSyncQueue";
import type { PendingMovement } from "@/lib/pendingMovements";

function formatDate(value: string) {
  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusText(entry: PendingMovement) {
  if (entry.status === "failed") return "Échec";
  if (entry.status === "syncing") return "Synchronisation";
  return "En attente";
}

function statusClass(entry: PendingMovement) {
  if (entry.status === "failed") return "border-destructive/40 bg-destructive/10 text-destructive";
  if (entry.status === "syncing") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-600";
  return "border-amber-500/40 bg-amber-500/10 text-amber-600";
}

export default function PendingMovementsPage() {
  const [, setLocation] = useLocation();
  const { entries, failedCount, isOnline, isSyncing, pendingCount, retryMovement, cancelMovement, syncNow } = useSyncQueue();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground">
            Mouvements en attente
          </h1>
          <p className="mt-1 text-xs font-mono uppercase text-muted-foreground">
            {pendingCount} en attente · {failedCount} en échec
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="border-border"
            onClick={() => setLocation("/")}
            title="Retour"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="border-border"
            onClick={() => syncNow()}
            disabled={!isOnline || isSyncing || pendingCount === 0}
            title="Synchroniser"
          >
            {isSyncing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card px-6 text-center">
          <UploadCloud className="h-12 w-12 text-muted-foreground" />
          <div className="font-mono text-sm font-bold uppercase text-foreground">
            Aucun mouvement en attente
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map((entry) => (
            <div key={entry.localId} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-mono font-bold uppercase ${statusClass(entry)}`}>
                      {entry.status === "failed" ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                      {statusText(entry)}
                    </span>
                    <span className="text-[10px] font-mono uppercase text-muted-foreground">
                      {formatDate(entry.createdAt)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2 font-display text-lg font-bold uppercase text-foreground">
                    {entry.type === "IN" ? (
                      <ArrowUp className="h-5 w-5 text-green-500" />
                    ) : (
                      <ArrowDown className="h-5 w-5 text-orange-500" />
                    )}
                    <span>{entry.type === "IN" ? "Entrée" : "Sortie"} · {entry.quantity}</span>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Produit #{entry.productId}{entry.projectId ? ` · Projet #${entry.projectId}` : ""}
                  </div>
                  <div className="mt-2 text-sm text-foreground">{entry.reason}</div>
                  <div className="mt-2 break-all text-[10px] font-mono text-muted-foreground">
                    ID local : {entry.localId}
                  </div>
                  {entry.errorMessage && (
                    <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      {entry.errorMessage}
                    </div>
                  )}
                </div>
              </div>

              {entry.status !== "syncing" && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="border-border uppercase font-bold"
                    onClick={() => retryMovement(entry.localId)}
                    disabled={!isOnline || isSyncing}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Réessayer
                  </Button>
                  <Button
                    variant="destructive"
                    className="uppercase font-bold"
                    onClick={() => cancelMovement(entry.localId)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Annuler
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
