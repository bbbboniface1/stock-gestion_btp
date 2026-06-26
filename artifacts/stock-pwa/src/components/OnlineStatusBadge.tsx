import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export function OnlineStatusBadge() {
  const { status, pendingCount } = useOnlineStatus();

  if (status === "offline") {
    return (
      <span className="text-amber-500 font-bold">
        HORS LIGNE{pendingCount > 0 ? ` (${pendingCount} en attente)` : ""}
      </span>
    );
  }

  if (status === "syncing") {
    return <span className="text-green-500 font-bold animate-pulse">SYNCHRONISATION...</span>;
  }

  return <span className="text-green-500 font-bold">EN LIGNE</span>;
}
