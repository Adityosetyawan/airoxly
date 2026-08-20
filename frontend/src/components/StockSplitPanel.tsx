import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/theme";

type Row = { name: string; gudang: number; produksi: number };

// Ikon default berdasarkan nama part
function pickIcon(name: string): any {
  const n = name.toLowerCase();
  if (n.includes("galon")) return "water";
  if (n.includes("seal") || n.includes("sil")) return "ellipse-outline";
  if (n.includes("mur")) return "cog";
  if (n.includes("kran")) return "beaker";
  if (n.includes("stiker")) return "pricetag";
  if (n.includes("karet")) return "ellipse";
  if (n.includes("stoper")) return "stop-circle";
  if (n.includes("tisue") || n.includes("tissue")) return "layers-outline";
  return "cube-outline";
}

/**
 * Kotak pantau stok sparepart di Gudang & Produksi.
 *
 * @param highlight - "gudang" | "produksi" | undefined — kolom yang di-emphasize
 * @param rows      - list part dengan qty di Gudang & Produksi
 */
export function StockSplitPanel({
  rows,
  highlight,
  showTotal = true,
}: {
  rows: Row[];
  highlight?: "gudang" | "produksi";
  showTotal?: boolean;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.hName}>Part</Text>
        <View style={[styles.hCell, highlight === "gudang" && styles.hCellActive]}>
          <Ionicons name="cube" size={12} color={highlight === "gudang" ? "#fff" : theme.color.brand} />
          <Text style={[styles.hCellText, highlight === "gudang" && { color: "#fff" }]}>Gudang</Text>
        </View>
        <View style={[styles.hCell, highlight === "produksi" && styles.hCellActive]}>
          <Ionicons name="build" size={12} color={highlight === "produksi" ? "#fff" : theme.color.brand} />
          <Text style={[styles.hCellText, highlight === "produksi" && { color: "#fff" }]}>Produksi</Text>
        </View>
        {showTotal && (
          <View style={styles.hCell}>
            <Text style={styles.hCellText}>Total</Text>
          </View>
        )}
      </View>
      {rows.length === 0 ? (
        <Text style={styles.emptyText}>Belum ada item Part. Minta Super Admin tambah di Pengaturan.</Text>
      ) : (
        rows.map((r) => {
          const total = r.gudang + r.produksi;
          const lowGudang = r.gudang < 10;
          const lowProduksi = r.produksi < 10;
          return (
            <View key={r.name} style={styles.row}>
              <View style={styles.iconBox}>
                <Ionicons name={pickIcon(r.name)} size={16} color={theme.color.brand} />
              </View>
              <Text style={styles.name} numberOfLines={1}>{r.name}</Text>
              <Text
                style={[
                  styles.qty,
                  lowGudang && { color: theme.color.error },
                  highlight === "gudang" && styles.qtyBoldBrand,
                ]}
              >
                {r.gudang}
              </Text>
              <Text
                style={[
                  styles.qty,
                  lowProduksi && { color: theme.color.error },
                  highlight === "produksi" && styles.qtyBoldBrand,
                ]}
              >
                {r.produksi}
              </Text>
              {showTotal && (
                <Text style={[styles.qty, { fontWeight: "700" }]}>{total}</Text>
              )}
            </View>
          );
        })
      )}
      <Text style={styles.footNote}>Angka merah = kurang dari 10 unit</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: theme.color.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.color.border,
    padding: 10,
    gap: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
    marginBottom: 4,
    gap: 4,
  },
  hName: { flex: 1, fontSize: 10, fontWeight: "800", color: theme.color.muted, letterSpacing: 0.3, textTransform: "uppercase", paddingLeft: 34 },
  hCell: { flexDirection: "row", alignItems: "center", gap: 2, minWidth: 62, justifyContent: "center", padding: 4, borderRadius: 6 },
  hCellActive: { backgroundColor: theme.color.brandPrimary },
  hCellText: { fontSize: 10, fontWeight: "800", color: theme.color.brand, letterSpacing: 0.3, textTransform: "uppercase" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 2,
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.color.border,
  },
  iconBox: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: theme.color.brandTertiary,
    alignItems: "center", justifyContent: "center",
  },
  name: { flex: 1, fontSize: 13, fontWeight: "600", color: theme.color.onSurface },
  qty: {
    minWidth: 62,
    fontSize: 15,
    fontWeight: "600",
    color: theme.color.onSurface,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  qtyBoldBrand: { color: theme.color.brand, fontWeight: "800" },
  emptyText: { fontSize: 12, color: theme.color.muted, textAlign: "center", padding: 20 },
  footNote: { fontSize: 10, color: theme.color.muted, textAlign: "center", marginTop: 6 },
});
