import React, { useCallback, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { theme, rp } from "@/src/theme";
import { api } from "@/src/api";
import { useToast } from "@/src/components/Toast";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function plusYearISO(days: number = 365): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

type Period = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  winner_count: number;
  is_active: boolean;
  drawn_at?: string | null;
  ticket_count?: number;
  winners?: any[];
};

export default function LotteryManagement() {
  const router = useRouter();
  const toast = useToast();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState<null | "new" | "edit">(null);
  const [editing, setEditing] = useState<Period | null>(null);
  const [form, setForm] = useState({
    name: "",
    start_date: todayISO(),
    end_date: plusYearISO(365),
    winner_count: "1",
    is_active: true,
  });
  const [busy, setBusy] = useState(false);
  const [detailPeriod, setDetailPeriod] = useState<Period | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, s] = await Promise.all([api.listLotteryPeriods(), api.lotteryStats()]);
      setPeriods(list);
      setStats(s);
    } catch (e: any) {
      toast.show(e?.message || "Gagal memuat", "error");
    }
  }, [toast]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", start_date: todayISO(), end_date: plusYearISO(365), winner_count: "1", is_active: true });
    setModalOpen("new");
  };

  const openEdit = (p: Period) => {
    if (p.drawn_at) {
      toast.show("Periode sudah diundi, tidak bisa diubah", "error");
      return;
    }
    setEditing(p);
    setForm({
      name: p.name,
      start_date: p.start_date,
      end_date: p.end_date,
      winner_count: String(p.winner_count),
      is_active: p.is_active,
    });
    setModalOpen("edit");
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.show("Nama periode harus diisi", "error");
      return;
    }
    const wc = parseInt(form.winner_count, 10);
    if (!wc || wc < 1) {
      toast.show("Jumlah pemenang minimal 1", "error");
      return;
    }
    if (form.start_date > form.end_date) {
      toast.show("Tanggal mulai harus sebelum tanggal selesai", "error");
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        await api.updateLotteryPeriod(editing.id, {
          name: form.name.trim(),
          start_date: form.start_date,
          end_date: form.end_date,
          winner_count: wc,
          is_active: form.is_active,
        });
        toast.show("Periode diperbarui", "success");
      } else {
        await api.createLotteryPeriod({
          name: form.name.trim(),
          start_date: form.start_date,
          end_date: form.end_date,
          winner_count: wc,
          is_active: form.is_active,
        });
        toast.show("Periode dibuat", "success");
      }
      setModalOpen(null);
      await load();
    } catch (e: any) {
      toast.show(e?.message || "Gagal simpan", "error");
    } finally {
      setBusy(false);
    }
  };

  const activate = async (p: Period) => {
    if (p.drawn_at) return;
    try {
      await api.activateLotteryPeriod(p.id);
      toast.show(`"${p.name}" sekarang aktif`, "success");
      await load();
    } catch (e: any) {
      toast.show(e?.message || "Gagal", "error");
    }
  };

  const remove = async (p: Period) => {
    const doDelete = async () => {
      try {
        await api.deleteLotteryPeriod(p.id);
        toast.show("Periode dihapus", "success");
        await load();
      } catch (e: any) {
        toast.show(e?.message || "Gagal", "error");
      }
    };
    if (Platform.OS === "web") {
      if (window.confirm(`Hapus periode "${p.name}"?`)) await doDelete();
      return;
    }
    Alert.alert("Hapus Periode", `Hapus "${p.name}"?`, [
      { text: "Batal", style: "cancel" },
      { text: "Hapus", style: "destructive", onPress: doDelete },
    ]);
  };

  const draw = async (p: Period) => {
    const doDraw = async () => {
      try {
        const r = await api.drawLottery(p.id);
        toast.show(`Berhasil mengundi ${r.winner_count} pemenang`, "success");
        await load();
      } catch (e: any) {
        toast.show(e?.message || "Gagal undi", "error");
      }
    };
    if (Platform.OS === "web") {
      if (window.confirm(`Undi ${p.winner_count} pemenang dari periode "${p.name}"? Aksi ini tidak bisa dibatalkan.`)) await doDraw();
      return;
    }
    Alert.alert(
      "Undi Sekarang",
      `Undi ${p.winner_count} pemenang dari periode "${p.name}"? Aksi ini tidak bisa dibatalkan.`,
      [
        { text: "Batal", style: "cancel" },
        { text: "Undi", onPress: doDraw },
      ],
    );
  };

  const active = periods.find((p) => p.is_active);

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} testID="back-btn">
          <Ionicons name="chevron-back" size={24} color={theme.color.onSurface} />
        </TouchableOpacity>
        <Text style={styles.title}>Undian Berhadiah</Text>
        <TouchableOpacity onPress={openNew} style={styles.addBtn} testID="add-period-btn">
          <Ionicons name="add" size={22} color={theme.color.brand} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.color.brandPrimary} />}
      >
        {active && (
          <View style={styles.activeCard}>
            <View style={styles.activeHead}>
              <Ionicons name="gift" size={20} color="#fff" />
              <Text style={styles.activeLbl}>Periode Aktif</Text>
            </View>
            <Text style={styles.activeName}>{active.name}</Text>
            <Text style={styles.activePeriod}>
              {fmtDate(active.start_date)} — {fmtDate(active.end_date)}
            </Text>
            <View style={styles.activeStats}>
              <View style={styles.activeStat}>
                <Text style={styles.activeStatVal}>{rp(stats?.total_tickets || 0)}</Text>
                <Text style={styles.activeStatLbl}>Total Tiket</Text>
              </View>
              <View style={styles.activeStat}>
                <Text style={styles.activeStatVal}>{active.winner_count}</Text>
                <Text style={styles.activeStatLbl}>Pemenang</Text>
              </View>
              <View style={styles.activeStat}>
                <Text style={styles.activeStatVal}>{(stats?.top_customers || []).length}</Text>
                <Text style={styles.activeStatLbl}>Peserta</Text>
              </View>
            </View>
          </View>
        )}

        {!active && (
          <View style={styles.noActive}>
            <Ionicons name="alert-circle-outline" size={24} color={theme.color.warning} />
            <Text style={styles.noActiveText}>Belum ada periode undian yang aktif</Text>
            <TouchableOpacity onPress={openNew} style={styles.noActiveBtn} testID="new-period-empty-btn">
              <Text style={styles.noActiveBtnText}>+ Buat Periode Baru</Text>
            </TouchableOpacity>
          </View>
        )}

        {active && stats?.top_customers?.length > 0 && (
          <>
            <Text style={styles.section}>Peserta Terbanyak Periode Aktif</Text>
            <View style={styles.card}>
              {stats.top_customers.slice(0, 5).map((c: any, i: number) => (
                <View key={c.customer_id} style={styles.rankRow}>
                  <View style={[styles.rankBadge, i === 0 && { backgroundColor: "#F59E0B" }, i === 1 && { backgroundColor: "#9CA3AF" }, i === 2 && { backgroundColor: "#B45309" }]}>
                    <Text style={styles.rankBadgeText}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rankName}>{c.customer_name}</Text>
                    <Text style={styles.rankSub}>#{c.customer_no} · Sales {c.sales_code}</Text>
                  </View>
                  <Text style={styles.rankCount}>{c.count} tiket</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <Text style={styles.section}>Semua Periode ({periods.length})</Text>
        {periods.map((p) => {
          const isPast = new Date(p.end_date + "T23:59:59") < new Date();
          return (
            <View key={p.id} style={styles.pCard} testID={`period-${p.id}`}>
              <View style={styles.pHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pName}>{p.name}</Text>
                  <Text style={styles.pPeriod}>
                    {fmtDate(p.start_date)} — {fmtDate(p.end_date)}
                  </Text>
                </View>
                {p.is_active ? (
                  <View style={[styles.badge, { backgroundColor: theme.color.brandPrimary }]}>
                    <Text style={styles.badgeText}>AKTIF</Text>
                  </View>
                ) : p.drawn_at ? (
                  <View style={[styles.badge, { backgroundColor: "#6b7280" }]}>
                    <Text style={styles.badgeText}>SELESAI</Text>
                  </View>
                ) : (
                  <View style={[styles.badge, { backgroundColor: theme.color.warning }]}>
                    <Text style={styles.badgeText}>DRAFT</Text>
                  </View>
                )}
              </View>
              <View style={styles.pStats}>
                <Text style={styles.pStatText}>🎟 {p.ticket_count ?? 0} tiket</Text>
                <Text style={styles.pStatText}>🏆 {p.winner_count} pemenang</Text>
              </View>
              {p.winners && p.winners.length > 0 && (
                <TouchableOpacity onPress={() => setDetailPeriod(p)} style={styles.winnersBtn} testID={`view-winners-${p.id}`}>
                  <Ionicons name="trophy" size={14} color="#B45309" />
                  <Text style={styles.winnersBtnText}>Lihat {p.winners.length} Pemenang</Text>
                </TouchableOpacity>
              )}
              <View style={styles.pActions}>
                {!p.is_active && !p.drawn_at && (
                  <TouchableOpacity onPress={() => activate(p)} style={styles.actionBtn} testID={`activate-${p.id}`}>
                    <Ionicons name="power" size={14} color={theme.color.brand} />
                    <Text style={styles.actionText}>Aktifkan</Text>
                  </TouchableOpacity>
                )}
                {!p.drawn_at && (p.ticket_count ?? 0) > 0 && (isPast || p.is_active) && (
                  <TouchableOpacity onPress={() => draw(p)} style={[styles.actionBtn, styles.actionBtnPrimary]} testID={`draw-${p.id}`}>
                    <Ionicons name="dice" size={14} color="#fff" />
                    <Text style={[styles.actionText, { color: "#fff" }]}>Undi Sekarang</Text>
                  </TouchableOpacity>
                )}
                {!p.drawn_at && (
                  <TouchableOpacity onPress={() => openEdit(p)} style={styles.actionBtn} testID={`edit-${p.id}`}>
                    <Ionicons name="create-outline" size={14} color={theme.color.brand} />
                    <Text style={styles.actionText}>Edit</Text>
                  </TouchableOpacity>
                )}
                {!p.drawn_at && (p.ticket_count ?? 0) === 0 && (
                  <TouchableOpacity onPress={() => remove(p)} style={[styles.actionBtn, { borderColor: theme.color.error }]} testID={`delete-${p.id}`}>
                    <Ionicons name="trash-outline" size={14} color={theme.color.error} />
                    <Text style={[styles.actionText, { color: theme.color.error }]}>Hapus</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
        {periods.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="gift-outline" size={44} color={theme.color.muted} />
            <Text style={styles.emptyText}>Belum ada periode undian dibuat</Text>
          </View>
        )}
      </ScrollView>

      {/* Create/Edit Modal */}
      <Modal visible={modalOpen !== null} animationType="slide" transparent onRequestClose={() => setModalOpen(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalWrap}>
            <Text style={styles.modalTitle}>
              {editing ? "Edit Periode" : "Periode Undian Baru"}
            </Text>
            <ScrollView contentContainerStyle={{ padding: 4 }}>
              <Text style={styles.lbl}>Nama Periode</Text>
              <TextInput
                value={form.name}
                onChangeText={(v) => setForm({ ...form, name: v })}
                placeholder="Contoh: Undian Tahunan 2026"
                placeholderTextColor={theme.color.muted}
                style={styles.input}
                testID="period-name-input"
              />
              <Text style={styles.lbl}>Tanggal Mulai</Text>
              <TextInput
                value={form.start_date}
                onChangeText={(v) => setForm({ ...form, start_date: v })}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.color.muted}
                style={[styles.input, styles.mono]}
                testID="period-start-input"
              />
              <Text style={styles.lbl}>Tanggal Selesai</Text>
              <TextInput
                value={form.end_date}
                onChangeText={(v) => setForm({ ...form, end_date: v })}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.color.muted}
                style={[styles.input, styles.mono]}
                testID="period-end-input"
              />
              <Text style={styles.lbl}>Jumlah Pemenang</Text>
              <TextInput
                value={form.winner_count}
                onChangeText={(v) => setForm({ ...form, winner_count: v.replace(/[^0-9]/g, "") })}
                placeholder="1"
                placeholderTextColor={theme.color.muted}
                style={styles.input}
                keyboardType="numeric"
                testID="period-winners-input"
              />
              <View style={styles.switchRow}>
                <Text style={styles.lbl}>Set sebagai periode aktif</Text>
                <Switch
                  value={form.is_active}
                  onValueChange={(v) => setForm({ ...form, is_active: v })}
                  trackColor={{ true: theme.color.brandPrimary, false: theme.color.border }}
                />
              </View>
              <Text style={styles.hint}>
                Hanya 1 periode bisa aktif dalam satu waktu. Mengaktifkan ini akan me-nonaktifkan periode lain.
              </Text>
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setModalOpen(null)} style={styles.modalCancel} testID="cancel-modal-btn">
                <Text style={styles.modalCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={save} disabled={busy} style={[styles.modalSave, busy && { opacity: 0.6 }]} testID="save-modal-btn">
                <Text style={styles.modalSaveText}>{busy ? "Menyimpan…" : "Simpan"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Winners Detail Modal */}
      <Modal visible={detailPeriod !== null} animationType="fade" transparent onRequestClose={() => setDetailPeriod(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalWrap}>
            <View style={styles.winHead}>
              <Ionicons name="trophy" size={22} color="#B45309" />
              <Text style={styles.modalTitle}>Pemenang Undian</Text>
            </View>
            <Text style={styles.winPeriod}>{detailPeriod?.name}</Text>
            <Text style={styles.winPeriodSub}>
              Diundi: {detailPeriod?.drawn_at ? new Date(detailPeriod.drawn_at).toLocaleString("id-ID") : "-"}
            </Text>
            <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={{ padding: 4 }}>
              {(detailPeriod?.winners || []).map((w: any) => (
                <View key={w.ticket_code} style={styles.winRow}>
                  <View
                    style={[
                      styles.winRank,
                      w.rank === 1 && { backgroundColor: "#F59E0B" },
                      w.rank === 2 && { backgroundColor: "#9CA3AF" },
                      w.rank === 3 && { backgroundColor: "#B45309" },
                    ]}
                  >
                    <Text style={styles.winRankText}>#{w.rank}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.winName}>{w.customer_name}</Text>
                    <Text style={styles.winSub}>#{w.customer_no} · Sales {w.sales_code}</Text>
                    <Text style={styles.winTicket}>{w.ticket_code}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setDetailPeriod(null)} style={[styles.modalSave, { flex: 1 }]} testID="close-winners-btn">
                <Text style={styles.modalSaveText}>Tutup</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.color.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.color.border,
  },
  back: { padding: 8 },
  title: { fontSize: 17, fontWeight: "600", color: theme.color.onSurface },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.color.brandTertiary,
  },
  activeCard: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: theme.color.brandPrimary,
    marginBottom: 20,
  },
  activeHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  activeLbl: { color: "#D1FAE5", fontWeight: "700", fontSize: 12, letterSpacing: 0.5 },
  activeName: { color: "#fff", fontSize: 20, fontWeight: "700", marginTop: 8 },
  activePeriod: { color: "#A7F3D0", fontSize: 12, marginTop: 4 },
  activeStats: {
    flexDirection: "row",
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.2)",
    paddingTop: 12,
  },
  activeStat: { flex: 1, alignItems: "center" },
  activeStatVal: { color: "#fff", fontSize: 22, fontWeight: "700" },
  activeStatLbl: { color: "#D1FAE5", fontSize: 10, marginTop: 2 },
  noActive: {
    alignItems: "center",
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.color.warning,
    borderStyle: "dashed",
    backgroundColor: "#FEF3C7",
    marginBottom: 20,
    gap: 8,
  },
  noActiveText: { color: theme.color.warning, fontWeight: "500" },
  noActiveBtn: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: theme.color.warning,
  },
  noActiveBtnText: { color: "#fff", fontWeight: "700" },
  section: { fontSize: 14, fontWeight: "600", marginBottom: 8, color: theme.color.onSurface },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.color.border,
    marginBottom: 20,
    overflow: "hidden",
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.color.border,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.color.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  rankBadgeText: { color: "#fff", fontWeight: "700" },
  rankName: { fontSize: 14, fontWeight: "500", color: theme.color.onSurface },
  rankSub: { fontSize: 11, color: theme.color.muted, marginTop: 2 },
  rankCount: { fontSize: 13, fontWeight: "700", color: theme.color.brand },
  pCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.color.border,
    padding: 12,
    marginBottom: 10,
  },
  pHead: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  pName: { fontSize: 15, fontWeight: "600", color: theme.color.onSurface },
  pPeriod: { fontSize: 12, color: theme.color.muted, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  pStats: { flexDirection: "row", gap: 14, marginTop: 8 },
  pStatText: { fontSize: 12, color: theme.color.onSurfaceSecondary },
  winnersBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#FEF3C7",
    alignSelf: "flex-start",
  },
  winnersBtnText: { color: "#B45309", fontSize: 12, fontWeight: "700" },
  pActions: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.color.brandPrimary,
  },
  actionBtnPrimary: { backgroundColor: theme.color.brandPrimary, borderColor: theme.color.brandPrimary },
  actionText: { color: theme.color.brand, fontSize: 12, fontWeight: "600" },
  empty: { alignItems: "center", padding: 40, gap: 12 },
  emptyText: { color: theme.color.muted },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 16,
  },
  modalWrap: {
    backgroundColor: theme.color.surface,
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: theme.color.onSurface,
    marginBottom: 16,
  },
  lbl: { fontSize: 12, color: theme.color.muted, marginTop: 8, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.color.onSurface,
  },
  mono: { fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }) },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  hint: { fontSize: 11, color: theme.color.muted, fontStyle: "italic", marginTop: 4 },
  modalActions: { flexDirection: "row", gap: 8, marginTop: 16 },
  modalCancel: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.color.border,
    alignItems: "center",
  },
  modalCancelText: { color: theme.color.onSurfaceSecondary, fontWeight: "600" },
  modalSave: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: theme.color.brandPrimary,
    alignItems: "center",
  },
  modalSaveText: { color: "#fff", fontWeight: "700" },
  // Winners modal
  winHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  winPeriod: { fontSize: 14, fontWeight: "600", color: theme.color.onSurface },
  winPeriodSub: { fontSize: 11, color: theme.color.muted, marginBottom: 12 },
  winRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 10,
    marginBottom: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  winRank: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.color.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  winRankText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  winName: { fontSize: 14, fontWeight: "600", color: theme.color.onSurface },
  winSub: { fontSize: 11, color: theme.color.muted, marginTop: 2 },
  winTicket: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.color.brand,
    marginTop: 4,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    letterSpacing: 0.5,
  },
});
