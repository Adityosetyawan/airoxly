import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "@/src/theme";

type Props = {
  periodName: string;
  startDate: string;
  endDate: string;
  winnerCount: number;
  prizeDescription?: string | null;
  description?: string | null;
};

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

/**
 * Generic promotional poster for the active lottery period.
 * Rendered as PNG for sharing to WhatsApp / Instagram.
 */
export default function PromoPoster({
  periodName,
  startDate,
  endDate,
  winnerCount,
  prizeDescription,
  description,
}: Props) {
  return (
    <View style={styles.card}>
      {/* Header ribbon */}
      <View style={styles.ribbon}>
        <Text style={styles.ribbonText}>🎁 UNDIAN BERHADIAH 🎁</Text>
      </View>

      <View style={styles.brandRow}>
        <Text style={styles.brand}>💧 AIR OXLY</Text>
      </View>

      <Text style={styles.title}>{periodName}</Text>

      <View style={styles.periodBox}>
        <Text style={styles.periodLabel}>Periode Undian</Text>
        <Text style={styles.periodValue}>
          {fmtDate(startDate)}  →  {fmtDate(endDate)}
        </Text>
      </View>

      <View style={styles.winnersBadge}>
        <Text style={styles.winnersNumber}>{winnerCount}</Text>
        <Text style={styles.winnersLabel}>{winnerCount === 1 ? "PEMENANG UTAMA" : "PEMENANG BERUNTUNG"}</Text>
      </View>

      {prizeDescription ? (
        <View style={styles.prizeBox}>
          <Text style={styles.prizeIcon}>🏆</Text>
          <Text style={styles.prizeTitle}>HADIAH MENANTI</Text>
          <Text style={styles.prizeDesc}>{prizeDescription}</Text>
        </View>
      ) : null}

      <View style={styles.howBox}>
        <Text style={styles.howHead}>CARA IKUT SERTA</Text>
        <View style={styles.stepRow}>
          <Text style={styles.stepNum}>1</Text>
          <Text style={styles.stepText}>Beli air galon di Sales OXLY terdekat</Text>
        </View>
        <View style={styles.stepRow}>
          <Text style={styles.stepNum}>2</Text>
          <Text style={styles.stepText}>Setiap 1 galon = 1 nomor undian otomatis</Text>
        </View>
        <View style={styles.stepRow}>
          <Text style={styles.stepNum}>3</Text>
          <Text style={styles.stepText}>Simpan nota / kartu undian dari Sales</Text>
        </View>
        <View style={styles.stepRow}>
          <Text style={styles.stepNum}>4</Text>
          <Text style={styles.stepText}>Tunggu pengumuman pemenang di akhir periode</Text>
        </View>
      </View>

      {description ? (
        <View style={styles.descBox}>
          <Text style={styles.descText}>{description}</Text>
        </View>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.footerText}>Semakin banyak beli, semakin besar peluang menang!</Text>
        <Text style={styles.footerBrand}>#AirOXLYUntungTerus</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    padding: 20,
    width: 360,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: theme.color.brandPrimary,
  },
  ribbon: {
    alignSelf: "center",
    backgroundColor: "#F59E0B",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
  },
  ribbonText: { color: "#fff", fontWeight: "800", fontSize: 12, letterSpacing: 1 },
  brandRow: { alignItems: "center", marginTop: 12 },
  brand: { fontSize: 28, fontWeight: "800", color: theme.color.brand, letterSpacing: 2 },
  title: {
    textAlign: "center",
    fontSize: 20,
    fontWeight: "800",
    color: "#111",
    marginTop: 8,
    lineHeight: 24,
  },
  periodBox: {
    alignItems: "center",
    marginTop: 12,
    padding: 10,
    backgroundColor: theme.color.brandTertiary,
    borderRadius: 10,
  },
  periodLabel: { fontSize: 10, color: theme.color.brand, letterSpacing: 1, fontWeight: "700" },
  periodValue: { fontSize: 13, color: theme.color.brand, marginTop: 4, fontWeight: "600" },
  winnersBadge: {
    alignSelf: "center",
    marginTop: 16,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: theme.color.brandPrimary,
    alignItems: "center",
  },
  winnersNumber: { color: "#fff", fontSize: 40, fontWeight: "800", lineHeight: 44 },
  winnersLabel: { color: "#D1FAE5", fontSize: 11, fontWeight: "700", letterSpacing: 1, marginTop: 2 },
  prizeBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#FEF3C7",
    borderWidth: 2,
    borderColor: "#F59E0B",
    borderStyle: "dashed",
    alignItems: "center",
  },
  prizeIcon: { fontSize: 26 },
  prizeTitle: { fontSize: 11, color: "#B45309", fontWeight: "800", letterSpacing: 1.5, marginTop: 2 },
  prizeDesc: { fontSize: 15, color: "#78350F", fontWeight: "700", marginTop: 6, textAlign: "center", lineHeight: 20 },
  howBox: { marginTop: 14, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.color.border },
  howHead: { fontSize: 11, fontWeight: "800", color: theme.color.brand, letterSpacing: 1.5, marginBottom: 8, textAlign: "center" },
  stepRow: { flexDirection: "row", gap: 10, alignItems: "center", marginBottom: 6 },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.color.brandPrimary,
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 22,
  },
  stepText: { flex: 1, fontSize: 12, color: "#374151" },
  descBox: {
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#F9FAFB",
  },
  descText: { fontSize: 12, color: "#4B5563", fontStyle: "italic", textAlign: "center" },
  footer: { marginTop: 14, alignItems: "center" },
  footerText: { fontSize: 12, color: theme.color.brand, fontWeight: "700", textAlign: "center" },
  footerBrand: { fontSize: 11, color: "#9ca3af", marginTop: 4, letterSpacing: 1, fontWeight: "600" },
});
