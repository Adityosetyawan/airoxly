import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme, rp } from "@/src/theme";
import { useToast } from "@/src/components/Toast";
import { useOnlineStatus } from "@/src/hooks/useOnlineStatus";
import {
  getLastSync,
  getPendingCustomers,
  getPendingTransactions,
  removePendingCustomer,
  removeCachedCustomer,
  removePendingTransaction,
  type PendingCustomer,
  type PendingTransaction,
} from "@/src/utils/offlineStore";
import {
  isSyncRunning,
  subscribeSyncEvents,
  syncPendingTransactions,
} from "@/src/utils/offlineSync";

/**
 * Persistent status strip shown at the top of every Sales screen. Shows:
 *   • Offline pill when the device has no connectivity.
 *   • Pending-queue pill (with count) when any offline transactions still
 *     need to be flushed to the backend.
 *   • Live-syncing state when a flush is in progress.
 *
 * Tapping the pill opens a modal listing the pending transactions with
 * "retry" / "hapus" actions per-item, plus a "sinkron semua sekarang" CTA.
 */
export default function OfflineBanner() {
  const online = useOnlineStatus();
  const toast = useToast();

  const [pending, setPending] = useState<PendingTransaction[]>([]);
  const [pendingCust, setPendingCust] = useState<PendingCustomer[]>([]);
  const [running, setRunning] = useState<boolean>(isSyncRunning());
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const refresh = useCallback(async () => {
    const [list, custList, ts] = await Promise.all([
      getPendingTransactions(),
      getPendingCustomers(),
      getLastSync(),
    ]);
    setPending(list);
    setPendingCust(custList);
    setLastSync(ts);
    setRunning(isSyncRunning());
  }, []);

  useEffect(() => {
    refresh();
    const unsub = subscribeSyncEvents(refresh);
    return () => {
      unsub();
    };
  }, [refresh]);

  const totalPending = pending.length + pendingCust.length;

  // Auto-trigger sync when we detect a fresh online transition AND have work.
  useEffect(() => {
    if (online && totalPending > 0 && !running) {
      syncPendingTransactions().then((r) => {
        if (r.succeeded > 0) {
          toast.show(`${r.succeeded} item tersinkron`, "success");
        }
        if (r.failed > 0) {
          toast.show(`${r.failed} gagal sync — cek daftar antrian`, "error");
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, totalPending]);

  const failedCount = useMemo(
    () =>
      pending.filter((p) => p.status === "failed").length +
      pendingCust.filter((p) => p.status === "failed").length,
    [pending, pendingCust],
  );

  // Nothing to show when everything is fine.
  if (online && totalPending === 0) return null;

  const doSyncNow = async () => {
    if (!online) {
      toast.show("Masih offline — coba lagi saat sinyal kembali", "error");
      return;
    }
    const r = await syncPendingTransactions();
    if (r.succeeded > 0) {
      toast.show(`${r.succeeded} transaksi tersinkron`, "success");
    }
    if (r.failed > 0) {
      toast.show(`${r.failed} gagal — cek detail`, "error");
    }
    if (r.attempted === 0) {
      toast.show("Tidak ada transaksi pending", "success");
    }
  };

  const bg = !online
    ? "#B45309" // amber-dark for offline
    : failedCount > 0
    ? theme.color.error
    : theme.color.brandPrimary;

  const icon = !online ? "cloud-offline" : running ? "sync" : failedCount > 0 ? "warning" : "cloud-upload";

  const label = !online
    ? totalPending > 0
      ? `Offline — ${totalPending} item menunggu sync`
      : "Mode Offline — data disimpan lokal"
    : running
    ? `Menyinkron ${totalPending} item…`
    : failedCount > 0
    ? `${failedCount} gagal · ${totalPending - failedCount} pending — tap untuk retry`
    : `${totalPending} item menunggu sync — tap untuk sinkron`;

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.85}
        style={[styles.bar, { backgroundColor: bg }]}
        onPress={() => setDetailOpen(true)}
        testID="offline-banner"
      >
        <Ionicons name={icon as any} size={16} color="#fff" />
        <Text style={styles.barText} numberOfLines={1}>{label}</Text>
        <Ionicons name="chevron-forward" size={14} color="#fff" />
      </TouchableOpacity>

      <Modal
        visible={detailOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailOpen(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setDetailOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>Antrian Transaksi Offline</Text>
                <Text style={styles.sheetSub}>
                  {online ? "🟢 Online" : "🔴 Offline"}
                  {lastSync && "  ·  Terakhir sync: " + new Date(lastSync).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setDetailOpen(false)} style={styles.closeBtn} testID="close-offline-detail">
                <Ionicons name="close" size={22} color={theme.color.onSurface} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={{ padding: 12 }}>
              {totalPending === 0 ? (
                <View style={styles.empty}>
                  <Ionicons name="checkmark-done" size={36} color={theme.color.success} />
                  <Text style={styles.emptyText}>Tidak ada item menunggu</Text>
                </View>
              ) : (
                <>
                  {pendingCust.length > 0 && (
                    <Text style={styles.sectionLabel}>Pelanggan Baru ({pendingCust.length})</Text>
                  )}
                  {pendingCust.map((c) => (
                    <View key={c.local_id} style={styles.row} testID={`pending-cust-${c.local_id}`}>
                      <View style={styles.rowStatus}>
                        <Ionicons
                          name={
                            c.status === "failed"
                              ? "alert-circle"
                              : c.status === "syncing"
                              ? "sync"
                              : "person-add"
                          }
                          size={18}
                          color={
                            c.status === "failed"
                              ? theme.color.error
                              : c.status === "syncing"
                              ? theme.color.brand
                              : theme.color.muted
                          }
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle} numberOfLines={1}>{c.name}</Text>
                        <Text style={styles.rowSub} numberOfLines={2}>
                          {new Date(c.created_at).toLocaleString("id-ID", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}
                          {c.wa_number ? "  ·  " + c.wa_number : ""}
                        </Text>
                        {c.status === "failed" && c.error ? (
                          <Text style={styles.rowError} numberOfLines={2}>Gagal: {c.error}</Text>
                        ) : null}
                      </View>
                      <TouchableOpacity
                        style={styles.delBtn}
                        onPress={async () => {
                          await removePendingCustomer(c.local_id);
                          await removeCachedCustomer(c.local_id);
                          refresh();
                          toast.show("Pelanggan pending dihapus", "success");
                        }}
                        testID={`delete-pending-cust-${c.local_id}`}
                      >
                        <Ionicons name="trash-outline" size={16} color={theme.color.error} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {pending.length > 0 && (
                    <Text style={[styles.sectionLabel, { marginTop: 12 }]}>Transaksi ({pending.length})</Text>
                  )}
                  {pending.map((t) => (
                    <View key={t.local_id} style={styles.row} testID={`pending-txn-${t.local_id}`}>
                      <View style={styles.rowStatus}>
                        <Ionicons
                          name={
                            t.status === "failed"
                              ? "alert-circle"
                              : t.status === "syncing"
                              ? "sync"
                              : "time"
                          }
                          size={18}
                          color={
                            t.status === "failed"
                              ? theme.color.error
                              : t.status === "syncing"
                              ? theme.color.brand
                              : theme.color.muted
                          }
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {t.customer_name}
                          {t.customer_no ? "  ·  #" + t.customer_no : ""}
                        </Text>
                        <Text style={styles.rowSub} numberOfLines={2}>
                          {new Date(t.created_at).toLocaleString("id-ID", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}
                          {"  ·  Rp "}{rp(t.total)}
                          {"  ·  bayar Rp "}{rp(t.bayar)}
                        </Text>
                        {t.status === "failed" && t.error ? (
                          <Text style={styles.rowError} numberOfLines={2}>Gagal: {t.error}</Text>
                        ) : null}
                      </View>
                      <TouchableOpacity
                        style={styles.delBtn}
                        onPress={async () => {
                          await removePendingTransaction(t.local_id);
                          refresh();
                          toast.show("Transaksi pending dihapus", "success");
                        }}
                        testID={`delete-pending-${t.local_id}`}
                      >
                        <Ionicons name="trash-outline" size={16} color={theme.color.error} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </>
              )}
            </ScrollView>

            <View style={styles.footer}>
              <Text style={styles.footerHint}>
                💡 Transaksi otomatis tersinkron saat sinyal kembali. Anda bisa tap Sinkron Sekarang untuk mencoba manual.
              </Text>
              <TouchableOpacity
                style={[styles.syncBtn, (running || !online) && { opacity: 0.5 }]}
                onPress={doSyncNow}
                disabled={running || !online}
                testID="sync-now-btn"
              >
                <Ionicons name={running ? "sync" : "cloud-upload"} size={16} color="#fff" />
                <Text style={styles.syncBtnText}>{running ? "Menyinkron…" : "Sinkron Sekarang"}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  barText: { color: "#fff", flex: 1, fontSize: 12, fontWeight: "600" },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: theme.color.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.color.border,
  },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: theme.color.onSurface },
  sheetSub: { fontSize: 11, color: theme.color.muted, marginTop: 2 },
  closeBtn: { padding: 6, borderRadius: 999, backgroundColor: theme.color.surfaceSecondary },
  empty: { alignItems: "center", padding: 32 },
  emptyText: { color: theme.color.muted, marginTop: 8, fontSize: 13 },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: theme.color.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.color.border,
    marginBottom: 8,
    gap: 10,
  },
  rowStatus: { width: 28, alignItems: "center" },
  rowTitle: { fontSize: 13, fontWeight: "600", color: theme.color.onSurface },
  rowSub: { fontSize: 11, color: theme.color.muted, marginTop: 2 },
  rowError: { fontSize: 11, color: theme.color.error, marginTop: 3, fontWeight: "500" },
  delBtn: { padding: 6, borderRadius: 8 },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.color.border,
    gap: 10,
  },
  footerHint: { fontSize: 11, color: theme.color.muted, lineHeight: 16 },
  syncBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.color.brandPrimary,
  },
  syncBtnText: { color: "#fff", fontWeight: "700" },
});
