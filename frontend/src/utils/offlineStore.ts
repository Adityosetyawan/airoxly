/**
 * Offline store for Sales role — caches read-only data (customers, products)
 * and buffers write operations (transactions) while offline.
 *
 * We bypass the typed `storage` helper here because we need to persist
 * complex objects/arrays (not just primitives). All keys are prefixed with
 * `oxly.offline.` to make them easy to purge on logout.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Customer, Product, TransactionItem } from "@/src/api";

// ── Storage keys ─────────────────────────────────────────────────────────────
const K_CUSTOMERS = "oxly.offline.customers.v1";
const K_PRODUCTS = "oxly.offline.products.v1";
const K_CUSTOMERS_TS = "oxly.offline.customers_ts.v1";
const K_PRODUCTS_TS = "oxly.offline.products_ts.v1";
const K_PENDING = "oxly.offline.pending_txns.v1";
const K_LAST_SYNC = "oxly.offline.last_sync.v1";

// ── Types ────────────────────────────────────────────────────────────────────
export type PendingTxnStatus = "pending" | "syncing" | "failed";

export type PendingTransaction = {
  local_id: string; // client-generated uuid (used to deduplicate on retry)
  customer_id: string;
  customer_name: string;
  customer_no?: number;
  items: TransactionItem[];
  bayar: number;
  pinjam_galon: number;
  galon_kembali: number;
  total: number;
  created_at: string; // ISO
  status: PendingTxnStatus;
  retries: number;
  error?: string;
};

// ── JSON helpers (safe, never throw) ─────────────────────────────────────────
async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (e) {
    console.warn(`[offlineStore] readJson(${key}) failed`, e);
    return fallback;
  }
}

async function writeJson(key: string, value: unknown): Promise<boolean> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.warn(`[offlineStore] writeJson(${key}) failed`, e);
    return false;
  }
}

// ── Customers cache ──────────────────────────────────────────────────────────
export async function cacheCustomers(customers: Customer[]): Promise<void> {
  await writeJson(K_CUSTOMERS, customers);
  await AsyncStorage.setItem(K_CUSTOMERS_TS, new Date().toISOString());
}

export async function getCachedCustomers(): Promise<Customer[]> {
  return readJson<Customer[]>(K_CUSTOMERS, []);
}

export async function getCustomersCacheTs(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(K_CUSTOMERS_TS);
  } catch {
    return null;
  }
}

export async function getCachedCustomer(id: string): Promise<Customer | null> {
  const list = await getCachedCustomers();
  return list.find((c) => c.id === id) ?? null;
}

/** Patch a cached customer optimistically (used after pending txn enqueued). */
export async function patchCachedCustomer(
  id: string,
  patch: Partial<Customer>,
): Promise<void> {
  const list = await getCachedCustomers();
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1) return;
  list[idx] = { ...list[idx], ...patch };
  await writeJson(K_CUSTOMERS, list);
}

// ── Products cache ───────────────────────────────────────────────────────────
export async function cacheProducts(products: Product[]): Promise<void> {
  await writeJson(K_PRODUCTS, products);
  await AsyncStorage.setItem(K_PRODUCTS_TS, new Date().toISOString());
}

export async function getCachedProducts(): Promise<Product[]> {
  return readJson<Product[]>(K_PRODUCTS, []);
}

// ── Pending transactions queue ───────────────────────────────────────────────
export async function getPendingTransactions(): Promise<PendingTransaction[]> {
  return readJson<PendingTransaction[]>(K_PENDING, []);
}

export async function setPendingTransactions(
  list: PendingTransaction[],
): Promise<void> {
  await writeJson(K_PENDING, list);
}

export async function enqueueTransaction(
  txn: Omit<PendingTransaction, "status" | "retries" | "created_at"> & {
    created_at?: string;
  },
): Promise<PendingTransaction> {
  const list = await getPendingTransactions();
  const rec: PendingTransaction = {
    ...txn,
    created_at: txn.created_at ?? new Date().toISOString(),
    status: "pending",
    retries: 0,
  };
  list.push(rec);
  await setPendingTransactions(list);
  return rec;
}

export async function removePendingTransaction(local_id: string): Promise<void> {
  const list = await getPendingTransactions();
  await setPendingTransactions(list.filter((t) => t.local_id !== local_id));
}

export async function markPendingTransaction(
  local_id: string,
  patch: Partial<PendingTransaction>,
): Promise<void> {
  const list = await getPendingTransactions();
  const idx = list.findIndex((t) => t.local_id === local_id);
  if (idx === -1) return;
  list[idx] = { ...list[idx], ...patch };
  await setPendingTransactions(list);
}

export async function countPendingTransactions(): Promise<number> {
  const list = await getPendingTransactions();
  return list.length;
}

// ── Last sync timestamp ──────────────────────────────────────────────────────
export async function setLastSync(ts: string = new Date().toISOString()): Promise<void> {
  try {
    await AsyncStorage.setItem(K_LAST_SYNC, ts);
  } catch {}
}

export async function getLastSync(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(K_LAST_SYNC);
  } catch {
    return null;
  }
}

// ── Purge (on logout) ────────────────────────────────────────────────────────
export async function purgeOfflineStore(): Promise<void> {
  await Promise.all(
    [K_CUSTOMERS, K_PRODUCTS, K_CUSTOMERS_TS, K_PRODUCTS_TS, K_PENDING, K_LAST_SYNC].map((k) =>
      AsyncStorage.removeItem(k).catch(() => {}),
    ),
  );
}
