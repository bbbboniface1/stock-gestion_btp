import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { WifiOff, RefreshCw, Wifi } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function OfflineBanner() {
  const { status, pendingCount } = useOnlineStatus();
  const [showSync, setShowSync] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (status === "syncing") {
      setShowSync(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setShowSync(false);
        timerRef.current = null;
      }, 4000);
    }
  }, [status]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (status === "online" && !showSync) return null;

  if (showSync) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white text-xs font-mono uppercase tracking-wide shadow-lg animate-in slide-in-from-top-2 duration-300">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        <span>Connexion rétablie — synchronisation en cours...</span>
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 text-white text-xs font-mono uppercase tracking-wide shadow-lg animate-in slide-in-from-top-2 duration-300">
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span>
        Mode hors-ligne
        {pendingCount > 0
          ? ` — ${pendingCount} action${pendingCount > 1 ? "s" : ""} en attente de synchronisation`
          : " — vos actions seront synchronisées à la reconnexion"}
      </span>
      <Wifi className="h-3.5 w-3.5 shrink-0 opacity-50" />
    </div>
  );
}
