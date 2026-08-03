import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export type PendingMovementStatus = "pending" | "syncing" | "failed";
export type PendingMovementType = "IN" | "OUT";

export interface PendingMovement {
  localId: string;
  productId: number;
  type: PendingMovementType;
  quantity: number;
  reason: string;
  projectId: number | null;
  createdAt: string;
  status: PendingMovementStatus;
  errorMessage?: string | null;
}

interface StockSyncQueueDb extends DBSchema {
  pending_movements: {
    key: string;
    value: PendingMovement;
    indexes: {
      "by-status": PendingMovementStatus;
      "by-created-at": string;
    };
  };
}

export const PENDING_MOVEMENTS_CHANGED_EVENT = "pending-movements-changed";

const DB_NAME = "stock-btp-sync-queue";
const DB_VERSION = 1;
const STORE_NAME = "pending_movements";

let dbPromise: Promise<IDBPDatabase<StockSyncQueueDb>> | null = null;

function notifyPendingMovementsChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PENDING_MOVEMENTS_CHANGED_EVENT));
  }
}

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<StockSyncQueueDb>(DB_NAME, DB_VERSION, {
      upgrade(db: IDBPDatabase<StockSyncQueueDb>) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "localId" });
          store.createIndex("by-status", "status");
          store.createIndex("by-created-at", "createdAt");
        }
      },
    });
  }

  return dbPromise;
}

function sortOldestFirst(entries: PendingMovement[]) {
  return entries.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function addPendingMovement(entry: PendingMovement) {
  const db = await getDb();
  await db.put(STORE_NAME, entry);
  notifyPendingMovementsChanged();
}

export async function listQueuedMovements() {
  const db = await getDb();
  const entries = await db.getAll(STORE_NAME);
  return sortOldestFirst(entries);
}

export async function listPendingMovements() {
  const db = await getDb();
  const pending = await db.getAllFromIndex(STORE_NAME, "by-status", "pending");
  return sortOldestFirst(pending);
}

export async function updatePendingMovement(
  localId: string,
  patch: Partial<Omit<PendingMovement, "localId">>,
) {
  const db = await getDb();
  const entry = await db.get(STORE_NAME, localId);
  if (!entry) return null;

  const updated = { ...entry, ...patch };
  await db.put(STORE_NAME, updated);
  notifyPendingMovementsChanged();
  return updated;
}

export async function deletePendingMovement(localId: string) {
  const db = await getDb();
  await db.delete(STORE_NAME, localId);
  notifyPendingMovementsChanged();
}

export async function resetInterruptedMovements() {
  const db = await getDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const syncingEntries = await tx.store.index("by-status").getAll("syncing");

  for (const entry of syncingEntries) {
    await tx.store.put({
      ...entry,
      status: "pending",
      errorMessage: "Synchronisation interrompue, nouvel essai au retour du réseau.",
    });
  }

  await tx.done;
  if (syncingEntries.length > 0) {
    notifyPendingMovementsChanged();
  }
}
