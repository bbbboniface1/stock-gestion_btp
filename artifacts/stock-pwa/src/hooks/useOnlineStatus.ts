import { useState, useEffect, useCallback } from "react";

type SyncStatus = "online" | "offline" | "syncing";

export function useOnlineStatus() {
  const [status, setStatus] = useState<SyncStatus>(
    navigator.onLine ? "online" : "offline"
  );
  const [pendingCount, setPendingCount] = useState(0);

  const checkQueue = useCallback(async () => {
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    reg.active?.postMessage({ type: "GET_QUEUE_COUNT" });
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setStatus("syncing");
      setPendingCount(0);
      setTimeout(() => setStatus("online"), 3000);
    };
    const handleOffline = () => setStatus("offline");

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === "SYNC_SUCCESS") {
        setPendingCount((c) => Math.max(0, c - 1));
        setStatus("online");
      }
      if (event.data?.type === "QUEUE_COUNT") {
        setPendingCount(event.data.count ?? 0);
      }
    };

    navigator.serviceWorker?.addEventListener("message", handleSWMessage);
    checkQueue();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      navigator.serviceWorker?.removeEventListener("message", handleSWMessage);
    };
  }, [checkQueue]);

  const trackMutation = useCallback(() => {
    if (!navigator.onLine) {
      setPendingCount((c) => c + 1);
    }
  }, []);

  return { status, pendingCount, trackMutation, isOffline: status === "offline" };
}
