import React, { useCallback, useEffect, useRef, useState } from "react";
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
import ViewShot from "react-native-view-shot";
import { theme, rp } from "@/src/theme";
import { api, User } from "@/src/api";
import { useToast } from "@/src/components/Toast";
import { saveShot, shareShot } from "@/src/utils/capture";

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
  const [partEditor, setPartEditor] = useState<{ mode: "create" | "edit"; part?: any } | null>(null);

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

  const [compactMode, setCompactMode] = useState(false);
  const detailShotRef = useRef<ViewShot>(null);

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Laporan Bulanan</Text>
          <Text style={styles.subtitle}>Khusus Penjualan Air Galon</Text>
        </View>
        <TouchableOpacity
          onPress={() => setCompactMode((v) => !v)}
          style={styles.modeBtn}
          testID="toggle-compact-mode"
        >
          <Ionicons name={compactMode ? "list" : "grid"} size={16} color={theme.color.brand} />
          <Text style={styles.modeBtnText}>{compactMode ? "Detail" : "Excel"}</Text>
        </TouchableOpacity>
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
      ) : compactMode ? (
        <CompactExcelView data={data} year={year} month={month} />
      ) : (
        <>
          <ShareActionBar
            shotRef={detailShotRef}
            nativeId="oxly-report-detail-shot"
            filename={`OXLY-Detail-${data.sales_code}-${year}-${String(month).padStart(2, "0")}`}
            title={`Laporan Bulanan Detail ${data.sales_code} ${MONTHS[month - 1]} ${year}`}
          />
          <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
            <View nativeID="oxly-report-detail-shot">
              <ViewShot ref={detailShotRef} style={{ backgroundColor: theme.color.surface }} options={{ format: "png", quality: 1 }}>
              <View style={{ padding: 4 }}>
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

          {/* SECTION: PRODUKSI & GUDANG SUMMARY */}
          {data.prod_wh_summary && (data.prod_wh_summary.prod_entries_count > 0 || data.prod_wh_summary.wh_entries_count > 0) ? (
            <>
              <SectionTitle icon="hammer-outline">Data Produksi & Gudang</SectionTitle>
              <View style={[styles.tableCard, { paddingBottom: 8 }]}>
                <View style={styles.pwRow}>
                  <PWStat label="Produksi Galon" value={data.prod_wh_summary.produksi_galon_total} color="#1E3A8A" />
                  <PWStat label="Dibawa Ke Gudang" value={data.prod_wh_summary.dibawa_ke_gudang ?? data.prod_wh_summary.bawa_total} color="#059669" />
                </View>
                <View style={styles.pwRow}>
                  <PWStat label="Stok Digudang" value={data.prod_wh_summary.stok_keluar_gudang ?? data.prod_wh_summary.terjual_by_gudang} color="#F59E0B" />
                  <PWStat label="Terjual Gudang & Produksi" value={data.prod_wh_summary.terjual_gudang_produksi ?? data.prod_wh_summary.terjual_by_gudang} color="#0EA5E9" />
                </View>
              </View>
            </>
          ) : null}

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
                <TouchableOpacity
                  disabled={!canEditRed}
                  onPress={() => setPartEditor({ mode: "edit", part: p })}
                  style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 4, padding: 6 }}
                  testID={`part-name-${p.id}`}
                >
                  <Text style={[styles.tdCell, { flex: 1, padding: 0 }]}>{p.name}</Text>
                  {canEditRed && <Ionicons name="pencil" size={11} color={theme.color.muted} />}
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={!canEditRed}
                  onPress={() => setPartEditor({ mode: "edit", part: p })}
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
                  {p.source === "auto" && p.auto_qty > 0 ? (
                    <Text style={styles.autoHint}>auto</Text>
                  ) : null}
                  {p.source === "manual" && p.auto_qty > 0 && p.auto_qty !== p.qty ? (
                    <Text style={styles.overrideHint}>override (auto: {p.auto_qty})</Text>
                  ) : null}
                </TouchableOpacity>
                <View style={[styles.colUnit, styles.subtotalCell]}>
                  <Text style={styles.subtotalText}>{p.subtotal > 0 ? rp(p.subtotal) : "-"}</Text>
                </View>
              </View>
            ))}
            {canEditRed && (
              <TouchableOpacity
                onPress={() => setPartEditor({ mode: "create" })}
                style={styles.addPartRow}
                testID="add-part-btn"
              >
                <Ionicons name="add-circle" size={16} color={theme.color.brand} />
                <Text style={styles.addPartText}>Tambah Item Part</Text>
              </TouchableOpacity>
            )}
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
              </View>
            </ViewShot>
            </View>
          </ScrollView>
        </>
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

      <PartEditorModal
        modal={partEditor}
        onClose={() => setPartEditor(null)}
        onSaved={async () => {
          setPartEditor(null);
          await load();
          toast.show("Tersimpan", "success");
        }}
        onDeleted={async () => {
          setPartEditor(null);
          await load();
          toast.show("Item part dihapus", "success");
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

function PWStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", paddingVertical: 12, paddingHorizontal: 8, borderRadius: 10, backgroundColor: color + "15", borderWidth: 1, borderColor: color + "30" }}>
      <Text style={{ fontSize: 24, fontWeight: "800", color, lineHeight: 28 }}>{value}</Text>
      <Text style={{ fontSize: 11, color, opacity: 0.85, textAlign: "center", fontWeight: "600", marginTop: 2 }} numberOfLines={2}>{label}</Text>
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

// ============================================================
// SHARE / SAVE ACTION BAR — used by both Compact & Detail modes
// ============================================================
function ShareActionBar({
  shotRef,
  nativeId,
  filename,
  title,
}: {
  shotRef: React.RefObject<ViewShot | null>;
  nativeId: string;
  filename: string;
  title: string;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<null | "share" | "save">(null);

  const doShare = async () => {
    setBusy("share");
    try {
      await shareShot(shotRef, nativeId, filename, title);
    } catch (e: any) {
      toast.show(e?.message || "Gagal share", "error");
    } finally {
      setBusy(null);
    }
  };

  const doSave = async () => {
    setBusy("save");
    try {
      await saveShot(shotRef, nativeId, filename);
      toast.show(
        Platform.OS === "web" ? "Berhasil diunduh" : "Screenshot tersimpan di galeri",
        "success",
      );
    } catch (e: any) {
      toast.show(e?.message || "Gagal simpan", "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={shareBarStyles.row}>
      <TouchableOpacity
        onPress={doSave}
        disabled={busy !== null}
        style={[shareBarStyles.saveBtn, busy !== null && { opacity: 0.6 }]}
        testID="save-screenshot-btn"
      >
        <Ionicons name="download-outline" size={16} color={theme.color.brand} />
        <Text style={shareBarStyles.saveText}>{busy === "save" ? "Menyimpan…" : "Simpan ke Galeri"}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={doShare}
        disabled={busy !== null}
        style={[shareBarStyles.shareBtn, busy !== null && { opacity: 0.6 }]}
        testID="share-screenshot-btn"
      >
        <Ionicons name="share-social" size={16} color="#fff" />
        <Text style={shareBarStyles.shareText}>{busy === "share" ? "Menyiapkan…" : "Share"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const shareBarStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, padding: 8, paddingBottom: 4, justifyContent: "flex-end" },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.color.brandPrimary,
    backgroundColor: theme.color.surface,
  },
  saveText: { color: theme.color.brand, fontWeight: "700", fontSize: 12 },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#25D366",
  },
  shareText: { color: "#fff", fontWeight: "700", fontSize: 12 },
});


// ============================================================
// COMPACT EXCEL VIEW — spreadsheet-style 3 columns
// ============================================================
function CompactExcelView({ data, year, month }: { data: any; year: number; month: number }) {
  const shotRef = useRef<ViewShot>(null);

  // Fixed cell dimensions to mimic Excel grid on phone (~360 usable width for 3 columns)
  return (
    <View style={{ flex: 1 }}>
      <ShareActionBar shotRef={shotRef} nativeId="oxly-report-excel-shot" filename={`OXLY-${data.sales_code}-${year}-${String(month).padStart(2, "0")}`} title={`Laporan Bulanan ${data.sales_code} ${MONTHS[month - 1]} ${year}`} />
      <ScrollView contentContainerStyle={{ padding: 8, paddingBottom: 40 }}>
        <View nativeID="oxly-report-excel-shot">
          <ViewShot ref={shotRef} style={{ backgroundColor: theme.color.surface }} options={{ format: "png", quality: 1 }}>
          <View style={{ padding: 4 }}>
            {/* Header */}
            <Text style={compactStyles.title}>
              GROUP: {data.sales_code} · Wilayah {data.group_letter}
            </Text>
            <Text style={compactStyles.subtitle}>
              PENJUALAN BULAN {MONTHS[month - 1].toUpperCase()} TAHUN {year}
            </Text>

      {/* Right-side summary card (top for visibility) */}
      <View style={compactStyles.summaryCard}>
        <Text style={compactStyles.summaryHead}>PENDAPATAN BERSIH</Text>
        <View style={compactStyles.summaryGrid}>
          <View style={compactStyles.sumRow}>
            <Text style={compactStyles.sumLabel}>PENJUALAN (A1)</Text>
            <Text style={compactStyles.sumValGreen}>Rp {rp(data.A1_penjualan)}</Text>
          </View>
          <View style={compactStyles.sumRow}>
            <Text style={compactStyles.sumLabel}>Rp Kulakan × {data.total_gln_sold} gln (A4)</Text>
            <Text style={compactStyles.sumValRed}>Rp {rp(data.A4_kulakan)}</Text>
          </View>
          <View style={compactStyles.sumRow}>
            <Text style={compactStyles.sumLabel}>Gaji, Komisi, Bonus (A2)</Text>
            <Text style={compactStyles.sumValYellow}>Rp {rp(data.A2_gaji_bonus)}</Text>
          </View>
          <View style={compactStyles.sumRow}>
            <Text style={compactStyles.sumLabel}>Biaya Operasional (A3)</Text>
            <Text style={compactStyles.sumValYellow}>Rp {rp(data.A3_biaya_operasional)}</Text>
          </View>
        </View>
        <View style={compactStyles.summaryTotal}>
          <Text style={compactStyles.summaryTotalLabel}>PENDAPATAN BERSIH</Text>
          <Text
            style={[
              compactStyles.summaryTotalVal,
              { color: data.pendapatan_bersih >= 0 ? theme.color.brand : theme.color.error },
            ]}
          >
            Rp {rp(data.pendapatan_bersih)}
          </Text>
        </View>
        <Text style={compactStyles.summaryFormula}>A1 − A4 − A3 − A2</Text>
      </View>

      {/* Two-column layout: Penjualan Harian | Biaya */}
      <View style={compactStyles.twoCol}>
        {/* LEFT: PENJUALAN */}
        <View style={compactStyles.colLeft}>
          <Text style={compactStyles.colTitle}>PENJUALAN HARIAN</Text>
          <View style={compactStyles.tHead}>
            <Text style={[compactStyles.th, { width: 20 }]}>N</Text>
            <Text style={[compactStyles.th, { width: 28 }]}>Tgl</Text>
            <Text style={[compactStyles.th, { flex: 1 }]}>Rp</Text>
          </View>
          {data.daily.map((d: any) => (
            <View key={d.no} style={compactStyles.tRow}>
              <Text style={[compactStyles.td, { width: 20 }]}>{d.no}</Text>
              <Text style={[compactStyles.td, { width: 28 }]}>{d.date.slice(8)}</Text>
              <View style={[compactStyles.td, { flex: 1, backgroundColor: COLOR_GREEN, alignItems: "flex-end" }]}>
                <Text style={compactStyles.greenTxt}>{d.penjualan > 0 ? rp(d.penjualan) : ""}</Text>
              </View>
            </View>
          ))}
          <View style={[compactStyles.tRow, compactStyles.totalRow]}>
            <Text style={[compactStyles.td, { width: 48, fontWeight: "700" }]}>TOTAL</Text>
            <View style={[compactStyles.td, { flex: 1, backgroundColor: COLOR_GREEN, alignItems: "flex-end" }]}>
              <Text style={[compactStyles.greenTxt, { fontWeight: "800" }]}>{rp(data.A1_penjualan)}</Text>
            </View>
          </View>
          <Text style={compactStyles.hintText}>{data.total_gln_sold} galon terjual</Text>
        </View>

        {/* RIGHT: BIAYA */}
        <View style={compactStyles.colRight}>
          <Text style={compactStyles.colTitle}>BIAYA</Text>
          <View style={compactStyles.tHead}>
            <Text style={[compactStyles.th, { flex: 1 }]}>Uraian</Text>
            <Text style={[compactStyles.th, { width: 60, textAlign: "right" }]}>Jumlah</Text>
          </View>
          {/* Yellow rows */}
          {[
            ["Gaji Sopir", data.admin.gaji_sopir],
            ["Gaji Kernet", data.admin.gaji_kernet],
            ["Bonus/Galon 1", data.admin.bonus_per_galon_1],
            ["Bonus/Galon 2", data.admin.bonus_per_galon_2],
            ["Komisi", data.admin.komisi],
            ["Bns Trg Mg 1", data.admin.bonus_target_mg1],
            ["Bns Trg Mg 2", data.admin.bonus_target_mg2],
            ["Bns Trg Mg 3", data.admin.bonus_target_mg3],
            ["Bns Trg Mg 4", data.admin.bonus_target_mg4],
            ["Bns Trg Mg 5", data.admin.bonus_target_mg5],
          ].map(([lab, val]: any) => (
            <View key={lab} style={compactStyles.tRow}>
              <Text style={[compactStyles.td, { flex: 1 }]}>{lab}</Text>
              <View style={[compactStyles.td, { width: 60, backgroundColor: COLOR_YELLOW, alignItems: "flex-end" }]}>
                <Text style={compactStyles.yellowTxt}>{val > 0 ? rp(val) : "-"}</Text>
              </View>
            </View>
          ))}
          <View style={[compactStyles.tRow, compactStyles.totalRow]}>
            <Text style={[compactStyles.td, { flex: 1, fontWeight: "700" }]}>Total A2</Text>
            <Text style={[compactStyles.td, { width: 60, textAlign: "right", fontWeight: "700", color: theme.color.brand }]}>
              {rp(data.A2_gaji_bonus)}
            </Text>
          </View>

          {/* Parts (red price + yellow qty) */}
          <Text style={compactStyles.subTitle}>Penggantian Part</Text>
          <View style={compactStyles.tHead}>
            <Text style={[compactStyles.th, { flex: 1 }]}>Part</Text>
            <Text style={[compactStyles.th, { width: 34, textAlign: "center" }]}>Pcs</Text>
            <Text style={[compactStyles.th, { width: 60, textAlign: "right" }]}>Sub</Text>
          </View>
          {data.parts.map((p: any) => (
            <View key={p.id} style={compactStyles.tRow}>
              <View style={[compactStyles.td, { flex: 1, flexDirection: "row", alignItems: "center", gap: 2 }]}>
                <Text style={compactStyles.tdText}>{p.name}</Text>
              </View>
              <View style={[compactStyles.td, { width: 34, backgroundColor: COLOR_YELLOW, alignItems: "center" }]}>
                <Text style={compactStyles.yellowTxt}>{p.qty || 0}</Text>
              </View>
              <View style={[compactStyles.td, { width: 60, alignItems: "flex-end", backgroundColor: p.subtotal > 0 ? COLOR_GREEN : "transparent" }]}>
                <Text style={p.subtotal > 0 ? compactStyles.greenTxt : compactStyles.tdText}>{p.subtotal > 0 ? rp(p.subtotal) : "-"}</Text>
              </View>
            </View>
          ))}
          {/* Sales expenses (green) */}
          {data.sales_expenses.length > 0 && (
            <>
              <Text style={compactStyles.subTitle}>Pengeluaran Sales</Text>
              {data.sales_expenses.map((e: any) => (
                <View key={e.id} style={compactStyles.tRow}>
                  <Text style={[compactStyles.td, { flex: 1 }]} numberOfLines={1}>
                    {e.date_only.slice(8)} {e.category}
                  </Text>
                  <View style={[compactStyles.td, { width: 60, backgroundColor: COLOR_GREEN, alignItems: "flex-end" }]}>
                    <Text style={compactStyles.greenTxt}>{rp(e.amount)}</Text>
                  </View>
                </View>
              ))}
            </>
          )}
          <View style={[compactStyles.tRow, compactStyles.totalRow]}>
            <Text style={[compactStyles.td, { flex: 1, fontWeight: "700" }]}>Total A3</Text>
            <Text style={[compactStyles.td, { width: 60, textAlign: "right", fontWeight: "700", color: theme.color.brand }]}>
              {rp(data.A3_biaya_operasional)}
            </Text>
          </View>

          {/* Kulakan (red) */}
          <Text style={compactStyles.subTitle}>Harga Kulakan (per galon)</Text>
          <View style={compactStyles.tRow}>
            <Text style={[compactStyles.td, { flex: 1 }]}>Kulakan × Galon</Text>
            <View style={[compactStyles.td, { width: 60, backgroundColor: COLOR_RED, alignItems: "flex-end" }]}>
              <Text style={compactStyles.redTxt}>{rp(data.rp_kulakan_per_galon)}</Text>
            </View>
          </View>
          <View style={[compactStyles.tRow, compactStyles.totalRow]}>
            <Text style={[compactStyles.td, { flex: 1, fontWeight: "700" }]}>A4 Total</Text>
            <Text style={[compactStyles.td, { width: 60, textAlign: "right", fontWeight: "700", color: theme.color.error }]}>
              {rp(data.A4_kulakan)}
            </Text>
          </View>
        </View>
      </View>

      <Text style={compactStyles.legendNote}>
        <Text style={{ color: COLOR_GREEN_TEXT, fontWeight: "700" }}>■ Hijau</Text> otomatis dari sales · {" "}
        <Text style={{ color: COLOR_YELLOW_TEXT, fontWeight: "700" }}>■ Kuning</Text> input Admin · {" "}
        <Text style={{ color: COLOR_RED_TEXT, fontWeight: "700" }}>■ Merah</Text> Super Admin
      </Text>
          </View>
        </ViewShot>
        </View>
    </ScrollView>
    </View>
  );
}

const compactStyles = StyleSheet.create({
  title: { fontSize: 12, fontWeight: "700", color: theme.color.onSurface, textAlign: "center" },
  subtitle: { fontSize: 10, color: theme.color.muted, textAlign: "center", marginBottom: 8 },
  summaryCard: {
    padding: 8,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: theme.color.surface,
  },
  summaryHead: { fontSize: 10, fontWeight: "800", color: theme.color.onSurface, textAlign: "center", marginBottom: 4, letterSpacing: 0.5 },
  summaryGrid: { gap: 2 },
  sumRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  sumLabel: { fontSize: 9, color: theme.color.onSurfaceSecondary, flex: 1 },
  sumValGreen: { fontSize: 10, fontWeight: "700", color: COLOR_GREEN_TEXT, backgroundColor: COLOR_GREEN, paddingHorizontal: 4, borderRadius: 3 },
  sumValRed: { fontSize: 10, fontWeight: "700", color: COLOR_RED_TEXT, backgroundColor: COLOR_RED, paddingHorizontal: 4, borderRadius: 3 },
  sumValYellow: { fontSize: 10, fontWeight: "700", color: COLOR_YELLOW_TEXT, backgroundColor: COLOR_YELLOW, paddingHorizontal: 4, borderRadius: 3 },
  summaryTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 6,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
  },
  summaryTotalLabel: { fontSize: 10, fontWeight: "800", color: theme.color.onSurface },
  summaryTotalVal: { fontSize: 14, fontWeight: "900", letterSpacing: -0.3 },
  summaryFormula: { fontSize: 8, color: theme.color.muted, fontStyle: "italic", textAlign: "right", marginTop: 2 },
  twoCol: { flexDirection: "row", gap: 4 },
  colLeft: { flex: 1, borderWidth: 1, borderColor: theme.color.border, borderRadius: 4, backgroundColor: theme.color.surface },
  colRight: { flex: 1.15, borderWidth: 1, borderColor: theme.color.border, borderRadius: 4, backgroundColor: theme.color.surface },
  colTitle: { fontSize: 9, fontWeight: "800", padding: 4, textAlign: "center", backgroundColor: theme.color.brandTertiary, color: theme.color.onBrandTertiary, letterSpacing: 0.5 },
  subTitle: { fontSize: 8, fontWeight: "700", padding: 3, backgroundColor: theme.color.surfaceSecondary, color: theme.color.onSurfaceSecondary, textAlign: "center", marginTop: 2 },
  tHead: { flexDirection: "row", backgroundColor: theme.color.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: theme.color.border },
  th: { fontSize: 8, fontWeight: "700", padding: 3, color: theme.color.onSurfaceSecondary, textTransform: "uppercase" },
  tRow: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.color.border, alignItems: "stretch" },
  td: { fontSize: 8, padding: 3, color: theme.color.onSurface, justifyContent: "center" },
  tdText: { fontSize: 8, color: theme.color.onSurface },
  greenTxt: { fontSize: 8, color: COLOR_GREEN_TEXT, fontWeight: "700" },
  yellowTxt: { fontSize: 8, color: COLOR_YELLOW_TEXT, fontWeight: "700" },
  redTxt: { fontSize: 8, color: COLOR_RED_TEXT, fontWeight: "700" },
  totalRow: { backgroundColor: theme.color.surfaceSecondary },
  hintText: { fontSize: 8, textAlign: "center", padding: 3, color: theme.color.muted, fontStyle: "italic" },
  legendNote: { fontSize: 9, textAlign: "center", marginTop: 8, color: theme.color.muted },
});


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

function PartEditorModal({
  modal,
  onClose,
  onSaved,
  onDeleted,
}: {
  modal: { mode: "create" | "edit"; part?: any } | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (modal) {
      setName(modal.part?.name || "");
      setPrice(String(modal.part?.rp_per_pcs || ""));
    }
  }, [modal]);

  if (!modal) return null;

  const save = async () => {
    if (!name.trim()) {
      toast.show("Nama part wajib diisi", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = { name: name.trim(), rp_per_pcs: parseFloat(price) || 0, order: modal.part?.order || 0 };
      if (modal.mode === "create") {
        await api.createPartPrice(payload);
      } else {
        await api.updatePartPrice(modal.part.id, payload);
      }
      onSaved();
    } catch (e: any) {
      toast.show(e.message || "Gagal simpan", "error");
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (modal.mode !== "edit" || !modal.part?.id) return;
    try {
      await api.deletePartPrice(modal.part.id);
      onDeleted();
    } catch (e: any) {
      toast.show(e.message || "Gagal hapus", "error");
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{modal.mode === "create" ? "Tambah Item Part" : "Edit Item Part"}</Text>
            <TouchableOpacity onPress={onClose} testID="close-part-editor">
              <Ionicons name="close" size={24} color={theme.color.onSurface} />
            </TouchableOpacity>
          </View>
          <Text style={styles.modalHint}>Merah (permanen) — hanya Super Admin</Text>

          <Text style={styles.partLabel}>Nama Part</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="mis. Seal, Mur, Filter…"
            placeholderTextColor={theme.color.muted}
            style={styles.partInput}
            testID="part-name-input"
          />

          <Text style={styles.partLabel}>Harga per Pcs (Rp)</Text>
          <TextInput
            value={price}
            onChangeText={(v) => setPrice(v.replace(/[^\d.]/g, ""))}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={theme.color.muted}
            style={[styles.partInput, { fontSize: 18, fontWeight: "700" }]}
            testID="part-price-input"
          />

          <TouchableOpacity onPress={save} disabled={saving} style={[styles.modalBtn, saving && { opacity: 0.6 }]} testID="save-part-btn">
            <Text style={styles.modalBtnText}>{saving ? "Menyimpan…" : "Simpan"}</Text>
          </TouchableOpacity>

          {modal.mode === "edit" && (
            <TouchableOpacity onPress={del} style={styles.deleteBtn} testID="delete-part-btn">
              <Ionicons name="trash-outline" size={18} color={theme.color.error} />
              <Text style={styles.deleteBtnText}>Hapus Part</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
  header: { flexDirection: "row", padding: 16, paddingBottom: 8, alignItems: "center", gap: 12 },
  title: { fontSize: 20, fontWeight: "700", color: theme.color.onSurface },
  subtitle: { fontSize: 11, color: theme.color.muted, marginTop: 2, fontStyle: "italic" },
  modeBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: theme.color.brandTertiary },
  modeBtnText: { color: theme.color.brand, fontWeight: "700", fontSize: 12 },
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
  autoHint: { fontSize: 8, color: "#059669", fontWeight: "800", marginTop: 1 },
  overrideHint: { fontSize: 7, color: "#DC2626", fontWeight: "600", marginTop: 1 },
  pwRow: { flexDirection: "row", gap: 8, paddingHorizontal: 8, paddingTop: 8 },
  mismatchAlert: { flexDirection: "row", gap: 6, padding: 10, backgroundColor: "#FEE2E2", alignItems: "center" },
  mismatchText: { flex: 1, fontSize: 11, color: "#991B1B", fontWeight: "600" },
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
  addPartRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 10,
    backgroundColor: theme.color.brandTertiary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.color.border,
  },
  addPartText: { color: theme.color.brand, fontWeight: "700", fontSize: 12 },
  partLabel: { fontSize: 13, fontWeight: "500", color: theme.color.onSurfaceSecondary, marginBottom: 6, marginTop: 12 },
  partInput: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: theme.color.onSurface,
    backgroundColor: theme.color.surfaceSecondary,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.color.error,
    marginTop: 10,
  },
  deleteBtnText: { color: theme.color.error, fontWeight: "600" },
});
