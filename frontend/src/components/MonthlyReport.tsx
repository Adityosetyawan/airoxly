import React, { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme, rp } from "@/src/theme";
import { api, User } from "@/src/api";
import { useToast } from "@/src/components/Toast";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

// Color rules per user spec
const COLOR_GREEN = "#DCFCE7"; // auto from sales
const COLOR_GREEN_TEXT = "#065F46";
const COLOR_YELLOW = "#FEF9C3"; // admin monthly input
const COLOR_YELLOW_TEXT = "#854D0E";
const COLOR_RED = "#FEE2E2"; // super admin permanent
const COLOR_RED_TEXT = "#7F1D1D";

export type MonthlyReportScreenProps = { canEditRed?: boolean; canEditYellow?: boolean };

export function MonthlyReportScreen({ canEditRed = false, canEditYellow = false }: MonthlyReportScreenProps) {
  const toast = useToast();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [salesList, setSalesList] = useState<User[]>([]);
  const [salesId, setSalesId] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [editModal, setEditModal] = useState<{ type: "yellow" | "red" | "part"; item?: any } | null>(null);

  // Load sales list
  useEffect(() => {
    (async () => {
      try {
        const list = await api.listUsers({ role: "sales" });
        setSalesList(list);
        if (list.length && !salesId) setSalesId(list[0].id);
      } catch {}
    })();
  }, [salesId]);

  const load = useCallback(async () => {
    if (!salesId) return;
    setLoading(true);
    try {
      const r = await api.monthlyReport({ sales_id: salesId, year, month });
      setData(r);
    } catch (e: any) {
      toast.show(e.message || "Gagal muat laporan", "error");
    } finally {
      setLoading(false);
    }
  }, [salesId, year, month, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const changeMonth = (offset: number) => {
    let m = month + offset;
    let y = year;
    while (m < 1) {
      m += 12;
      y--;
    }
    while (m > 12) {
      m -= 12;
      y++;
    }
    setMonth(m);
    setYear(y);
  };

  const currentSales = salesList.find((s) => s.id === salesId);
  void currentSales;

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Laporan Bulanan</Text>
        <Text style={styles.subtitle}>Khusus Penjualan Air Galon</Text>
      </View>

      {/* Legend */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.legendRow}>
        <Legend color={COLOR_GREEN} label="Otomatis (Sales)" />
        <Legend color={COLOR_YELLOW} label="Diisi Admin" />
        <Legend color={COLOR_RED} label="Super Admin" />
      </ScrollView>

      {/* Filters */}
      <View style={styles.filterCard}>
        <View style={styles.filterRow}>
          <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.dateBtn} testID="prev-month-btn">
            <Ionicons name="chevron-back" size={20} color={theme.color.onSurface} />
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{MONTHS[month - 1]} {year}</Text>
          <TouchableOpacity onPress={() => changeMonth(1)} style={styles.dateBtn} testID="next-month-btn">
            <Ionicons name="chevron-forward" size={20} color={theme.color.onSurface} />
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.salesChipRow}>
          {salesList.map((s) => (
            <TouchableOpacity
              key={s.id}
              onPress={() => setSalesId(s.id)}
              style={[styles.salesChip, salesId === s.id && styles.salesChipActive]}
              testID={`sales-chip-${s.sales_code || s.username}`}
            >
              <Text style={[styles.salesChipText, salesId === s.id && styles.salesChipTextActive]}>
                {s.sales_code || s.username}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {!data || loading ? (
        <View style={styles.center}>
          <Text style={{ color: theme.color.muted }}>{loading ? "Memuat…" : "Pilih sales"}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
          {/* Group header */}
          <View style={styles.groupHeader}>
            <Text style={styles.groupLabel}>LAPORAN PENJUALAN AIR GALON</Text>
            <Text style={styles.groupValue}>
              {data.sales_code} · Wilayah {data.group_letter} · {MONTHS[month - 1]} {year}
            </Text>
          </View>

          {/* PENDAPATAN BERSIH — SUMMARY di atas supaya screenshot langsung dapat ringkasannya */}
          <View style={styles.netCardTop}>
            <Text style={styles.netTopHeader}>PENDAPATAN BERSIH</Text>
            <Text
              style={[
                styles.netTopValue,
                { color: data.pendapatan_bersih >= 0 ? "#fff" : "#FEE2E2" },
              ]}
            >
              Rp {rp(data.pendapatan_bersih)}
            </Text>
            <View style={styles.netTopGrid}>
              <View style={styles.netTopCell}>
                <Text style={styles.netTopCellLabel}>A1 · Penjualan</Text>
                <Text style={styles.netTopCellVal}>Rp {rp(data.A1_penjualan)}</Text>
              </View>
              <View style={styles.netTopCell}>
                <Text style={styles.netTopCellLabel}>A4 · Kulakan</Text>
                <Text style={styles.netTopCellVal}>− Rp {rp(data.A4_kulakan)}</Text>
              </View>
              <View style={styles.netTopCell}>
                <Text style={styles.netTopCellLabel}>A2 · Gaji/Bonus</Text>
                <Text style={styles.netTopCellVal}>− Rp {rp(data.A2_gaji_bonus)}</Text>
              </View>
              <View style={styles.netTopCell}>
                <Text style={styles.netTopCellLabel}>A3 · Biaya Ops</Text>
                <Text style={styles.netTopCellVal}>− Rp {rp(data.A3_biaya_operasional)}</Text>
              </View>
            </View>
            <Text style={styles.netTopFormula}>A1 − A4 − A3 − A2  ·  {data.total_gln_sold} galon terjual</Text>
          </View>

          {/* SECTION A: DAILY PENJUALAN */}
          <SectionTitle icon="calendar-outline">Penjualan Harian</SectionTitle>
          <View style={styles.tableCard}>
            <View style={styles.rowHead}>
              <Text style={[styles.thCell, styles.colNo]}>No</Text>
              <Text style={[styles.thCell, styles.colDate]}>Tgl</Text>
              <Text style={[styles.thCell, styles.colDay]}>Hari</Text>
              <Text style={[styles.thCell, styles.colAir]}>Air (gln)</Text>
              <Text style={[styles.thCell, styles.colAmt]}>Rp</Text>
            </View>
            {data.daily.map((d: any) => (
              <View key={d.no} style={styles.trow}>
                <Text style={[styles.tdCell, styles.colNo]}>{d.no}</Text>
                <Text style={[styles.tdCell, styles.colDate]}>{d.date.slice(5)}</Text>
                <Text style={[styles.tdCell, styles.colDay]}>{d.day_name}</Text>
                <View style={[styles.colAir, styles.greenCell]}>
                  <Text style={styles.greenText}>{d.gln > 0 ? d.gln : "-"}</Text>
                </View>
                <View style={[styles.colAmt, styles.greenCellRight]}>
                  <Text style={styles.greenText}>{d.penjualan > 0 ? rp(d.penjualan) : "-"}</Text>
                </View>
              </View>
            ))}
            <View style={[styles.trow, styles.totalRow]}>
              <Text style={[styles.tdCell, styles.colNo, { fontWeight: "700" }]}>—</Text>
              <Text style={[styles.tdCell, styles.colDate]} />
              <Text style={[styles.tdCell, styles.colDay, { fontWeight: "700" }]}>TOTAL</Text>
              <View style={[styles.colAir, styles.greenCell]}>
                <Text style={[styles.greenText, { fontWeight: "700" }]}>{data.total_gln_sold}</Text>
              </View>
              <View style={[styles.colAmt, styles.greenCellRight]}>
                <Text style={[styles.greenText, { fontWeight: "700" }]}>{rp(data.A1_penjualan)}</Text>
              </View>
            </View>
          </View>

          {/* SECTION B: BIAYA GAJI/BONUS/KOMISI (yellow) */}
          <SectionTitle icon="wallet-outline">Biaya Gaji, Bonus & Komisi</SectionTitle>
          <View style={styles.tableCard}>
            <BiayaRow
              label="Gaji Sopir"
              value={data.admin.gaji_sopir}
              color="yellow"
              canEdit={canEditYellow}
              onPress={() => setEditModal({ type: "yellow", item: { key: "gaji_sopir", label: "Gaji Sopir", value: data.admin.gaji_sopir } })}
            />
            <BiayaRow
              label="Gaji Kernet"
              value={data.admin.gaji_kernet}
              color="yellow"
              canEdit={canEditYellow}
              onPress={() => setEditModal({ type: "yellow", item: { key: "gaji_kernet", label: "Gaji Kernet", value: data.admin.gaji_kernet } })}
            />
            <BiayaRow
              label="Bonus per Galon 1"
              value={data.admin.bonus_per_galon_1}
              color="yellow"
              canEdit={canEditYellow}
              onPress={() => setEditModal({ type: "yellow", item: { key: "bonus_per_galon_1", label: "Bonus per Galon 1", value: data.admin.bonus_per_galon_1 } })}
            />
            <BiayaRow
              label="Bonus per Galon 2"
              value={data.admin.bonus_per_galon_2}
              color="yellow"
              canEdit={canEditYellow}
              onPress={() => setEditModal({ type: "yellow", item: { key: "bonus_per_galon_2", label: "Bonus per Galon 2", value: data.admin.bonus_per_galon_2 } })}
            />
            <BiayaRow
              label="Komisi"
              value={data.admin.komisi}
              color="yellow"
              canEdit={canEditYellow}
              onPress={() => setEditModal({ type: "yellow", item: { key: "komisi", label: "Komisi", value: data.admin.komisi } })}
            />
            {[1, 2, 3, 4, 5].map((n) => (
              <BiayaRow
                key={n}
                label={`Bonus Target Penjualan Mg ${n}`}
                value={data.admin[`bonus_target_mg${n}`]}
                color="yellow"
                canEdit={canEditYellow}
                onPress={() =>
                  setEditModal({
                    type: "yellow",
                    item: {
                      key: `bonus_target_mg${n}`,
                      label: `Bonus Target Penjualan Mg ${n}`,
                      value: data.admin[`bonus_target_mg${n}`],
                    },
                  })
                }
              />
            ))}
            <View style={[styles.trow, styles.totalRow]}>
              <Text style={[styles.tdCell, { flex: 1, fontWeight: "700" }]}>TOTAL A2 (Gaji+Bonus+Komisi)</Text>
              <Text style={[styles.tdCell, { fontWeight: "700", color: theme.color.brand }]}>
                Rp {rp(data.A2_gaji_bonus)}
              </Text>
            </View>
          </View>

          {/* SECTION C: PART REPLACEMENT (red price + yellow qty) */}
          <SectionTitle icon="construct-outline">Biaya Penggantian Part</SectionTitle>
          <View style={styles.tableCard}>
            <View style={styles.rowHead}>
              <Text style={[styles.thCell, { flex: 1 }]}>Part</Text>
              <Text style={[styles.thCell, styles.colUnit]}>Harga/pcs</Text>
              <Text style={[styles.thCell, styles.colUnit]}>Pcs</Text>
              <Text style={[styles.thCell, styles.colUnit]}>Subtotal</Text>
            </View>
            {data.parts.map((p: any) => (
              <View key={p.id} style={styles.trow}>
                <Text style={[styles.tdCell, { flex: 1 }]}>{p.name}</Text>
                <TouchableOpacity
                  disabled={!canEditRed}
                  onPress={() =>
                    setEditModal({
                      type: "red",
                      item: { id: p.id, name: p.name, rp_per_pcs: p.rp_per_pcs, order: p.order },
                    })
                  }
                  style={[styles.colUnit, styles.redCell]}
                >
                  <Text style={styles.redText}>{p.rp_per_pcs > 0 ? rp(p.rp_per_pcs) : "-"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={!canEditYellow}
                  onPress={() =>
                    setEditModal({
                      type: "part",
                      item: { name: p.name, qty: p.qty },
                    })
                  }
                  style={[styles.colUnit, styles.yellowCell]}
                >
                  <Text style={styles.yellowText}>{p.qty || 0}</Text>
                </TouchableOpacity>
                <View style={[styles.colUnit, styles.subtotalCell]}>
                  <Text style={styles.subtotalText}>{p.subtotal > 0 ? rp(p.subtotal) : "-"}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* SECTION D: SALES EXPENSES (green auto) */}
          <SectionTitle icon="car-outline">
            Pengeluaran Sales Bulan Ini ({data.sales_expenses.length})
          </SectionTitle>
          <View style={styles.tableCard}>
            <View style={styles.rowHead}>
              <Text style={[styles.thCell, styles.colDate]}>Tgl</Text>
              <Text style={[styles.thCell, { flex: 1 }]}>Kategori</Text>
              <Text style={[styles.thCell, styles.colUnit]}>Jumlah</Text>
            </View>
            {data.sales_expenses.length === 0 && (
              <Text style={styles.emptyText}>Belum ada pengeluaran</Text>
            )}
            {data.sales_expenses.map((e: any) => (
              <View key={e.id} style={styles.trow}>
                <Text style={[styles.tdCell, styles.colDate]}>{e.date_only.slice(8)}</Text>
                <Text style={[styles.tdCell, { flex: 1 }]}>
                  {e.category}{e.description ? ` — ${e.description}` : ""}
                </Text>
                <View style={[styles.colUnit, styles.greenCellRight]}>
                  <Text style={styles.greenText}>{rp(e.amount)}</Text>
                </View>
              </View>
            ))}
            <View style={[styles.trow, styles.totalRow]}>
              <Text style={[styles.tdCell, { flex: 1, fontWeight: "700" }]}>TOTAL A3 (Parts + Pengeluaran)</Text>
              <Text style={[styles.tdCell, { fontWeight: "700", color: theme.color.brand }]}>
                Rp {rp(data.A3_biaya_operasional)}
              </Text>
            </View>
          </View>

          {/* SECTION E: PENDAPATAN BERSIH DETAIL */}
          <SectionTitle icon="stats-chart-outline">Rincian Pendapatan Bersih</SectionTitle>
          <View style={styles.netCard}>
            <IncomeRow
              label="Penjualan (A1)"
              value={"Rp " + rp(data.A1_penjualan)}
              hint={`${data.total_gln_sold} galon terjual`}
            />
            <IncomeRow
              label="Rp Kulakan × Galon (A4)"
              value={"− Rp " + rp(data.A4_kulakan)}
              hint={`Rp ${rp(data.rp_kulakan_per_galon)} × ${data.total_gln_sold} gln`}
              actionable={canEditRed}
              onPress={() =>
                setEditModal({ type: "red", item: { id: "kulakan", name: "Rp Kulakan / Galon", rp_per_pcs: data.rp_kulakan_per_galon } })
              }
              isRed
            />
            <IncomeRow
              label="Gaji, Bonus & Komisi (A2)"
              value={"− Rp " + rp(data.A2_gaji_bonus)}
              hint="Total dari tabel Gaji/Bonus"
            />
            <IncomeRow
              label="Biaya Operasional (A3)"
              value={"− Rp " + rp(data.A3_biaya_operasional)}
              hint={`Parts Rp ${rp(data.A3_parts_total)} + Pengeluaran Rp ${rp(data.A3_sales_expenses_total)}`}
            />
            <View style={styles.netDivider} />
            <View style={styles.netTotalRow}>
              <Text style={styles.netTotalLabel}>PENDAPATAN BERSIH</Text>
              <Text
                style={[
                  styles.netTotalValue,
                  { color: data.pendapatan_bersih >= 0 ? theme.color.brand : theme.color.error },
                ]}
              >
                Rp {rp(data.pendapatan_bersih)}
              </Text>
            </View>
            <Text style={styles.formula}>A1 − A4 − A3 − A2</Text>
          </View>
        </ScrollView>
      )}

      <EditModal
        modal={editModal}
        onClose={() => setEditModal(null)}
        onSave={async (val) => {
          if (!editModal || !salesId) return;
          try {
            if (editModal.type === "yellow") {
              await api.updateMonthlyReport({ sales_id: salesId, year, month }, { [editModal.item.key]: val });
            } else if (editModal.type === "red") {
              if (editModal.item.id === "kulakan") {
                await api.setSetting("rp_kulakan_per_galon", val);
              } else {
                await api.updatePartPrice(editModal.item.id, {
                  name: editModal.item.name,
                  rp_per_pcs: val,
                  order: editModal.item.order,
                });
              }
            } else if (editModal.type === "part") {
              const qtys = { ...(data.parts.reduce((acc: any, p: any) => ({ ...acc, [p.name]: p.qty || 0 }), {})) };
              qtys[editModal.item.name] = val;
              await api.updateMonthlyReport({ sales_id: salesId, year, month }, { part_qtys: qtys });
            }
            toast.show("Tersimpan", "success");
            setEditModal(null);
            await load();
          } catch (e: any) {
            toast.show(e.message || "Gagal", "error");
          }
        }}
      />
    </SafeAreaView>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legend}>
      <View style={[styles.legendBox, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function SectionTitle({ children, icon }: { children: React.ReactNode; icon: any }) {
  return (
    <View style={styles.sectionTitle}>
      <Ionicons name={icon} size={16} color={theme.color.brand} />
      <Text style={styles.sectionTitleText}>{children}</Text>
    </View>
  );
}

function BiayaRow({
  label,
  value,
  color,
  canEdit,
  onPress,
}: {
  label: string;
  value: number;
  color: "yellow" | "red" | "green";
  canEdit?: boolean;
  onPress?: () => void;
}) {
  const bg = color === "yellow" ? COLOR_YELLOW : color === "red" ? COLOR_RED : COLOR_GREEN;
  const tc = color === "yellow" ? COLOR_YELLOW_TEXT : color === "red" ? COLOR_RED_TEXT : COLOR_GREEN_TEXT;
  return (
    <View style={styles.trow}>
      <Text style={[styles.tdCell, { flex: 1 }]}>{label}</Text>
      <TouchableOpacity
        disabled={!canEdit}
        onPress={onPress}
        style={[styles.biayaValCell, { backgroundColor: bg }]}
        testID={`biaya-${label.toLowerCase().replace(/\s+/g, "-")}`}
      >
        <Text style={[styles.biayaValText, { color: tc }]}>{value > 0 ? "Rp " + rp(value) : "Rp -"}</Text>
      </TouchableOpacity>
    </View>
  );
}

function IncomeRow({
  label,
  value,
  hint,
  actionable,
  onPress,
  isRed,
}: {
  label: string;
  value: string;
  hint?: string;
  actionable?: boolean;
  onPress?: () => void;
  isRed?: boolean;
}) {
  return (
    <TouchableOpacity disabled={!actionable} onPress={onPress} style={styles.incomeRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.incomeLabel}>{label}</Text>
        {hint ? <Text style={styles.incomeHint}>{hint}</Text> : null}
      </View>
      <Text style={[styles.incomeValue, isRed && { color: theme.color.error, backgroundColor: COLOR_RED, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }]}>
        {value}
      </Text>
    </TouchableOpacity>
  );
}

function EditModal({
  modal,
  onClose,
  onSave,
}: {
  modal: { type: "yellow" | "red" | "part"; item?: any } | null;
  onClose: () => void;
  onSave: (val: number) => void;
}) {
  const [val, setVal] = useState("");
  useEffect(() => {
    if (modal) {
      const initial = modal.type === "part" ? modal.item.qty : modal.type === "red" ? modal.item.rp_per_pcs : modal.item.value;
      setVal(String(initial ?? 0));
    }
  }, [modal]);
  if (!modal) return null;
  const title =
    modal.type === "part"
      ? `Pcs ${modal.item.name}`
      : modal.type === "red"
        ? modal.item.name === "Rp Kulakan / Galon"
          ? "Rp Kulakan per Galon"
          : `Harga per pcs — ${modal.item.name}`
        : modal.item.label;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} testID="close-edit-modal">
              <Ionicons name="close" size={24} color={theme.color.onSurface} />
            </TouchableOpacity>
          </View>
          <Text style={styles.modalHint}>
            {modal.type === "red" && "Diisi Super Admin (permanen)"}
            {modal.type === "yellow" && "Diisi Admin setiap bulan"}
            {modal.type === "part" && "Jumlah pcs terpakai bulan ini"}
          </Text>
          <TextInput
            value={val}
            onChangeText={(v) => setVal(v.replace(/[^\d.]/g, ""))}
            keyboardType="number-pad"
            placeholder="0"
            style={styles.modalInput}
            autoFocus
            testID="edit-value-input"
          />
          <TouchableOpacity onPress={() => onSave(parseFloat(val) || 0)} style={styles.modalBtn} testID="save-value-btn">
            <Text style={styles.modalBtnText}>Simpan</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.color.surface },
  header: { padding: 16, paddingBottom: 8 },
  title: { fontSize: 20, fontWeight: "700", color: theme.color.onSurface },
  subtitle: { fontSize: 11, color: theme.color.muted, marginTop: 2, fontStyle: "italic" },
  legendRow: { paddingHorizontal: 16, paddingBottom: 8, gap: 12 },
  legend: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendBox: { width: 14, height: 14, borderRadius: 3, borderWidth: 1, borderColor: theme.color.border },
  legendText: { fontSize: 11, color: theme.color.muted, fontWeight: "500" },
  filterCard: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  filterRow: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center" },
  dateBtn: { padding: 8, borderRadius: 8, backgroundColor: theme.color.surfaceSecondary },
  monthLabel: { fontSize: 16, fontWeight: "600", color: theme.color.onSurface, minWidth: 100, textAlign: "center" },
  salesChipRow: { gap: 6 },
  salesChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: theme.color.surfaceSecondary },
  salesChipActive: { backgroundColor: theme.color.brandPrimary },
  salesChipText: { fontSize: 12, color: theme.color.onSurfaceSecondary, fontWeight: "600" },
  salesChipTextActive: { color: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  groupHeader: { padding: 12, borderRadius: 12, backgroundColor: theme.color.brandTertiary, marginBottom: 12 },
  groupLabel: { fontSize: 11, color: theme.color.onBrandTertiary, fontWeight: "600" },
  groupValue: { fontSize: 14, color: theme.color.onBrandTertiary, fontWeight: "700", marginTop: 2 },
  sectionTitle: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, marginBottom: 6, paddingHorizontal: 4 },
  sectionTitleText: { fontSize: 13, fontWeight: "700", color: theme.color.onSurface },
  tableCard: { borderWidth: 1, borderColor: theme.color.border, borderRadius: 10, overflow: "hidden" },
  rowHead: { flexDirection: "row", backgroundColor: theme.color.surfaceSecondary },
  thCell: { fontSize: 10, fontWeight: "700", color: theme.color.onSurfaceSecondary, padding: 6, textTransform: "uppercase" },
  trow: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.color.border, alignItems: "stretch" },
  tdCell: { fontSize: 11, color: theme.color.onSurface, padding: 6 },
  colNo: { width: 28 },
  colDate: { width: 40 },
  colDay: { width: 52 },
  colAir: { width: 54, alignItems: "center", justifyContent: "center" },
  colAmt: { flex: 1, alignItems: "flex-end" },
  colUnit: { width: 78, alignItems: "center", justifyContent: "center" },
  greenCell: { backgroundColor: COLOR_GREEN, padding: 6, alignItems: "center", justifyContent: "center" },
  greenCellRight: { backgroundColor: COLOR_GREEN, padding: 6, alignItems: "flex-end", justifyContent: "center" },
  greenText: { fontSize: 11, color: COLOR_GREEN_TEXT, fontWeight: "600" },
  redCell: { backgroundColor: COLOR_RED, padding: 6, alignItems: "center", justifyContent: "center" },
  redText: { fontSize: 11, color: COLOR_RED_TEXT, fontWeight: "700" },
  yellowCell: { backgroundColor: COLOR_YELLOW, padding: 6, alignItems: "center", justifyContent: "center" },
  yellowText: { fontSize: 11, color: COLOR_YELLOW_TEXT, fontWeight: "700" },
  subtotalCell: { backgroundColor: theme.color.surface, padding: 6, alignItems: "center", justifyContent: "center" },
  subtotalText: { fontSize: 11, color: theme.color.brand, fontWeight: "700" },
  totalRow: { backgroundColor: theme.color.surfaceSecondary },
  biayaValCell: { width: 130, padding: 8, alignItems: "flex-end", justifyContent: "center" },
  biayaValText: { fontSize: 12, fontWeight: "700" },
  emptyText: { padding: 14, textAlign: "center", color: theme.color.muted, fontSize: 12 },
  netCard: { padding: 14, borderRadius: 12, backgroundColor: theme.color.surface, borderWidth: 1, borderColor: theme.color.border, marginBottom: 12 },
  netCardTop: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: theme.color.brandPrimary,
    marginBottom: 12,
    shadowColor: theme.color.brandPrimary,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  netTopHeader: { fontSize: 11, color: "#A7F3D0", fontWeight: "700", letterSpacing: 1 },
  netTopValue: { fontSize: 26, fontWeight: "800", marginTop: 4, marginBottom: 12, letterSpacing: -0.6 },
  netTopGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  netTopCell: { width: "48%", padding: 8, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.12)" },
  netTopCellLabel: { fontSize: 9, color: "#D1FAE5", fontWeight: "600", letterSpacing: 0.4 },
  netTopCellVal: { fontSize: 12, color: "#fff", fontWeight: "700", marginTop: 2 },
  netTopFormula: { fontSize: 10, color: "#A7F3D0", marginTop: 8, textAlign: "center", fontStyle: "italic" },
  incomeRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 12 },
  incomeLabel: { fontSize: 13, color: theme.color.onSurface, fontWeight: "500" },
  incomeHint: { fontSize: 11, color: theme.color.muted, marginTop: 1 },
  incomeValue: { fontSize: 14, fontWeight: "700", color: theme.color.onSurface },
  netDivider: { height: 1, backgroundColor: theme.color.border, marginVertical: 8 },
  netTotalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 },
  netTotalLabel: { fontSize: 13, fontWeight: "700", color: theme.color.onSurface },
  netTotalValue: { fontSize: 20, fontWeight: "800", letterSpacing: -0.5 },
  formula: { fontSize: 10, color: theme.color.muted, textAlign: "right", marginTop: 4, fontStyle: "italic" },
  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: theme.color.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  modalTitle: { fontSize: 16, fontWeight: "700", color: theme.color.onSurface },
  modalHint: { fontSize: 11, color: theme.color.muted, marginBottom: 14 },
  modalInput: { borderWidth: 1, borderColor: theme.color.border, borderRadius: 12, padding: 16, fontSize: 20, fontWeight: "700", backgroundColor: theme.color.surfaceSecondary, textAlign: "center" },
  modalBtn: { backgroundColor: theme.color.brandPrimary, padding: 16, borderRadius: 14, alignItems: "center", marginTop: 16 },
  modalBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
