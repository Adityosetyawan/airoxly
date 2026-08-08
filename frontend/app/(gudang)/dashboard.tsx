import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppHeader } from "@/src/components/AppHeader";
import { theme } from "@/src/theme";
import { useAuth } from "@/src/AuthContext";
import { api } from "@/src/api";

export function itemLabel(k: string) {
  return (
    {
      galon: "Galon",
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

export default function GudangDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [stock, setStock] = useState<Record<string, number>>({});
  const [today, setToday] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, t] = await Promise.all([
        api.getWarehouseStock(),
        api.listWarehouseDaily({
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

  const totals = today.reduce(
    (acc, r) => ({
      bawa: acc.bawa + (r.bawa_pagi || 0) + (r.bawa_siang || 0),
      sisa: acc.sisa + (r.sisa_pagi || 0) + (r.sisa_siang || 0),
      galon_ganti: acc.galon_ganti + (r.galon_ganti || 0) + (r.galon_kran || 0) + (r.galon_polos || 0),
    }),
    { bawa: 0, sisa: 0, galon_ganti: 0 },
  );
  const terjual = totals.bawa - totals.sisa;

  const byKelompok = today.reduce((acc: Record<string, any>, r) => {
    const key = r.kelompok || "-";
    if (!acc[key]) acc[key] = { count: 0, bawa: 0, sisa: 0, galon_ganti: 0 };
    acc[key].count += 1;
    acc[key].bawa += (r.bawa_pagi || 0) + (r.bawa_siang || 0);
    acc[key].sisa += (r.sisa_pagi || 0) + (r.sisa_siang || 0);
    acc[key].galon_ganti += (r.galon_ganti || 0) + (r.galon_kran || 0) + (r.galon_polos || 0);
    return acc;
  }, {});
  const kelompokList = Object.entries(byKelompok);

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.surfaceSecondary }}>
      <AppHeader title="Gudang" subtitle={`${user?.name || user?.username}${user?.kelompok ? ` • ${user.kelompok}` : ""}`} />
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <Text style={styles.section}>Ringkasan Hari Ini</Text>
        <View style={styles.grid}>
          <StatCard icon="arrow-up-circle" label="Total Bawa" value={totals.bawa} color="#059669" />
          <StatCard icon="arrow-down-circle" label="Total Sisa" value={totals.sisa} color="#F59E0B" />
          <StatCard icon="cash" label="Terjual (Bawa−Sisa)" value={terjual} color="#0EA5E9" />
          <StatCard icon="swap-horizontal" label="Galon Ganti" value={totals.galon_ganti} color="#EF4444" />
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity style={[styles.bigBtn, { flex: 1 }]} onPress={() => router.push("/(gudang)/input")}>
            <Ionicons name="create-outline" size={20} color="#fff" />
            <Text style={styles.bigBtnText}>Input Harian</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.bigBtn, { flex: 1, backgroundColor: "#DC2626" }]} onPress={() => router.push("/(gudang)/incoming")}>
            <Ionicons name="download-outline" size={20} color="#fff" />
            <Text style={styles.bigBtnText}>Barang Datang</Text>
          </TouchableOpacity>
        </View>

        {kelompokList.length > 0 ? (
          <>
            <Text style={styles.section}>Rekap per Regu (Hari Ini)</Text>
            <View style={{ gap: 8 }}>
              {kelompokList.map(([k, v]: any) => (
                <View key={k} style={styles.kelCard}>
                  <Text style={styles.kelName}>{k}</Text>
                  <View style={{ flexDirection: "row" }}>
                    <KelItem label="Bawa" value={v.bawa} />
                    <KelItem label="Sisa" value={v.sisa} />
                    <KelItem label="Terjual" value={v.bawa - v.sisa} />
                    <KelItem label="Gln Gt" value={v.galon_ganti} />
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <Text style={styles.section}>Stok Terkini</Text>
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
    padding: 14,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  bigBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
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
  kelCard: { backgroundColor: theme.color.surface, borderRadius: 12, padding: 12, gap: 8, borderLeftWidth: 4, borderLeftColor: "#DC2626" },
  kelName: { fontSize: 14, fontWeight: "800", color: "#DC2626" },
});
