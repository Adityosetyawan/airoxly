import React, { useEffect, useState, useCallback } from "react";
import { ScrollView, StyleSheet, Text, View, TouchableOpacity, RefreshControl } from "react-native";
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

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const todayTotals = today.reduce(
    (acc, r) => ({
      produksi_galon: acc.produksi_galon + (r.produksi_galon || 0),
      galon_ganti: acc.galon_ganti + (r.galon_ganti || 0),
      sparepart: acc.sparepart + (r.sil_ganti || 0) + (r.mur_ganti || 0) + (r.kran_ganti || 0) + (r.stiker_ganti || 0) + (r.stoper_ganti || 0),
    }),
    { produksi_galon: 0, galon_ganti: 0, sparepart: 0 },
  );

  // Group today's entries by kelompok
  const byKelompok = today.reduce((acc: Record<string, any>, r) => {
    const key = r.kelompok || "-";
    if (!acc[key]) acc[key] = { count: 0, produksi_galon: 0, galon_ganti: 0, sparepart: 0 };
    acc[key].count += 1;
    acc[key].produksi_galon += r.produksi_galon || 0;
    acc[key].galon_ganti += r.galon_ganti || 0;
    acc[key].sparepart += (r.sil_ganti || 0) + (r.mur_ganti || 0) + (r.kran_ganti || 0) + (r.stiker_ganti || 0) + (r.stoper_ganti || 0);
    return acc;
  }, {});
  const kelompokList = Object.entries(byKelompok);

  // Group today's entries by SALES
  const bySales = today.reduce((acc: Record<string, any>, r) => {
    const key = r.sales_code || "-";
    if (!acc[key]) acc[key] = { count: 0, produksi_galon: 0, galon_ganti: 0, sparepart: 0, sil: 0, mur: 0, kran: 0, stiker: 0, stoper: 0, karet_kran: 0 };
    acc[key].count += 1;
    acc[key].produksi_galon += r.produksi_galon || 0;
    acc[key].galon_ganti += r.galon_ganti || 0;
    acc[key].sil += r.sil_ganti || 0;
    acc[key].mur += r.mur_ganti || 0;
    acc[key].kran += r.kran_ganti || 0;
    acc[key].stiker += r.stiker_ganti || 0;
    acc[key].stoper += r.stoper_ganti || 0;
    acc[key].karet_kran += r.karet_kran_ganti || 0;
    acc[key].sparepart = acc[key].sil + acc[key].mur + acc[key].kran + acc[key].stiker + acc[key].stoper + acc[key].karet_kran;
    return acc;
  }, {});
  const salesList = Object.entries(bySales).sort(([a], [b]) => a.localeCompare(b));

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
          <StatCard icon="document-text" label="Entry Hari Ini" value={today.length} color="#8B5CF6" />
        </View>

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
            <Text style={styles.section}>Rekap per Sales (Hari Ini)</Text>
            <View style={styles.kelWrap}>
              {salesList.map(([k, v]: any) => (
                <View key={k} style={styles.salesCard}>
                  <View style={styles.salesHeader}>
                    <Text style={styles.salesBadge}>{k}</Text>
                    <Text style={styles.salesEntry}>{v.count} entry</Text>
                  </View>
                  <View style={styles.kelRow}>
                    <KelItem label="Prod Gln" value={v.produksi_galon} />
                    <KelItem label="Gln Gt" value={v.galon_ganti} />
                    <KelItem label="Sparepart" value={v.sparepart} />
                  </View>
                  {v.sparepart > 0 ? (
                    <View style={styles.spWrap}>
                      {v.sil > 0 ? <SpPill k="Sil" v={v.sil} /> : null}
                      {v.mur > 0 ? <SpPill k="Mur" v={v.mur} /> : null}
                      {v.kran > 0 ? <SpPill k="Kran" v={v.kran} /> : null}
                      {v.stiker > 0 ? <SpPill k="Stiker" v={v.stiker} /> : null}
                      {v.stoper > 0 ? <SpPill k="Stoper" v={v.stoper} /> : null}
                      {v.karet_kran > 0 ? <SpPill k="Krt Krn" v={v.karet_kran} /> : null}
                    </View>
                  ) : null}
                </View>
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

function SpPill({ k, v }: { k: string; v: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: "#FEF3C7", borderWidth: 1, borderColor: "#FDE68A" }}>
      <Text style={{ fontSize: 10, color: "#92400E" }}>{k}</Text>
      <Text style={{ fontSize: 10, fontWeight: "800", color: "#92400E" }}>{v}</Text>
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
    flexBasis: "48%",
    backgroundColor: theme.color.surface,
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    gap: 4,
  },
  statValue: { fontSize: 22, fontWeight: "800", color: theme.color.onSurface },
  statLabel: { fontSize: 12, color: theme.color.muted },
  bigBtn: {
    backgroundColor: theme.color.brandPrimary,
    padding: 16,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginVertical: 4,
  },
  bigBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  stockCard: { backgroundColor: theme.color.surface, borderRadius: 12, padding: 12 },
  stockRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.color.border,
  },
  stockName: { fontSize: 14, color: theme.color.onSurface },
  stockValue: { fontSize: 15, fontWeight: "700", color: theme.color.onSurface },
  kelWrap: { gap: 8 },
  kelCard: { backgroundColor: theme.color.surface, borderRadius: 12, padding: 12, gap: 8, borderLeftWidth: 4, borderLeftColor: "#8B5CF6" },
  kelName: { fontSize: 14, fontWeight: "800", color: "#8B5CF6" },
  kelRow: { flexDirection: "row", gap: 4 },
  salesCard: { backgroundColor: theme.color.surface, borderRadius: 12, padding: 12, gap: 8, borderLeftWidth: 4, borderLeftColor: theme.color.brand },
  salesHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  salesBadge: { fontSize: 13, fontWeight: "800", color: theme.color.brand, backgroundColor: theme.color.brandTertiary, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  salesEntry: { fontSize: 11, color: theme.color.muted },
  spWrap: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
});
