/**
 * Offline sync engine — flushes pending Sales transactions to the server
 * one-by-one, respecting the natural ordering (FIFO). Concurrency is limited
 * to a single in-flight run to avoid duplicate submissions.
 */
import { api } from "@/src/api";
import {
  getPendingTransactions,
  markPendingTransaction,
  removePendingTransaction,
  setLastSync,
} from "@/src/utils/offlineStore";

export type SyncResult = {
  attempted: number;
  succeeded: number;
  failed: number;
  errors: Array<{ local_id: string; message: string }>;
};

let running = false;
let subscribers: Array<() => void> = [];

/** Subscribe to sync state / queue changes. Returns unsubscribe. */
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

/**
 * Flush all pending transactions in order. Safe to call redundantly — the
 * `running` flag debounces concurrent invocations. Returns aggregate result.
 */
export async function syncPendingTransactions(): Promise<SyncResult> {
  if (running) {
    return { attempted: 0, succeeded: 0, failed: 0, errors: [] };
  }
  running = true;
  emit();
  const result: SyncResult = { attempted: 0, succeeded: 0, failed: 0, errors: [] };
  try {
    const list = await getPendingTransactions();
    for (const t of list) {
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
          // `client_local_id` is sent so backends that later add
          // idempotency support can dedupe. Currently ignored.
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
        result.errors.push({ local_id: t.local_id, message: msg });
      }
      emit();
    }
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
