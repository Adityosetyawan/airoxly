import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";

import { theme, rp } from "@/src/theme";
import { api, Customer } from "@/src/api";
import { useToast } from "@/src/components/Toast";
import { sendWhatsApp } from "@/src/whatsapp";
import { useAuth } from "@/src/AuthContext";

type Tab = "debt" | "inactive";

type DebtRow = Customer & { debt_days: number; debt_since: string };
type InactiveRow = Customer & { days_inactive: number };

const DEFAULT_DEBT_DAYS = 14;
const DEFAULT_INACTIVE_WEEKS = 4;

export default function CustomerReminders() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();

  const [tab, setTab] = useState<Tab>("debt");
  const [debtDays, setDebtDays] = useState<number>(DEFAULT_DEBT_DAYS);
  const [inactiveWeeks, setInactiveWeeks] = useState<number>(DEFAULT_INACTIVE_WEEKS);
  const [showSettings, setShowSettings] = useState(false);
  const [tmpDebt, setTmpDebt] = useState(String(DEFAULT_DEBT_DAYS));
  const [tmpInact, setTmpInact] = useState(String(DEFAULT_INACTIVE_WEEKS));

  const [debtRows, setDebtRows] = useState<DebtRow[]>([]);
  const [inactiveRows, setInactiveRows] = useState<InactiveRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await api.customerReminders({
        debt_days: debtDays,
        inactive_weeks: inactiveWeeks,
      });
      setDebtRows(r.debt_overdue);
      setInactiveRows(r.inactive);
    } catch (e: any) {
      toast.show(e?.message || "Gagal muat reminder", "error");
    } finally {
      setLoading(false);
    }
  }, [debtDays, inactiveWeeks, toast]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const applySettings = () => {
    const d = parseInt(tmpDebt) || DEFAULT_DEBT_DAYS;
    const w = parseInt(tmpInact) || DEFAULT_INACTIVE_WEEKS;
    setDebtDays(Math.max(1, Math.min(365, d)));
    setInactiveWeeks(Math.max(1, Math.min(52, w)));
    setShowSettings(false);
  };

  const openWA = async (c: DebtRow | InactiveRow, kind: Tab) => {
    if (!c.wa_number) {
      toast.show("Nomor WA belum diset", "error");
      return;
    }
    const name = c.name;
    const sales = user?.sales_code || user?.username || "Sales";
    const store = "Air OXLY";
    let msg = "";
    if (kind === "debt") {
      const debtRow = c as DebtRow;
      msg =
        `Halo Bapak/Ibu *${name}* 🙏\n\n` +
        `Ini ${sales} dari ${store}. Kami mau mengingatkan bahwa terdapat sisa pembayaran ` +
        `sebesar *Rp ${rp(c.total_debt || 0)}* yang tercatat sejak ${new Date(debtRow.debt_since + "T00:00:00").toLocaleDateString("id-ID")} (~${debtRow.debt_days} hari lalu).\n\n` +
        `Mohon konfirmasinya kapan bisa kami tagih. Terima kasih 🙌`;
    } else {
      const inRow = c as InactiveRow;
      msg =
        `Halo Bapak/Ibu *${name}* 👋\n\n` +
        `Ini ${sales} dari ${store}. Sudah ~${inRow.days_inactive} hari sejak pembelian air terakhir. ` +
        `Apakah Bapak/Ibu masih membutuhkan pesanan galon minggu ini?\n\n` +
        `Kami siap antar 🚛💧`;
    }
    try {
      await sendWhatsApp(c.wa_number, msg);
    } catch (e: any) {
      toast.show(e?.message || "Gagal buka WhatsApp", "error");
    }
  };

  const data = tab === "debt" ? debtRows : inactiveRows;
  const debtTotal = useMemo(
    () => debtRows.reduce((a, c) => a + (c.total_debt || 0), 0),
    [debtRows],
  );

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="back-btn">
          <Ionicons name="chevron-back" size={22} color={theme.color.onSurface} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Pengingat Pelanggan</Text>
          <Text style={styles.subtitle}>
            {tab === "debt"
              ? `Piutang > ${debtDays} hari · ${debtRows.length} pelanggan`
              : `Tidak beli > ${inactiveWeeks} minggu · ${inactiveRows.length} pelanggan`}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.iconBtn} testID="settings-btn">
          <Ionicons name="options-outline" size={20} color={theme.color.onSurface} />
        </TouchableOpacity>
      </View>

      {/* Tab switch */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === "debt" && styles.tabBtnActive]}
          onPress={() => setTab("debt")}
          testID="tab-debt"
        >
          <Ionicons
            name="alert-circle"
            size={16}
            color={tab === "debt" ? theme.color.error : theme.color.muted}
          />
          <Text style={[styles.tabText, tab === "debt" && styles.tabTextActiveDebt]}>
            Piutang Lama
          </Text>
          {debtRows.length > 0 && (
            <View style={[styles.tabBadge, { backgroundColor: theme.color.error }]}>
              <Text style={styles.tabBadgeText}>{debtRows.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === "inactive" && styles.tabBtnActive]}
          onPress={() => setTab("inactive")}
          testID="tab-inactive"
        >
          <Ionicons
            name="time"
            size={16}
            color={tab === "inactive" ? theme.color.brand : theme.color.muted}
          />
          <Text style={[styles.tabText, tab === "inactive" && styles.tabTextActiveInactive]}>
            Lama Tidak Beli
          </Text>
          {inactiveRows.length > 0 && (
            <View style={[styles.tabBadge, { backgroundColor: theme.color.brandPrimary }]}>
              <Text style={styles.tabBadgeText}>{inactiveRows.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {tab === "debt" && debtTotal > 0 && (
        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>Total Piutang &gt; {debtDays} hari</Text>
          <Text style={styles.summaryValue}>Rp {rp(debtTotal)}</Text>
        </View>
      )}

      <FlatList
        data={data as any[]}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.color.brandPrimary}
          />
        }
        renderItem={({ item }) => (
          <View style={styles.card} testID={`reminder-${item.id}`}>
            <TouchableOpacity
              style={{ flex: 1 }}
              onPress={() =>
                router.push({ pathname: "/(sales)/customer/[id]", params: { id: item.id } })
              }
            >
              <View style={styles.cardHead}>
                <Text style={styles.cardName} numberOfLines={1}>
                  {item.name}
                </Text>
                <View
                  style={[
                    styles.daysBadge,
                    {
                      backgroundColor:
                        tab === "debt" ? theme.color.error : theme.color.brandPrimary,
                    },
                  ]}
                >
                  <Text style={styles.daysBadgeText}>
                    {tab === "debt"
                      ? `${(item as DebtRow).debt_days} hari`
                      : `${(item as InactiveRow).days_inactive} hari`}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardMeta}>
                #{item.customer_no} · {item.barcode_id}
                {item.wa_number ? "  ·  " + item.wa_number : "  ·  tanpa WA"}
              </Text>
              <View style={styles.metricsRow}>
                {tab === "debt" ? (
                  <>
                    <Metric label="Piutang" value={"Rp " + rp(item.total_debt || 0)} tone="error" />
                    <Metric
                      label="Sejak"
                      value={new Date(
                        (item as DebtRow).debt_since + "T00:00:00",
                      ).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}
                    />
                  </>
                ) : (
                  <>
                    <Metric
                      label="Terakhir Beli"
                      value={
                        item.last_purchase_date
                          ? new Date(item.last_purchase_date).toLocaleDateString("id-ID", {
                              day: "2-digit",
                              month: "short",
                            })
                          : "-"
                      }
                    />
                    <Metric label="Total Belanja" value={"Rp " + rp(item.total_purchases || 0)} />
                    <Metric label="Transaksi" value={String(item.purchase_count || 0) + "×"} />
                  </>
                )}
              </View>
            </TouchableOpacity>
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.waBtn}
                onPress={() => openWA(item, tab)}
                disabled={!item.wa_number}
                testID={`wa-${item.id}`}
              >
                <Ionicons
                  name="logo-whatsapp"
                  size={16}
                  color={item.wa_number ? "#fff" : "#9ca3af"}
                />
                <Text
                  style={[styles.waBtnText, !item.wa_number && { color: "#9ca3af" }]}
                >
                  Kirim WA
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.detailBtn}
                onPress={() =>
                  router.push({
                    pathname: "/(sales)/customer/[id]",
                    params: { id: item.id, action: "transact" },
                  })
                }
                testID={`transact-${item.id}`}
              >
                <Ionicons name="add-circle-outline" size={16} color={theme.color.brand} />
                <Text style={styles.detailBtnText}>Transaksi</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons
              name={tab === "debt" ? "checkmark-done-circle" : "sunny-outline"}
              size={48}
              color={theme.color.success}
            />
            <Text style={styles.emptyTitle}>
              {loading
                ? "Memuat…"
                : tab === "debt"
                ? "Tidak ada piutang menunggak"
                : "Semua pelanggan aktif"}
            </Text>
            <Text style={styles.emptySub}>
              {tab === "debt"
                ? `Tidak ada pelanggan dengan piutang > ${debtDays} hari 🎉`
                : `Tidak ada pelanggan yang tidak beli > ${inactiveWeeks} minggu 🎉`}
            </Text>
          </View>
        }
      />

      {/* Settings modal */}
      <Modal visible={showSettings} transparent animationType="fade" onRequestClose={() => setShowSettings(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowSettings(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Atur Ambang Reminder</Text>
            <Text style={styles.sheetHint}>
              Sesuaikan berapa lama piutang / berapa lama tidak beli baru dianggap perlu ditindaklanjuti.
            </Text>
            <View style={{ marginTop: 16 }}>
              <Text style={styles.inputLabel}>Piutang lebih dari (hari)</Text>
              <TextInput
                value={tmpDebt}
                onChangeText={(v) => setTmpDebt(v.replace(/[^\d]/g, ""))}
                keyboardType="number-pad"
                placeholder={String(DEFAULT_DEBT_DAYS)}
                placeholderTextColor={theme.color.muted}
                style={styles.input}
                testID="input-debt-days"
              />
            </View>
            <View style={{ marginTop: 12 }}>
              <Text style={styles.inputLabel}>Tidak beli lebih dari (minggu)</Text>
              <TextInput
                value={tmpInact}
                onChangeText={(v) => setTmpInact(v.replace(/[^\d]/g, ""))}
                keyboardType="number-pad"
                placeholder={String(DEFAULT_INACTIVE_WEEKS)}
                placeholderTextColor={theme.color.muted}
                style={styles.input}
                testID="input-inactive-weeks"
              />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }} contentContainerStyle={{ gap: 6 }}>
              {[
                { d: "7", label: "1mg" },
                { d: "14", label: "2mg" },
                { d: "30", label: "1bln" },
                { d: "60", label: "2bln" },
                { d: "90", label: "3bln" },
              ].map((p) => (
                <TouchableOpacity
                  key={p.d}
                  onPress={() => setTmpDebt(p.d)}
                  style={styles.presetChip}
                >
                  <Text style={styles.presetChipText}>Piutang {p.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowSettings(false)}>
                <Text style={styles.cancelBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyBtn} onPress={applySettings} testID="apply-settings">
                <Text style={styles.applyBtnText}>Terapkan</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "error" }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text
        style={[
          styles.metricValue,
          tone === "error" && { color: theme.color.error, fontWeight: "700" },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.color.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.color.border,
    gap: 6,
  },
  iconBtn: { padding: 8, borderRadius: 12, backgroundColor: theme.color.surfaceSecondary },
  title: { fontSize: 17, fontWeight: "700", color: theme.color.onSurface },
  subtitle: { fontSize: 11, color: theme.color.muted, marginTop: 2 },
  tabRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.color.surfaceSecondary,
    borderWidth: 1,
    borderColor: "transparent",
  },
  tabBtnActive: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.brandPrimary,
  },
  tabText: { fontSize: 13, fontWeight: "600", color: theme.color.muted },
  tabTextActiveDebt: { color: theme.color.error },
  tabTextActiveInactive: { color: theme.color.brand },
  tabBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    minWidth: 22,
    alignItems: "center",
  },
  tabBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  summary: {
    marginHorizontal: 16,
    marginBottom: 4,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#FEE2E2",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: { fontSize: 12, color: "#991B1B", fontWeight: "500" },
  summaryValue: { fontSize: 16, fontWeight: "800", color: theme.color.error },
  card: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    gap: 8,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardName: { flex: 1, fontSize: 15, fontWeight: "700", color: theme.color.onSurface },
  daysBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  daysBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  cardMeta: { fontSize: 11, color: theme.color.muted },
  metricsRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 4 },
  metric: { minWidth: 96 },
  metricLabel: { fontSize: 10, color: theme.color.muted, fontWeight: "500" },
  metricValue: { fontSize: 13, fontWeight: "600", color: theme.color.onSurface, marginTop: 2 },
  actionsRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  waBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#25D366",
  },
  waBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  detailBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.color.brandPrimary,
  },
  detailBtnText: { color: theme.color.brand, fontWeight: "700", fontSize: 12 },
  empty: { alignItems: "center", padding: 40 },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: theme.color.onSurface, marginTop: 12 },
  emptySub: { fontSize: 12, color: theme.color.muted, marginTop: 4, textAlign: "center" },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  sheet: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: theme.color.surface,
    borderRadius: 18,
    padding: 20,
  },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: theme.color.onSurface, textAlign: "center" },
  sheetHint: { fontSize: 12, color: theme.color.muted, textAlign: "center", marginTop: 6, lineHeight: 16 },
  inputLabel: { fontSize: 12, color: theme.color.muted, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: theme.color.onSurface,
    backgroundColor: theme.color.surfaceSecondary,
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: theme.color.brandTertiary,
    borderWidth: 1,
    borderColor: theme.color.brandPrimary,
  },
  presetChipText: { fontSize: 11, color: theme.color.brand, fontWeight: "700" },
  sheetActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  cancelBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.color.border,
    alignItems: "center",
  },
  cancelBtnText: { color: theme.color.onSurface, fontWeight: "600" },
  applyBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.color.brandPrimary,
    alignItems: "center",
  },
  applyBtnText: { color: "#fff", fontWeight: "700" },
});
