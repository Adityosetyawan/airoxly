import React from "react";
import { StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { theme } from "@/src/theme";

type Props = {
  customerName: string;
  customerNo?: number | null;
  salesCode?: string;
  periodName?: string;
  periodEnd?: string;
  prizeDescription?: string | null;
  tickets: string[];
  txDate?: string;
};

function fmtDate(iso?: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

/**
 * Personal lottery ticket card designed to be captured as PNG.
 * Renders customer info + all ticket codes with a QR that encodes them.
 */
export default function TicketCard({
  customerName,
  customerNo,
  salesCode,
  periodName,
  periodEnd,
  prizeDescription,
  tickets,
  txDate,
}: Props) {
  const qrValue = tickets.join(",");
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>💧 AIR OXLY</Text>
          <Text style={styles.tag}>Kartu Undian Pelanggan</Text>
        </View>
        <View style={styles.ribbon}>
          <Text style={styles.ribbonText}>🎁 UNDIAN</Text>
        </View>
      </View>

      <View style={styles.periodBlock}>
        <Text style={styles.periodTitle}>{periodName || "Undian Air OXLY"}</Text>
        {periodEnd && (
          <Text style={styles.periodDate}>Diundi: {fmtDate(periodEnd)}</Text>
        )}
        {prizeDescription ? (
          <Text style={styles.prize} numberOfLines={3}>🏆 {prizeDescription}</Text>
        ) : null}
      </View>

      <View style={styles.custBlock}>
        <View style={{ flex: 1 }}>
          <Text style={styles.custLabel}>Nama Pelanggan</Text>
          <Text style={styles.custName}>{customerName}</Text>
          <Text style={styles.custMeta}>
            {customerNo != null ? `No. ${customerNo}  ·  ` : ""}Sales {salesCode || "-"}
          </Text>
          {txDate && <Text style={styles.custDate}>Transaksi: {fmtDate(txDate)}</Text>}
        </View>
        <View style={styles.qrBox}>
          <QRCode value={qrValue || "OXLY"} size={72} />
        </View>
      </View>

      <View style={styles.ticketsSection}>
        <Text style={styles.ticketsHead}>
          Nomor Undian Anda ({tickets.length})
        </Text>
        <View style={styles.ticketsGrid}>
          {tickets.map((t) => (
            <View key={t} style={styles.chip}>
              <Text style={styles.chipText}>{t}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          ✓ Simpan kartu ini sebagai bukti tiket undian
        </Text>
        <Text style={styles.footerBrand}>www.airoxly · Terima kasih 🙏</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    padding: 18,
    width: 340,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: theme.color.brandPrimary,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brand: { fontSize: 22, fontWeight: "800", color: theme.color.brand, letterSpacing: 1 },
  tag: { fontSize: 10, color: "#6b7280", marginTop: 2, letterSpacing: 1 },
  ribbon: {
    backgroundColor: "#F59E0B",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  ribbonText: { color: "#fff", fontWeight: "700", fontSize: 10, letterSpacing: 0.5 },
  periodBlock: {
    marginTop: 14,
    padding: 10,
    borderRadius: 10,
    backgroundColor: theme.color.brandTertiary,
    borderLeftWidth: 3,
    borderLeftColor: theme.color.brandPrimary,
  },
  periodTitle: { fontSize: 15, fontWeight: "700", color: theme.color.brand },
  periodDate: { fontSize: 11, color: theme.color.brand, marginTop: 2, opacity: 0.75 },
  prize: { fontSize: 12, color: "#B45309", marginTop: 6, fontWeight: "600" },
  custBlock: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#F9FAFB",
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  custLabel: { fontSize: 9, color: "#6b7280", letterSpacing: 0.5 },
  custName: { fontSize: 16, fontWeight: "700", color: "#111", marginTop: 2 },
  custMeta: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  custDate: { fontSize: 10, color: "#9ca3af", marginTop: 3, fontStyle: "italic" },
  qrBox: { padding: 6, backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: "#E5E7EB" },
  ticketsSection: { marginTop: 14 },
  ticketsHead: { fontSize: 11, fontWeight: "700", color: "#374151", letterSpacing: 0.3 },
  ticketsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: theme.color.brandPrimary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.5,
    fontFamily: "monospace",
  },
  footer: { marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#E5E7EB", alignItems: "center" },
  footerText: { fontSize: 10, color: "#6b7280", fontStyle: "italic" },
  footerBrand: { fontSize: 9, color: "#9ca3af", marginTop: 2, letterSpacing: 1 },
});
