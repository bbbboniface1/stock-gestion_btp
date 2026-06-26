import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { WifiOff, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function OfflineBanner() {
  const { status, pendingCount } = useOnlineStatus();
  const [showBackOnline, setShowBackOnline] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showReconnected = () => {
    setShowBackOnline(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setShowBackOnline(false);
      timerRef.current = null;
    }, 4000);
  };

  useEffect(() => {
    if (status === "syncing") showReconnected();
    if (status === "offline") setShowBackOnline(false);
  }, [status]);

  useEffect(() => {
    const onSyncComplete = () => showReconnected();
    window.addEventListener("sw-sync-complete", onSyncComplete);
    return () => {
      window.removeEventListener("sw-sync-complete", onSyncComplete);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (status === "online" && !showBackOnline) return null;

  if (showBackOnline || status === "syncing") {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white text-xs font-semibold shadow-lg">
        <RefreshCw className="h-3.5 w-3.5 animate-spin shrink-0" />
        <span>Connexion rétablie — synchronisation en cours...</span>
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white text-xs font-semibold shadow-lg">
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span>
        Hors ligne — mode consultation activé
        {pendingCount > 0
          ? ` · ${pendingCount} action${pendingCount > 1 ? "s" : ""} en attente`
          : ""}
      </span>
    </div>
  );
}
