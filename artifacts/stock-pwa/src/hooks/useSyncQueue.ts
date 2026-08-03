import { useCallback, useEffect, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetDashboardSummaryQueryKey,
  getGetLowStockProductsQueryKey,
  getGetProductQueryKey,
  getGetRecentMovementsQueryKey,
  getListProductsQueryKey,
  getListStockMovementsQueryKey,
} from "@workspace/api-client-react";
import { useAuthStore } from "@/lib/auth";
import { appPath } from "@/lib/paths";
import {
  deletePendingMovement,
  listPendingMovements,
  listQueuedMovements,
  PENDING_MOVEMENTS_CHANGED_EVENT,
  resetInterruptedMovements,
  updatePendingMovement,
  type PendingMovement,
} from "@/lib/pendingMovements";

type SyncResult =
  | { ok: true }
  | { ok: false; retryLater: true; message: string }
  | { ok: false; retryLater: false; message: string };

let activeFlush: Promise<void> | null = null;

function isNavigatorOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function invalidateStockQueries(queryClient: QueryClient, productId: number) {
  queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
  queryClient.invalidateQueries({ queryKey: getListStockMovementsQueryKey() });
  queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  queryClient.invalidateQueries({ queryKey: getGetRecentMovementsQueryKey() });
  queryClient.invalidateQueries({ queryKey: getGetLowStockProductsQueryKey() });
  queryClient.invalidateQueries({ queryKey: getGetProductQueryKey(productId) });
}

function getErrorMessage(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const candidate = record.error ?? record.message ?? record.detail;
  return typeof candidate === "string" && candidate.trim() ? candidate : null;
}

async function parseErrorMessage(response: Response) {
  if (response.status === 401) {
    return "Reconnectez-vous pour synchroniser";
  }

  if (response.status === 403) {
    return "Action réservée aux rôles admin et manager.";
  }

  try {
    const data = await response.json();
    return getErrorMessage(data) ?? `Synchronisation refusée (${response.status})`;
  } catch {
    return `Synchronisation refusée (${response.status})`;
  }
}

async function postMovement(entry: PendingMovement): Promise<SyncResult> {
  const { token } = useAuthStore.getState();
  if (!token) {
    return {
      ok: false,
      retryLater: false,
      message: "Reconnectez-vous pour synchroniser",
    };
  }

  try {
    const response = await fetch(appPath("/api/stock-movements"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        productId: entry.productId,
        type: entry.type,
        quantity: entry.quantity,
        reason: entry.reason,
        projectId: entry.projectId,
        idempotencyKey: entry.localId,
      }),
    });

    if (response.ok) {
      return { ok: true };
    }

    return {
      ok: false,
      retryLater: false,
      message: await parseErrorMessage(response),
    };
  } catch {
    return {
      ok: false,
      retryLater: true,
      message: "Synchronisation interrompue, nouvel essai au retour du réseau.",
    };
  }
}

async function flushPendingQueue(queryClient: QueryClient) {
  if (activeFlush) return activeFlush;

  activeFlush = (async () => {
    await resetInterruptedMovements();
    if (!isNavigatorOnline()) return;

    const entries = await listPendingMovements();
    for (const entry of entries) {
      if (!isNavigatorOnline()) break;

      await updatePendingMovement(entry.localId, { status: "syncing", errorMessage: null });
      const result = await postMovement(entry);

      if (result.ok) {
        await deletePendingMovement(entry.localId);
        invalidateStockQueries(queryClient, entry.productId);
        continue;
      }

      if (result.retryLater) {
        await updatePendingMovement(entry.localId, {
          status: "pending",
          errorMessage: result.message,
        });
        break;
      }

      await updatePendingMovement(entry.localId, {
        status: "failed",
        errorMessage: result.message,
      });
    }
  })().finally(() => {
    activeFlush = null;
  });

  return activeFlush;
}

export function useSyncQueue() {
  const queryClient = useQueryClient();
  const [entries, setEntries] = useState<PendingMovement[]>([]);
  const [isOnline, setIsOnline] = useState(isNavigatorOnline);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshQueue = useCallback(async () => {
    const queued = await listQueuedMovements();
    setEntries(queued);
  }, []);

  const syncNow = useCallback(async () => {
    setIsSyncing(true);
    try {
      await flushPendingQueue(queryClient);
    } finally {
      setIsSyncing(false);
      await refreshQueue();
    }
  }, [queryClient, refreshQueue]);

  const retryMovement = useCallback(async (localId: string) => {
    await updatePendingMovement(localId, { status: "pending", errorMessage: null });
    await refreshQueue();
    if (isNavigatorOnline()) {
      await syncNow();
    }
  }, [refreshQueue, syncNow]);

  const cancelMovement = useCallback(async (localId: string) => {
    await deletePendingMovement(localId);
    await refreshQueue();
  }, [refreshQueue]);

  useEffect(() => {
    let mounted = true;

    const refreshIfMounted = async () => {
      const queued = await listQueuedMovements();
      if (mounted) setEntries(queued);
    };

    const handleQueueChanged = () => {
      void refreshIfMounted();
    };

    const handleOnline = () => {
      setIsOnline(true);
      void syncNow();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsSyncing(false);
    };

    window.addEventListener(PENDING_MOVEMENTS_CHANGED_EVENT, handleQueueChanged);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    void (async () => {
      await resetInterruptedMovements();
      await refreshIfMounted();
      if (isNavigatorOnline()) {
        await syncNow();
      }
    })();

    return () => {
      mounted = false;
      window.removeEventListener(PENDING_MOVEMENTS_CHANGED_EVENT, handleQueueChanged);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncNow]);

  return {
    entries,
    failedCount: entries.filter((entry) => entry.status === "failed").length,
    isOnline,
    isSyncing,
    pendingCount: entries.filter((entry) => entry.status !== "failed").length,
    retryMovement,
    cancelMovement,
    syncNow,
  };
}
