import React, { useCallback, useRef, useState } from "react";
import { FlatList, Modal, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import ViewShot from "react-native-view-shot";
import { theme, rp } from "@/src/theme";
import { api, Expense, Transaction } from "@/src/api";
import { useAuth } from "@/src/AuthContext";
import { ExpenseModal } from "@/src/components/ExpenseModal";
import { useToast } from "@/src/components/Toast";
import PromoPoster from "@/src/components/PromoPoster";
import { saveShot, shareShot } from "@/src/utils/capture";

const CAT_ICONS: Record<string, any> = {
  BBM: "car-outline",
  Servis: "construct-outline",
  "Lain-lain": "ellipsis-horizontal-outline",
};

export default function SalesDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [stats, setStats] = useState<any>(null);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [lottery, setLottery] = useState<any | null>(null);
  const [lotteryCount, setLotteryCount] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);
  const [expenseModal, setExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [posterOpen, setPosterOpen] = useState(false);
  const [posterBusy, setPosterBusy] = useState<null | "save" | "share">(null);
  const posterShotRef = useRef<ViewShot>(null);
  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    try {
      const [s, t, e, lp, ls] = await Promise.all([
        api.overview(),
        api.listTransactions({ date_from: today, date_to: today }),
        api.listExpenses({ date_from: today, date_to: today }),
        api.activeLotteryPeriod(),
        api.lotteryStats().catch(() => null),
      ]);
      setStats(s);
      setTxns(t);
      setExpenses(e);
      setLottery(lp);
      setLotteryCount(ls?.total_tickets || 0);
    } catch {}
  }, [today]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const deleteExpense = async (id: string) => {
    try {
      await api.deleteExpense(id);
      toast.show("Pengeluaran dihapus", "success");
      load();
    } catch (e: any) {
      toast.show(e.message || "Gagal", "error");
    }
  };

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.hello}>Halo, {user?.name || user?.username}</Text>
          <Text style={styles.code}>Sales • {user?.sales_code || user?.username}</Text>
        </View>
        <TouchableOpacity onPress={logout} testID="logout-button" style={styles.iconBtn}>
          <Ionicons name="log-out-outline" size={22} color={theme.color.onSurface} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={[]}
        keyExtractor={() => "x"}
        renderItem={() => null}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.color.brandPrimary} />}
        ListHeaderComponent={
          <View>
            {/* HERO: SETORAN (net) */}
            <View style={styles.depositCard} testID="kpi-setoran">
              <View style={{ flex: 1 }}>
                <Text style={styles.depositLabel}>Setoran ke Admin (net)</Text>
                <Text style={styles.depositValue}>Rp {rp(stats?.today_deposit || 0)}</Text>
                <Text style={styles.depositFormula}>
                  = Uang Diterima Rp {rp(stats?.today_revenue || 0)}
                  {"  −  "}
                  Pengeluaran Rp {rp(stats?.today_expenses || 0)}
                </Text>
              </View>
              <View style={styles.depositIcon}>
                <Ionicons name="wallet" size={28} color="#fff" />
              </View>
            </View>

            {/* KPI ROW */}
            <View style={styles.kpiRow}>
              <View style={[styles.kpi, { backgroundColor: theme.color.brandTertiary }]} testID="kpi-uang">
                <Ionicons name="cash-outline" size={16} color={theme.color.onBrandTertiary} />
                <Text style={styles.kpiLabel}>Uang Diterima</Text>
                <Text style={styles.kpiValue}>Rp {rp(stats?.today_revenue || 0)}</Text>
              </View>
              <View style={[styles.kpi, { backgroundColor: "#FEE2E2" }]} testID="kpi-pengeluaran">
                <Ionicons name="remove-circle-outline" size={16} color={theme.color.error} />
                <Text style={[styles.kpiLabel, { color: "#991B1B" }]}>Pengeluaran</Text>
                <Text style={[styles.kpiValue, { color: theme.color.error }]}>Rp {rp(stats?.today_expenses || 0)}</Text>
              </View>
              <View style={[styles.kpi, { backgroundColor: theme.color.surfaceSecondary }]} testID="kpi-galon">
                <Ionicons name="water-outline" size={16} color={theme.color.brand} />
                <Text style={styles.kpiLabel}>Galon Terjual</Text>
                <Text style={styles.kpiValue}>{stats?.today_gln_sold || 0}<Text style={styles.kpiUnit}> gln</Text></Text>
              </View>
            </View>

            <View style={styles.miniRow}>
              <MiniStat label="Transaksi" value={String(stats?.today_count || 0)} />
              <MiniStat label="Nilai Jual" value={"Rp " + rp(stats?.today_total || 0)} />
              <MiniStat label="Pelanggan" value={String(stats?.total_customers || 0)} />
            </View>

            {lottery && (
              <View style={styles.lotteryBanner} testID="lottery-banner">
                <TouchableOpacity
                  onPress={() => router.push("/(sales)/winners")}
                  activeOpacity={0.7}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}
                >
                  <View style={styles.lotteryIcon}>
                    <Ionicons name="gift" size={20} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.lotteryTitle}>{lottery.name}</Text>
                    <Text style={styles.lotterySub}>
                      {lotteryCount} tiket dari grup Anda · Tap untuk pemenang
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setPosterOpen(true)}
                  style={styles.posterChip}
                  testID="open-poster-btn"
                >
                  <Ionicons name="megaphone" size={12} color={theme.color.brand} />
                  <Text style={styles.posterChipText}>Poster</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ACTIONS */}
            <View style={styles.actions}>
              <TouchableOpacity style={styles.act} onPress={() => router.push("/(sales)/scan")} testID="action-scan">
                <Ionicons name="scan" size={20} color={theme.color.brand} />
                <Text style={styles.actText}>Scan / Baru</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.act} onPress={() => router.push("/(sales)/customers")} testID="action-customers">
                <Ionicons name="people" size={20} color={theme.color.brand} />
                <Text style={styles.actText}>Pelanggan</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.act, { backgroundColor: "#FEE2E2" }]} onPress={() => { setEditingExpense(null); setExpenseModal(true); }} testID="action-expense">
                <Ionicons name="add-circle" size={20} color={theme.color.error} />
                <Text style={[styles.actText, { color: theme.color.error }]}>Pengeluaran</Text>
              </TouchableOpacity>
            </View>

            {/* EXPENSES TODAY */}
            <View style={styles.secHeader}>
              <Text style={styles.section}>Pengeluaran Hari Ini ({expenses.length})</Text>
              <TouchableOpacity onPress={() => { setEditingExpense(null); setExpenseModal(true); }} testID="add-expense-header-btn">
                <Text style={styles.addLink}>+ Tambah</Text>
              </TouchableOpacity>
            </View>
            {expenses.length === 0 ? (
              <View style={styles.expEmpty}>
                <Text style={styles.expEmptyText}>Belum ada pengeluaran hari ini</Text>
              </View>
            ) : (
              expenses.map((e) => (
                <View key={e.id} style={styles.expRow} testID={`expense-${e.id}`}>
                  <TouchableOpacity
                    style={styles.expIcon}
                    onPress={() => { setEditingExpense(e); setExpenseModal(true); }}
                    testID={`edit-expense-${e.id}`}
                  >
                    {e.photo_base64 ? (
                      <Ionicons name="receipt" size={18} color={theme.color.brandPrimary} />
                    ) : (
                      <Ionicons name={CAT_ICONS[e.category] || "cash-outline"} size={18} color={theme.color.error} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1 }}
                    onPress={() => { setEditingExpense(e); setExpenseModal(true); }}
                  >
                    <Text style={styles.expCat}>
                      {e.category}
                      {e.photo_base64 ? <Text style={{ color: theme.color.brandPrimary, fontSize: 11 }}>  · 📷 nota</Text> : null}
                    </Text>
                    <Text style={styles.expDesc} numberOfLines={1}>
                      {e.description || new Date(e.date).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.expAmount}>−Rp {rp(e.amount)}</Text>
                  <TouchableOpacity onPress={() => deleteExpense(e.id)} style={styles.expDel} testID={`del-expense-${e.id}`}>
                    <Ionicons name="close" size={18} color={theme.color.muted} />
                  </TouchableOpacity>
                </View>
              ))
            )}

            {/* TRANSACTIONS TODAY */}
            <Text style={styles.section}>Transaksi Hari Ini ({txns.length})</Text>
          </View>
        }
        ListFooterComponent={
          <View>
            {txns.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.tx}
                onPress={() => router.push({ pathname: "/(sales)/transaction/[id]", params: { id: item.id } })}
                testID={`tx-${item.id}`}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.txName}>{item.customer_name}</Text>
                  <Text style={styles.txSub}>
                    {new Date(item.date).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                    {" · "}
                    {item.items.reduce((a, b) => a + b.qty, 0)} item
                    {item.edited ? " · diedit" : ""}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.txTotal}>Rp {rp(item.total)}</Text>
                  {item.hutang_transaksi > 0 && (
                    <Text style={styles.txDebt}>Hutang Rp {rp(item.hutang_transaksi)}</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
            {txns.length === 0 && (
              <View style={styles.empty}>
                <Ionicons name="water-outline" size={40} color={theme.color.brandSecondary} />
                <Text style={styles.emptyTitle}>Belum ada transaksi hari ini</Text>
                <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push("/(sales)/scan")} testID="empty-start-btn">
                  <Text style={styles.emptyBtnText}>Mulai Transaksi</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        }
      />

      <ExpenseModal
        visible={expenseModal}
        expense={editingExpense}
        onClose={() => { setExpenseModal(false); setEditingExpense(null); }}
        onSaved={() => { setExpenseModal(false); setEditingExpense(null); load(); }}
      />

      {/* Promo Poster Modal (Sales) */}
      <Modal visible={posterOpen} animationType="slide" transparent onRequestClose={() => setPosterOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalWrap}>
            <Text style={styles.modalTitle}>Poster Promosi Undian</Text>
            <ScrollView style={{ maxHeight: 500 }} contentContainerStyle={{ alignItems: "center", padding: 4 }}>
              {lottery && (
                <View nativeID="oxly-sales-poster-shot">
                  <ViewShot ref={posterShotRef} options={{ format: "png", quality: 1 }}>
                    <PromoPoster
                      periodName={lottery.name}
                      startDate={lottery.start_date}
                      endDate={lottery.end_date}
                      winnerCount={lottery.winner_count}
                      prizeDescription={lottery.prize_description}
                      description={lottery.description}
                    />
                  </ViewShot>
                </View>
              )}
            </ScrollView>
            <Text style={styles.modalHint}>
              Bagikan poster ke pelanggan/media sosial untuk memperbanyak peserta undian.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={async () => {
                  setPosterBusy("save");
                  try {
                    await saveShot(posterShotRef, "oxly-sales-poster-shot", "OXLY-Poster-Undian");
                    toast.show(Platform.OS === "web" ? "Poster diunduh" : "Poster tersimpan di galeri", "success");
                  } catch (e: any) {
                    toast.show(e?.message || "Gagal simpan", "error");
                  } finally {
                    setPosterBusy(null);
                  }
                }}
                disabled={posterBusy !== null}
                style={[styles.modalGhost, posterBusy !== null && { opacity: 0.6 }]}
                testID="save-sales-poster-btn"
              >
                <Ionicons name="download-outline" size={16} color={theme.color.brand} />
                <Text style={styles.modalGhostText}>{posterBusy === "save" ? "…" : "Simpan"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  setPosterBusy("share");
                  try {
                    await shareShot(posterShotRef, "oxly-sales-poster-shot", "OXLY-Poster-Undian", "Poster Undian Air OXLY");
                  } catch (e: any) {
                    toast.show(e?.message || "Gagal share", "error");
                  } finally {
                    setPosterBusy(null);
                  }
                }}
                disabled={posterBusy !== null}
                style={[styles.modalPrimary, posterBusy !== null && { opacity: 0.6 }]}
                testID="share-sales-poster-btn"
              >
                <Ionicons name="share-social" size={16} color="#fff" />
                <Text style={styles.modalPrimaryText}>{posterBusy === "share" ? "…" : "Share"}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setPosterOpen(false)} style={styles.modalGhost} testID="close-sales-poster-btn">
                <Text style={styles.modalGhostText}>Tutup</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.mini}>
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={styles.miniValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.color.surface },
  header: { flexDirection: "row", alignItems: "center", padding: 16, justifyContent: "space-between" },
  hello: { fontSize: 18, fontWeight: "600", color: theme.color.onSurface },
  code: { fontSize: 13, color: theme.color.muted, marginTop: 2 },
  iconBtn: { padding: 8, borderRadius: 12, backgroundColor: theme.color.surfaceSecondary },
  depositCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderRadius: 20,
    backgroundColor: theme.color.brandPrimary,
    marginBottom: 12,
    shadowColor: theme.color.brandPrimary,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  depositLabel: { fontSize: 12, color: "#D1FAE5", fontWeight: "500" },
  depositValue: { fontSize: 30, fontWeight: "700", color: "#fff", marginTop: 6, letterSpacing: -0.8 },
  depositFormula: { fontSize: 11, color: "#A7F3D0", marginTop: 6 },
  depositIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  kpiRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  kpi: { flex: 1, borderRadius: 14, padding: 12, gap: 4 },
  kpiLabel: { fontSize: 10, color: theme.color.onBrandTertiary, fontWeight: "500" },
  kpiValue: { fontSize: 14, fontWeight: "700", color: theme.color.onSurface, letterSpacing: -0.3 },
  kpiUnit: { fontSize: 11, color: theme.color.muted, fontWeight: "400" },
  miniRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  lotteryBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: theme.color.brandTertiary,
    borderWidth: 1,
    borderColor: theme.color.brandPrimary,
    marginBottom: 16,
  },
  lotteryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.color.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  lotteryTitle: { fontSize: 13, fontWeight: "700", color: theme.color.brand },
  lotterySub: { fontSize: 11, color: theme.color.onBrandTertiary, marginTop: 2 },
  lotteryChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: theme.color.brandPrimary,
  },
  lotteryChipText: { color: "#fff", fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
  posterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: theme.color.brandPrimary,
  },
  posterChipText: { color: theme.color.brand, fontSize: 11, fontWeight: "700" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 16,
  },
  modalWrap: {
    backgroundColor: theme.color.surface,
    borderRadius: 16,
    padding: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: theme.color.onSurface,
    marginBottom: 8,
    textAlign: "center",
  },
  modalHint: { fontSize: 11, color: theme.color.muted, textAlign: "center", marginTop: 8, marginHorizontal: 12 },
  modalActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  modalGhost: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.color.border,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  modalGhostText: { color: theme.color.brand, fontWeight: "600" },
  modalPrimary: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: theme.color.brandPrimary,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  modalPrimaryText: { color: "#fff", fontWeight: "700" },
  mini: { flex: 1, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: theme.color.border },
  miniLabel: { fontSize: 11, color: theme.color.muted },
  miniValue: { fontSize: 13, fontWeight: "600", color: theme.color.onSurface, marginTop: 2 },
  actions: { flexDirection: "row", gap: 8, marginBottom: 16 },
  act: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 12, borderRadius: 12, backgroundColor: theme.color.brandTertiary },
  actText: { color: theme.color.onBrandTertiary, fontWeight: "600", fontSize: 12 },
  secHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4, marginBottom: 8 },
  section: { fontSize: 15, fontWeight: "600", color: theme.color.onSurface },
  addLink: { fontSize: 13, color: theme.color.brand, fontWeight: "600" },
  expEmpty: { padding: 16, alignItems: "center", borderRadius: 12, backgroundColor: theme.color.surfaceSecondary, marginBottom: 16 },
  expEmptyText: { color: theme.color.muted, fontSize: 12 },
  expRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  expIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  expCat: { fontSize: 14, fontWeight: "600", color: theme.color.onSurface },
  expDesc: { fontSize: 11, color: theme.color.muted, marginTop: 2 },
  expAmount: { fontSize: 14, fontWeight: "700", color: theme.color.error },
  expDel: { padding: 6, borderRadius: 6 },
  tx: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: 14,
    marginTop: 8,
    backgroundColor: theme.color.surface,
  },
  txName: { fontSize: 15, fontWeight: "500", color: theme.color.onSurface },
  txSub: { fontSize: 12, color: theme.color.muted, marginTop: 2 },
  txTotal: { fontSize: 15, fontWeight: "600", color: theme.color.brand },
  txDebt: { fontSize: 11, color: theme.color.error, marginTop: 2 },
  empty: { alignItems: "center", padding: 24, marginTop: 8 },
  emptyTitle: { fontSize: 13, color: theme.color.muted, marginTop: 12, marginBottom: 16 },
  emptyBtn: { backgroundColor: theme.color.brandPrimary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { color: "#fff", fontWeight: "600" },
});
