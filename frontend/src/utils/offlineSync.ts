/**
 * Offline sync engine.
 *
 * Order of operations:
 *   1. Flush pending customers (create on server, capture real id).
 *   2. Remap any pending transactions whose `customer_id` still points at a
 *      local UUID to the freshly-issued server id.
 *   3. Flush pending transactions FIFO.
 *
 * `running` guards against concurrent invocations.
 */
import { api } from "@/src/api";
import {
  addPendingCustomerStub,
  getPendingCustomers,
  getPendingTransactions,
  markPendingCustomer,
  markPendingTransaction,
  removeCachedCustomer,
  removePendingCustomer,
  removePendingTransaction,
  setPendingTransactions,
  setLastSync,
} from "@/src/utils/offlineStore";

export type SyncResult = {
  attempted: number;
  succeeded: number;
  failed: number;
  errors: Array<{ local_id: string; message: string; kind: "customer" | "transaction" }>;
};

let running = false;
let subscribers: Array<() => void> = [];

export function subscribeSyncEvents(cb: () => void): () => void {
  subscribers.push(cb);
  return () => {
    subscribers = subscribers.filter((s) => s !== cb);
  };
}

function emit() {
  subscribers.forEach((s) => {
    try {
      s();
    } catch {}
  });
}

async function syncPendingCustomers(result: SyncResult): Promise<Record<string, string>> {
  // Returns a map of local_id → server id for successful creates.
  const idMap: Record<string, string> = {};
  const list = await getPendingCustomers();
  for (const c of list) {
    result.attempted += 1;
    await markPendingCustomer(c.local_id, { status: "syncing" });
    emit();
    try {
      const saved = await api.createCustomer({
        name: c.name,
        wa_number: c.wa_number || "",
        address: c.address || "",
        barcode_id: c.barcode_id || undefined,
        lat: c.lat ?? undefined,
        lng: c.lng ?? undefined,
        photo_rumah: c.photo_rumah ?? undefined,
      } as any);
      idMap[c.local_id] = saved.id;
      await removePendingCustomer(c.local_id);
      // Drop the stub — the server-authoritative customer will be repopulated
      // on the next cache refresh (triggered by the layout effect).
      await removeCachedCustomer(c.local_id);
      result.succeeded += 1;
    } catch (e: any) {
      const msg = e?.message || "Gagal sync pelanggan";
      await markPendingCustomer(c.local_id, {
        status: "failed",
        retries: (c.retries || 0) + 1,
        error: msg,
      });
      result.failed += 1;
      result.errors.push({ local_id: c.local_id, message: msg, kind: "customer" });
    }
    emit();
  }
  return idMap;
}

async function remapPendingTransactionIds(idMap: Record<string, string>): Promise<void> {
  if (Object.keys(idMap).length === 0) return;
  const list = await getPendingTransactions();
  let changed = false;
  for (const t of list) {
    if (idMap[t.customer_id]) {
      t.customer_id = idMap[t.customer_id];
      changed = true;
    }
  }
  if (changed) await setPendingTransactions(list);
}

async function syncPendingTxns(result: SyncResult): Promise<void> {
  const list = await getPendingTransactions();
  for (const t of list) {
    // Skip transactions whose customer is still local (pending customer that
    // hasn't synced yet) — we'll pick them up on next round.
    if (t.customer_id.startsWith("local-")) continue;
    result.attempted += 1;
    await markPendingTransaction(t.local_id, { status: "syncing" });
    emit();
    try {
      await api.createTransaction({
        customer_id: t.customer_id,
        items: t.items,
        bayar: t.bayar,
        pinjam_galon: t.pinjam_galon,
        galon_kembali: t.galon_kembali,
        client_local_id: t.local_id,
      } as any);
      await removePendingTransaction(t.local_id);
      result.succeeded += 1;
    } catch (e: any) {
      const msg = e?.message || "Gagal sync";
      await markPendingTransaction(t.local_id, {
        status: "failed",
        retries: (t.retries || 0) + 1,
        error: msg,
      });
      result.failed += 1;
      result.errors.push({ local_id: t.local_id, message: msg, kind: "transaction" });
    }
    emit();
  }
}

/** Flush all pending customers then transactions. Safe to call redundantly. */
export async function syncPendingTransactions(): Promise<SyncResult> {
  if (running) {
    return { attempted: 0, succeeded: 0, failed: 0, errors: [] };
  }
  running = true;
  emit();
  const result: SyncResult = { attempted: 0, succeeded: 0, failed: 0, errors: [] };
  try {
    const idMap = await syncPendingCustomers(result);
    await remapPendingTransactionIds(idMap);
    await syncPendingTxns(result);
    await setLastSync();
  } finally {
    running = false;
    emit();
  }
  return result;
}

export function isSyncRunning(): boolean {
  return running;
}

// Re-export for legacy callers that only need the stub attach helper.
export { addPendingCustomerStub };
