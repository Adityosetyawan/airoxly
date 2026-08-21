import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppHeader } from "@/src/components/AppHeader";
import { theme } from "@/src/theme";
import { api } from "@/src/api";
import { StockSplitPanel } from "@/src/components/StockSplitPanel";

type PartPrice = { id: string; name: string; rp_per_pcs: number; order?: number };
type Transfer = {
  id: string;
  date: string;
  part_name: string;
  qty: number;
  notes?: string;
  created_by_name?: string;
};

export default function ProduksiStock() {
  const [split, setSplit] = useState<{ gudang: Record<string, number>; produksi: Record<string, number> } | null>(null);
  const [parts, setParts] = useState<PartPrice[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [bahanRows, setBahanRows] = useState<{ name: string; unit: string; gudang: number; produksi: number }[]>([]);
  const [bahanTransfers, setBahanTransfers] = useState<any[]>([]);
  const [refresh, setRefresh] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, p, t, stkBahan, bahanTrf] = await Promise.all([
        api.getStockSplit(),
        api.listPartPrices().catch(() => []),
        api.listSparepartTransfers({}).catch(() => []),
        api.getInventoryStock("bahan").catch(() => ({ bahan: [] })),
        api.listBahanTransfers({}).catch(() => []),
      ]);
      setSplit(s as any);
      const sorted = [...(p || [])].sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
      setParts(sorted);
      setTransfers(t || []);
      setBahanRows(stkBahan?.bahan || []);
      setBahanTransfers(bahanTrf || []);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    if (!split) return [];
    const names = parts.map((p) => p.name);
    const extra = Object.keys(split.gudang || {}).filter((k) => !names.includes(k));
    return [...names, ...extra].map((n) => ({
      name: n,
      gudang: Number(split.gudang?.[n] || 0),
      produksi: Number(split.produksi?.[n] || 0),
    }));
  }, [split, parts]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.surfaceSecondary }}>
      <AppHeader title="Stok Sparepart Produksi" />
      <ScrollView
        contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={async () => { setRefresh(true); await load(); setRefresh(false); }} />}
      >
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={16} color={theme.color.brand} />
          <Text style={styles.infoText}>
            Setiap kali penggantian sparepart per Sales di input harian, stok Produksi otomatis berkurang.
            Kalau stok kurang, minta Gudang kirim.
          </Text>
        </View>

        {/* BAHAN Produksi */}
        <Text style={styles.section}>Kotak Pantau Stok Bahan</Text>
        <View style={styles.bahanCard}>
          <View style={styles.bahanHeader}>
            <Text style={[styles.bahanHeaderText, { flex: 1 }]}>Bahan</Text>
            <Text style={[styles.bahanHeaderText, styles.bahanCol]}>Gudang</Text>
            <Text style={[styles.bahanHeaderText, styles.bahanCol, { color: "#fff", backgroundColor: "#8B5CF6" }]}>Produksi</Text>
          </View>
          {bahanRows.length === 0 ? (
            <Text style={styles.emptyText}>Belum ada bahan</Text>
          ) : (
            bahanRows.map((r) => (
              <View key={r.name} style={styles.bahanRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bahanName}>{r.name}</Text>
                  <Text style={styles.bahanUnit}>{r.unit}</Text>
                </View>
                <Text style={[styles.bahanVal, { color: theme.color.muted }]}>{r.gudang}</Text>
                <Text style={[styles.bahanVal, r.produksi < 10 && { color: theme.color.error }]}>{r.produksi}</Text>
              </View>
            ))
          )}
        </View>

        {bahanTransfers.length > 0 && (
          <>
            <Text style={styles.section}>Riwayat Bahan Masuk dari Gudang</Text>
            <View style={styles.historyBox}>
              {bahanTransfers.slice(0, 20).map((m: any) => (
                <View key={m.id} style={styles.hRow}>
                  <View style={[styles.hIcon, { backgroundColor: "rgba(139,92,246,0.15)" }]}>
                    <Ionicons name="download" size={14} color="#8B5CF6" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.hName}>{m.item_name} · <Text style={{ color: "#8B5CF6", fontWeight: "800" }}>+{m.qty}</Text></Text>
                    <Text style={styles.hSub}>{m.date}{m.notes ? " · " + m.notes : ""} · {m.created_by_name || "-"}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        <Text style={styles.section}>Kotak Pantau Stok Sparepart</Text>
        <StockSplitPanel rows={rows} highlight="produksi" />

        <Text style={styles.section}>Riwayat Kiriman dari Gudang</Text>
        <View style={styles.historyBox}>
          {transfers.length === 0 ? (
            <Text style={styles.emptyText}>Belum ada kiriman</Text>
          ) : (
            transfers.slice(0, 30).map((t) => (
              <View key={t.id} style={styles.hRow}>
                <View style={styles.hIcon}>
                  <Ionicons name="download" size={14} color={theme.color.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.hName}>
                    {t.part_name} · <Text style={{ color: theme.color.brand, fontWeight: "800" }}>+{t.qty}</Text>
                  </Text>
                  <Text style={styles.hSub}>
                    {t.date}{t.notes ? " · " + t.notes : ""} · dari {t.created_by_name || "-"}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  infoBox: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    padding: 10,
    borderRadius: 10,
    backgroundColor: "rgba(15,118,110,0.06)",
    borderWidth: 1,
    borderColor: "rgba(15,118,110,0.15)",
  },
  infoText: { flex: 1, fontSize: 11, color: theme.color.onSurface, lineHeight: 16 },
  section: { fontSize: 13, fontWeight: "800", color: theme.color.onSurface, marginTop: 6 },
  historyBox: {
    backgroundColor: theme.color.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.color.border,
    padding: 10,
    gap: 6,
  },
  hRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  hIcon: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: theme.color.brandTertiary,
    alignItems: "center", justifyContent: "center",
  },
  hName: { fontSize: 13, color: theme.color.onSurface, fontWeight: "600" },
  hSub: { fontSize: 11, color: theme.color.muted, marginTop: 2 },
  emptyText: { fontSize: 12, color: theme.color.muted, textAlign: "center", padding: 20 },
  bahanCard: { backgroundColor: theme.color.surface, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: theme.color.border },
  bahanHeader: { flexDirection: "row", alignItems: "center", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: theme.color.border, marginBottom: 4 },
  bahanHeaderText: { fontSize: 10, fontWeight: "800", color: theme.color.muted, textTransform: "uppercase", letterSpacing: 0.4 },
  bahanCol: { minWidth: 70, textAlign: "center", padding: 4, borderRadius: 6 },
  bahanRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.color.border },
  bahanName: { fontSize: 13, fontWeight: "700", color: theme.color.onSurface },
  bahanUnit: { fontSize: 10, color: theme.color.muted },
  bahanVal: { minWidth: 70, fontSize: 16, fontWeight: "700", color: theme.color.onSurface, textAlign: "center", fontVariant: ["tabular-nums"] },
});
