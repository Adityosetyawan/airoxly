import React, { useCallback, useEffect, useState } from "react";
import { Image, Modal, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppHeader } from "@/src/components/AppHeader";
import { theme } from "@/src/theme";
import { useAuth } from "@/src/AuthContext";
import { api } from "@/src/api";

export default function ProduksiDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [stock, setStock] = useState<Record<string, number>>({});
  const [today, setToday] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<{ salesCode: string; entries: any[] } | null>(null);
  const [zoomImg, setZoomImg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, t] = await Promise.all([
        api.getWarehouseStock(),
        api.listProductionDaily({
          date_from: new Date().toISOString().slice(0, 10),
          date_to: new Date().toISOString().slice(0, 10),
        }),
      ]);
      setStock(s || {});
      setToday(t || []);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Exclude draft dari totals
  const finalEntries = today.filter((r) => !r.is_draft);
  const draftEntries = today.filter((r) => r.is_draft);

  const sumSparepart = (r: any) => {
    let n = (r.sil_ganti || 0) + (r.mur_ganti || 0) + (r.kran_ganti || 0) + (r.stiker_ganti || 0) + (r.stoper_ganti || 0) + (r.karet_kran_ganti || 0);
    if (r.part_qtys && typeof r.part_qtys === "object") {
      for (const v of Object.values(r.part_qtys)) n += Number(v) || 0;
    }
    return n;
  };

  // Detailed per-item breakdown for a single production_daily row.
  // Returns { "Bearing": 2, "Seal": 1, ... } combining legacy fields & part_qtys.
  const LEGACY_TO_NAME: Record<string, string> = {
    sil_ganti: "Seal",
    mur_ganti: "Mur",
    kran_ganti: "Kran",
    stiker_ganti: "Stiker",
    stoper_ganti: "Stoper",
    karet_kran_ganti: "Karet Kran",
  };
  const partsBreakdown = (r: any): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const [f, name] of Object.entries(LEGACY_TO_NAME)) {
      const v = Number(r[f] || 0);
      if (v > 0) out[name] = (out[name] || 0) + v;
    }
    if (r.part_qtys && typeof r.part_qtys === "object") {
      for (const [name, qty] of Object.entries(r.part_qtys)) {
        const v = Number(qty) || 0;
        if (v > 0) out[name] = (out[name] || 0) + v;
      }
    }
    return out;
  };
  const mergeBreakdown = (a: Record<string, number>, b: Record<string, number>): Record<string, number> => {
    const out = { ...a };
    for (const [k, v] of Object.entries(b)) out[k] = (out[k] || 0) + v;
    return out;
  };

  const todayTotals = finalEntries.reduce(
    (acc, r) => ({
      produksi_galon: acc.produksi_galon + (r.produksi_galon || 0),
      galon_ganti: acc.galon_ganti + (r.galon_ganti || 0),
      sparepart: acc.sparepart + sumSparepart(r),
    }),
    { produksi_galon: 0, galon_ganti: 0, sparepart: 0 },
  );

  // Group by kelompok
  const byKelompok = finalEntries.reduce((acc: Record<string, any>, r) => {
    const key = r.kelompok || "-";
    if (!acc[key]) acc[key] = { count: 0, produksi_galon: 0, galon_ganti: 0, sparepart: 0 };
    acc[key].count += 1;
    acc[key].produksi_galon += r.produksi_galon || 0;
    acc[key].galon_ganti += r.galon_ganti || 0;
    acc[key].sparepart += sumSparepart(r);
    return acc;
  }, {});
  const kelompokList = Object.entries(byKelompok);

  // Group by SALES — for click detail
  const bySales = finalEntries.reduce((acc: Record<string, any>, r) => {
    const key = r.sales_code || "-";
    if (!acc[key]) acc[key] = {
      count: 0, produksi_galon: 0, galon_ganti: 0,
      galon_kran: 0, galon_polos: 0,
      sparepart: 0,
      parts: {} as Record<string, number>,
      entries: [] as any[],
    };
    acc[key].count += 1;
    acc[key].produksi_galon += r.produksi_galon || 0;
    acc[key].galon_ganti += r.galon_ganti || 0;
    acc[key].galon_kran += r.galon_kran || 0;
    acc[key].galon_polos += r.galon_polos || 0;
    acc[key].sparepart += sumSparepart(r);
    acc[key].parts = mergeBreakdown(acc[key].parts, partsBreakdown(r));
    acc[key].entries.push(r);
    return acc;
  }, {});
  const salesList = Object.entries(bySales).sort(([a], [b]) => a.localeCompare(b));

  const detailData = detail ? bySales[detail.salesCode] : null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.surfaceSecondary }}>
      <AppHeader title="Produksi" subtitle={`${user?.name || user?.username}${user?.kelompok ? ` • ${user.kelompok}` : ""}`} />
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.section}>Ringkasan Hari Ini</Text>
        <View style={styles.grid}>
          <StatCard icon="water" label="Produksi Galon" value={todayTotals.produksi_galon} color="#059669" />
          <StatCard icon="swap-horizontal" label="Galon Ganti" value={todayTotals.galon_ganti} color="#0EA5E9" />
          <StatCard icon="construct" label="Sparepart Ganti" value={todayTotals.sparepart} color="#F59E0B" />
          <StatCard icon="document-text" label="Entry Hari Ini" value={finalEntries.length} color="#8B5CF6" />
        </View>

        {draftEntries.length > 0 ? (
          <View style={styles.draftBanner}>
            <Ionicons name="hourglass" size={16} color="#B45309" />
            <Text style={styles.draftBannerText}>
              {draftEntries.length} draft belum final — lanjutkan dari Input Harian.
            </Text>
          </View>
        ) : null}

        <TouchableOpacity style={styles.bigBtn} onPress={() => router.push("/(produksi)/input")}>
          <Ionicons name="add-circle" size={22} color="#fff" />
          <Text style={styles.bigBtnText}>Input Harian Produksi</Text>
        </TouchableOpacity>

        {kelompokList.length > 0 ? (
          <>
            <Text style={styles.section}>Rekap per Kelompok (Hari Ini)</Text>
            <View style={styles.kelWrap}>
              {kelompokList.map(([k, v]: any) => (
                <View key={k} style={styles.kelCard}>
                  <Text style={styles.kelName}>{k}</Text>
                  <View style={styles.kelRow}>
                    <KelItem label="Prod Gln" value={v.produksi_galon} />
                    <KelItem label="Gln Gt" value={v.galon_ganti} />
                    <KelItem label="Sparepart" value={v.sparepart} />
                    <KelItem label="Entry" value={v.count} />
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {salesList.length > 0 ? (
          <>
            <Text style={styles.section}>Rekap per Sales (Hari Ini) — Tap untuk detail</Text>
            <View style={styles.kelWrap}>
              {salesList.map(([k, v]: any) => (
                <TouchableOpacity
                  key={k}
                  activeOpacity={0.7}
                  onPress={() => setDetail({ salesCode: k, entries: v.entries })}
                  style={styles.salesCard}
                  testID={`sales-card-${k}`}
                >
                  <View style={styles.salesHeader}>
                    <Text style={styles.salesBadge}>{k}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={styles.salesEntry}>{v.count} entry</Text>
                      <Ionicons name="chevron-forward" size={16} color={theme.color.muted} />
                    </View>
                  </View>
                  {/* Galon row: Prod Gln + Galon Kran + Galon Polos + Ganti Total */}
                  <View style={styles.kelRow}>
                    <KelItem label="Prod Gln" value={v.produksi_galon} />
                    <KelItem label="Gln Kran" value={v.galon_kran} />
                    <KelItem label="Gln Polos" value={v.galon_polos} />
                    <KelItem label="Gln Gt" value={v.galon_ganti} />
                  </View>
                  {/* Sparepart breakdown chips */}
                  {Object.keys(v.parts).length > 0 && (
                    <View style={styles.partsWrap}>
                      <Text style={styles.partsLabel}>Penggantian Sparepart:</Text>
                      <View style={styles.chipsWrap}>
                        {Object.entries(v.parts as Record<string, number>).map(([name, qty]) => (
                          <View key={name} style={styles.partChip}>
                            <Text style={styles.partChipName}>{name}</Text>
                            <Text style={styles.partChipQty}>{qty}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : null}

        <Text style={styles.section}>Stok Gudang Terkini</Text>
        <View style={styles.stockCard}>
          {Object.entries(stock).map(([k, v]) => (
            <View key={k} style={styles.stockRow}>
              <Text style={styles.stockName}>{itemLabel(k)}</Text>
              <Text style={[styles.stockValue, (v as number) < 10 ? { color: theme.color.error } : null]}>{v}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Modal Detail Per Sales */}
      <Modal visible={!!detail} animationType="slide" onRequestClose={() => setDetail(null)}>
        <View style={{ flex: 1, backgroundColor: theme.color.surfaceSecondary }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setDetail(null)} style={{ padding: 6 }}>
              <Ionicons name="close" size={26} color={theme.color.onSurface} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Detail {detail?.salesCode}</Text>
              <Text style={styles.modalSub}>{detailData?.count || 0} entry hari ini</Text>
            </View>
          </View>
          <ScrollView contentContainerStyle={{ padding: 12, gap: 12 }}>
            {detailData?.entries.map((e: any, idx: number) => (
              <EntryCard key={e.id || idx} entry={e} onImgTap={setZoomImg} />
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Modal Foto Zoom */}
      <Modal visible={!!zoomImg} transparent animationType="fade" onRequestClose={() => setZoomImg(null)}>
        <TouchableOpacity style={styles.zoomOverlay} activeOpacity={1} onPress={() => setZoomImg(null)}>
          {zoomImg ? <Image source={{ uri: zoomImg }} style={styles.zoomImg} resizeMode="contain" /> : null}
          <View style={styles.zoomClose}>
            <Ionicons name="close" size={22} color="#fff" />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function EntryCard({ entry, onImgTap }: { entry: any; onImgTap: (url: string) => void }) {
  const partList = entry.part_qtys && typeof entry.part_qtys === "object"
    ? Object.entries(entry.part_qtys).filter(([, v]) => Number(v) > 0)
    : [];
  // Legacy fields
  const legacyParts: [string, number][] = [
    ["Seal", entry.sil_ganti || 0],
    ["Mur", entry.mur_ganti || 0],
    ["Kran", entry.kran_ganti || 0],
    ["Stiker", entry.stiker_ganti || 0],
    ["Stoper", entry.stoper_ganti || 0],
    ["Karet Kran", entry.karet_kran_ganti || 0],
  ].filter(([, v]) => Number(v) > 0) as [string, number][];
  const allParts = [...partList, ...legacyParts];

  return (
    <View style={styles.entryCard}>
      <View style={styles.entryHeader}>
        <Text style={styles.entryShift}>{(entry.shift || "-").toUpperCase()}</Text>
        <Text style={styles.entryTime}>
          {entry.created_at ? new Date(entry.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-"}
        </Text>
        <View style={[styles.destBadge, entry.destination === "gudang" ? styles.destGudang : styles.destSales]}>
          <Text style={styles.destBadgeText}>
            {entry.destination === "gudang" ? "→ Gudang" : "→ Langsung Jual"}
          </Text>
        </View>
      </View>

      <View style={styles.produksiBox}>
        <Text style={styles.produksiLabel}>PRODUKSI</Text>
        <Text style={styles.produksiValue}>{entry.produksi_galon || 0}</Text>
        <Text style={styles.produksiUnit}>gln</Text>
      </View>

      {(entry.ai_count_before != null || entry.ai_count_after != null) ? (
        <View style={styles.aiRow}>
          {entry.ai_count_before != null ? (
            <View style={styles.aiChip}>
              <Text style={styles.aiChipLabel}>AI Sebelum</Text>
              <Text style={styles.aiChipVal}>{entry.ai_count_before}</Text>
            </View>
          ) : null}
          {entry.ai_count_after != null ? (
            <View style={styles.aiChip}>
              <Text style={styles.aiChipLabel}>AI Setelah</Text>
              <Text style={styles.aiChipVal}>{entry.ai_count_after}</Text>
            </View>
          ) : null}
          {entry.manual_adjust ? (
            <View style={styles.aiChip}>
              <Text style={styles.aiChipLabel}>Manual</Text>
              <Text style={styles.aiChipVal}>{entry.manual_adjust > 0 ? "+" : ""}{entry.manual_adjust}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {(entry.sisa_pagi || entry.sisa_siang) ? (
        <View style={styles.sisaBox}>
          <Text style={styles.sisaLabel}>Sisa Isi Belum Terjual</Text>
          <Text style={styles.sisaValue}>
            {(entry.sisa_pagi || 0) + (entry.sisa_siang || 0)} gln{" "}
            <Text style={{ fontSize: 10, color: theme.color.muted }}>
              (P:{entry.sisa_pagi || 0} / S:{entry.sisa_siang || 0})
            </Text>
          </Text>
        </View>
      ) : null}

      {(entry.photo_before || entry.photo_after) ? (
        <View style={styles.photoRow}>
          {entry.photo_before ? (
            <TouchableOpacity style={styles.photoBox} onPress={() => onImgTap(entry.photo_before)}>
              <Image source={{ uri: entry.photo_before }} style={styles.photoImg} resizeMode="cover" />
              <Text style={styles.photoLabel}>Sebelum</Text>
            </TouchableOpacity>
          ) : null}
          {entry.photo_after ? (
            <TouchableOpacity style={styles.photoBox} onPress={() => onImgTap(entry.photo_after)}>
              <Image source={{ uri: entry.photo_after }} style={styles.photoImg} resizeMode="cover" />
              <Text style={styles.photoLabel}>Setelah</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {allParts.length > 0 ? (
        <View style={styles.partsSection}>
          <Text style={styles.partsTitle}>🔧 Penggantian Part</Text>
          <View style={styles.partsRow}>
            {allParts.map(([name, qty]: any) => (
              <View key={name} style={styles.partPill}>
                <Text style={styles.partName}>{name}</Text>
                <Text style={styles.partQty}>{qty}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {entry.note ? (
        <View style={styles.noteBox}>
          <Ionicons name="chatbubble-outline" size={14} color={theme.color.muted} />
          <Text style={styles.noteText}>{entry.note}</Text>
        </View>
      ) : null}
    </View>
  );
}

function StatCard({ icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function KelItem({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Text style={{ fontSize: 16, fontWeight: "800", color: theme.color.onSurface }}>{value}</Text>
      <Text style={{ fontSize: 10, color: theme.color.muted }}>{label}</Text>
    </View>
  );
}

export function itemLabel(k: string) {
  return (
    {
      galon: "Galon Polos",
      seal: "Seal / Sil",
      mur: "Mur",
      kran: "Kran",
      stiker: "Stiker",
      karet_kran: "Karet Kran",
      stoper: "Stoper",
      galon_kran: "Galon Kran",
      galon_polos: "Galon Polos",
    } as Record<string, string>
  )[k] || k;
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 12 },
  section: { fontSize: 14, fontWeight: "700", color: theme.color.onSurfaceSecondary, marginTop: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statCard: {
    flexBasis: "48%", backgroundColor: theme.color.surface, padding: 12, borderRadius: 12,
    borderLeftWidth: 4, gap: 4,
  },
  statValue: { fontSize: 22, fontWeight: "800", color: theme.color.onSurface },
  statLabel: { fontSize: 12, color: theme.color.muted },
  draftBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 10, borderRadius: 10, backgroundColor: "#FEF3C7",
    borderLeftWidth: 4, borderLeftColor: "#F59E0B",
  },
  draftBannerText: { flex: 1, fontSize: 12, color: "#78350F", fontWeight: "600" },
  bigBtn: {
    backgroundColor: theme.color.brandPrimary, padding: 16, borderRadius: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginVertical: 4,
  },
  bigBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  stockCard: { backgroundColor: theme.color.surface, borderRadius: 12, padding: 12 },
  stockRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.color.border },
  stockName: { fontSize: 14, color: theme.color.onSurface },
  stockValue: { fontSize: 15, fontWeight: "700", color: theme.color.onSurface },
  kelWrap: { gap: 8 },
  kelCard: { backgroundColor: theme.color.surface, borderRadius: 12, padding: 12, gap: 8, borderLeftWidth: 4, borderLeftColor: "#8B5CF6" },
  kelName: { fontSize: 14, fontWeight: "800", color: "#8B5CF6" },
  kelRow: { flexDirection: "row", gap: 4 },
  salesCard: { backgroundColor: theme.color.surface, borderRadius: 12, padding: 12, gap: 8, borderLeftWidth: 4, borderLeftColor: theme.color.brand },
  partsWrap: {
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
    paddingTop: 8,
    marginTop: 2,
    gap: 6,
  },
  partsLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: theme.color.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  partChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: theme.color.brandTertiary,
  },
  partChipName: { fontSize: 11, fontWeight: "600", color: theme.color.onBrandTertiary },
  partChipQty: { fontSize: 11, fontWeight: "800", color: theme.color.brand },
  salesHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  salesBadge: { fontSize: 13, fontWeight: "800", color: theme.color.brand, backgroundColor: theme.color.brandTertiary, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  salesEntry: { fontSize: 11, color: theme.color.muted },

  // Detail modal
  modalHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 12, paddingTop: 40, backgroundColor: theme.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.color.border,
  },
  modalTitle: { fontSize: 17, fontWeight: "800", color: theme.color.onSurface },
  modalSub: { fontSize: 11, color: theme.color.muted, marginTop: 2 },
  entryCard: { backgroundColor: theme.color.surface, borderRadius: 12, padding: 12, gap: 10, borderWidth: 1, borderColor: theme.color.border },
  entryHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  entryShift: { fontSize: 12, fontWeight: "800", color: "#fff", backgroundColor: theme.color.brand, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  entryTime: { fontSize: 11, color: theme.color.muted, flex: 1 },
  destBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  destGudang: { backgroundColor: theme.color.brandTertiary },
  destSales: { backgroundColor: "#FEF3C7" },
  destBadgeText: { fontSize: 10, fontWeight: "700", color: theme.color.onSurface },
  produksiBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: theme.color.brand, padding: 12, borderRadius: 10,
  },
  produksiLabel: { flex: 1, color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  produksiValue: { color: "#fff", fontSize: 30, fontWeight: "900" },
  produksiUnit: { color: "#fff", fontSize: 11, opacity: 0.8 },
  aiRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  aiChip: { flex: 1, minWidth: "30%", backgroundColor: theme.color.surfaceSecondary, borderRadius: 8, padding: 8, alignItems: "center", gap: 2 },
  aiChipLabel: { fontSize: 10, color: theme.color.muted },
  aiChipVal: { fontSize: 15, fontWeight: "800", color: theme.color.onSurface },
  sisaBox: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 10, borderRadius: 8, backgroundColor: "#FEF3C7",
    borderWidth: 1, borderColor: "#FDE68A",
  },
  sisaLabel: { fontSize: 11, fontWeight: "700", color: "#92400E" },
  sisaValue: { fontSize: 14, fontWeight: "800", color: "#92400E" },
  photoRow: { flexDirection: "row", gap: 8 },
  photoBox: { flex: 1, borderRadius: 8, overflow: "hidden", borderWidth: 1, borderColor: theme.color.border },
  photoImg: { width: "100%", aspectRatio: 1, backgroundColor: "#000" },
  photoLabel: { fontSize: 10, textAlign: "center", padding: 4, backgroundColor: theme.color.surfaceSecondary, color: theme.color.onSurfaceSecondary, fontWeight: "600" },
  partsSection: { gap: 6 },
  partsTitle: { fontSize: 12, fontWeight: "700", color: theme.color.onSurfaceSecondary },
  partsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  partPill: {
    flexDirection: "row", gap: 6, alignItems: "center",
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, backgroundColor: "#DBEAFE", borderWidth: 1, borderColor: "#93C5FD",
  },
  partName: { fontSize: 12, color: "#1E40AF", fontWeight: "600" },
  partQty: { fontSize: 12, color: "#1E40AF", fontWeight: "900" },
  noteBox: { flexDirection: "row", gap: 6, padding: 8, backgroundColor: theme.color.surfaceSecondary, borderRadius: 8 },
  noteText: { flex: 1, fontSize: 12, color: theme.color.onSurfaceSecondary, fontStyle: "italic" },
  zoomOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center" },
  zoomImg: { width: "100%", height: "90%" },
  zoomClose: { position: "absolute", top: 40, right: 20, padding: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.15)" },
});
