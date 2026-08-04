import React, { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import ViewShot from "react-native-view-shot";
import { theme, rp } from "@/src/theme";
import { api, Transaction } from "@/src/api";
import { useAuth } from "@/src/AuthContext";
import { useToast } from "@/src/components/Toast";
import { formatReceipt, sendWhatsApp } from "@/src/whatsapp";
import TicketCard from "@/src/components/TicketCard";
import { saveShot, shareShot } from "@/src/utils/capture";

export default function TransactionDetail() {
  const { id, autoSendWA } = useLocalSearchParams<{ id: string; autoSendWA?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const [t, setT] = useState<Transaction | null>(null);
  const [period, setPeriod] = useState<any | null>(null);
  const [ticketBusy, setTicketBusy] = useState<null | "save" | "share">(null);
  const autoSentRef = useRef(false);
  const ticketShotRef = useRef<ViewShot>(null);

  const load = useCallback(async () => {
    try {
      const found = await api.getTransaction(id!);
      setT(found);
      if (found.lottery_tickets && found.lottery_tickets.length > 0) {
        // Fetch period info to enrich the ticket card
        try {
          const periods = await api.listLotteryPeriods();
          const p = periods.find((pp) => pp.name === found.lottery_period_name);
          setPeriod(p || null);
        } catch {}
      }
    } catch (e: any) {
      toast.show(e.message || "Gagal", "error");
    }
  }, [id, toast]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const [waBusy, setWaBusy] = useState(false);

  const resendWA = async () => {
    if (!t) return;
    setWaBusy(true);
    try {
      const msg = formatReceipt({
        storeName: "Air OXLY",
        salesCode: t.sales_code || user?.username,
        customerName: t.customer_name,
        customerNo: t.customer_no,
        date: t.date,
        items: t.items,
        total: t.total,
        bayar: t.bayar,
        hutang_transaksi: t.hutang_transaksi,
        pinjam_galon: t.pinjam_galon,
        galon_kembali: t.galon_kembali,
        new_debt: t.new_debt,
        new_loans: t.new_loans,
        edited: t.edited,
        lottery_tickets: t.lottery_tickets,
        lottery_period_name: t.lottery_period_name,
      });

      // If transaction has lottery tickets, first save the Kartu Undian
      // as PNG (gallery on native, download on web) so the user can attach
      // it as a follow-up message. Then open WhatsApp directly to the
      // customer's chat with the text pre-filled — no "pilih penerima" step.
      if (t.lottery_tickets && t.lottery_tickets.length > 0) {
        try {
          await saveShot(ticketShotRef, "oxly-ticket-card-shot", `OXLY-Kartu-${t.customer_name}`);
          toast.show(
            Platform.OS === "web"
              ? "Kartu Undian terunduh — lampirkan di chat WhatsApp setelah teks terkirim"
              : "Kartu Undian tersimpan di galeri — lampirkan di chat WhatsApp",
            "success",
          );
        } catch {
          // continue even if save fails
        }
      }

      // Direct to customer chat with text pre-filled
      await sendWhatsApp(t.customer_wa || "", msg);
    } catch (e: any) {
      toast.show(e.message || "Gagal", "error");
    } finally {
      setWaBusy(false);
    }
  };

  // Auto-trigger WA send when navigated with autoSendWA=1 (after new transaction with tickets)
  useEffect(() => {
    if (autoSentRef.current || autoSendWA !== "1") return;
    if (!t || !t.lottery_tickets || t.lottery_tickets.length === 0) return;
    autoSentRef.current = true;
    // small delay so the ViewShot has painted the card (with optional period enrichment)
    const timer = setTimeout(() => {
      resendWA();
    }, 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, autoSendWA]);

  if (!t) {
    return (
      <SafeAreaView style={styles.wrap} edges={["top"]}>
        <Text style={{ textAlign: "center", marginTop: 40, color: theme.color.muted }}>Memuat…</Text>
      </SafeAreaView>
    );
  }

  const canEdit = user?.role === "sales" && t.edit_count < 1 && t.sales_id === user?.id;
  const canDelete = user?.role === "super_admin";

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} testID="back-btn">
          <Ionicons name="chevron-back" size={24} color={theme.color.onSurface} />
        </TouchableOpacity>
        <Text style={styles.title}>Detail Transaksi</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={styles.hero}>
          <Text style={styles.date}>{new Date(t.date).toLocaleString("id-ID")}</Text>
          <Text style={styles.customer}>{t.customer_name} · #{t.customer_no}</Text>
          <Text style={styles.sales}>Sales: {t.sales_code}</Text>
          {t.edited && (
            <View style={styles.editedBadge}>
              <Ionicons name="create" size={12} color={theme.color.warning} />
              <Text style={styles.editedText}>Diedit</Text>
            </View>
          )}
        </View>

        <Text style={styles.section}>Item Pembelian</Text>
        <View style={styles.card}>
          {t.items.map((i, idx) => (
            <View key={idx} style={styles.item}>
              <Text style={styles.iName}>{i.product_name}</Text>
              <Text style={styles.iQty}>{i.qty} {i.unit} × Rp {rp(i.price)}</Text>
              <Text style={styles.iTotal}>Rp {rp(i.subtotal)}</Text>
            </View>
          ))}
          {t.items.length === 0 && <Text style={styles.empty}>Tidak ada item</Text>}
        </View>

        <View style={styles.card}>
          <Row label="Total Belanja" value={"Rp " + rp(t.total)} bold />
          <Row label="Uang Dibayar" value={"Rp " + rp(t.bayar)} />
          <Row label="Hutang Transaksi Ini" value={"Rp " + rp(t.hutang_transaksi)} color={t.hutang_transaksi > 0 ? theme.color.error : undefined} />
          <Row label="Pinjam Galon" value={t.pinjam_galon + " gln"} />
          <Row label="Galon Kembali" value={t.galon_kembali + " gln"} />
        </View>

        <Text style={styles.section}>Status Pelanggan Setelah Transaksi</Text>
        <View style={styles.card}>
          <Row label="Hutang Sebelum" value={"Rp " + rp(t.prev_debt)} />
          <Row label="Total Hutang Sekarang" value={"Rp " + rp(t.new_debt)} bold color={t.new_debt > 0 ? theme.color.error : theme.color.success} />
          <Row label="Pinjam Sebelum" value={t.prev_loans + " gln"} />
          <Row label="Total Pinjam Galon" value={t.new_loans + " gln"} bold />
        </View>

        {t.lottery_tickets && t.lottery_tickets.length > 0 && (
          <>
            <Text style={styles.section}>🎁 Kartu Undian ({t.lottery_tickets.length})</Text>
            <View style={styles.cardWrap} nativeID="oxly-ticket-card-shot">
              <ViewShot ref={ticketShotRef} options={{ format: "png", quality: 1 }}>
                <TicketCard
                  customerName={t.customer_name}
                  customerNo={t.customer_no}
                  salesCode={t.sales_code || user?.username}
                  periodName={t.lottery_period_name || period?.name || "Undian Air OXLY"}
                  periodEnd={period?.end_date}
                  prizeDescription={period?.prize_description}
                  tickets={t.lottery_tickets}
                  txDate={t.date}
                />
              </ViewShot>
            </View>
            <View style={styles.ticketActionsRow}>
              <TouchableOpacity
                onPress={async () => {
                  setTicketBusy("save");
                  try {
                    await saveShot(ticketShotRef, "oxly-ticket-card-shot", `OXLY-Kartu-${t.customer_name}`);
                    toast.show(Platform.OS === "web" ? "Kartu diunduh" : "Kartu tersimpan di galeri", "success");
                  } catch (e: any) {
                    toast.show(e?.message || "Gagal simpan", "error");
                  } finally {
                    setTicketBusy(null);
                  }
                }}
                disabled={ticketBusy !== null}
                style={[styles.ticketBtnGhost, ticketBusy !== null && { opacity: 0.6 }]}
                testID="save-ticket-card-btn"
              >
                <Ionicons name="download-outline" size={16} color={theme.color.brand} />
                <Text style={styles.ticketBtnGhostText}>
                  {ticketBusy === "save" ? "Menyimpan…" : "Simpan Kartu"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  setTicketBusy("share");
                  try {
                    await shareShot(ticketShotRef, "oxly-ticket-card-shot", `OXLY-Kartu-${t.customer_name}`, `Kartu Undian ${t.customer_name}`);
                  } catch (e: any) {
                    toast.show(e?.message || "Gagal share", "error");
                  } finally {
                    setTicketBusy(null);
                  }
                }}
                disabled={ticketBusy !== null}
                style={[styles.ticketBtnShare, ticketBusy !== null && { opacity: 0.6 }]}
                testID="share-ticket-card-btn"
              >
                <Ionicons name="share-social" size={16} color="#fff" />
                <Text style={styles.ticketBtnShareText}>
                  {ticketBusy === "share" ? "Menyiapkan…" : "Share ke WA"}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <TouchableOpacity
          onPress={resendWA}
          disabled={waBusy}
          style={[styles.wa, waBusy && { opacity: 0.6 }]}
          testID="resend-wa-btn"
        >
          <Ionicons name="logo-whatsapp" size={20} color="#fff" />
          <Text style={styles.waText}>
            {waBusy
              ? "Menyiapkan…"
              : t.customer_wa
              ? t.lottery_tickets && t.lottery_tickets.length > 0
                ? `Kirim Nota + Simpan Kartu Undian ke ${t.customer_name}`
                : `Kirim Nota WA ke ${t.customer_name}`
              : "Nomor WA pelanggan kosong"}
          </Text>
        </TouchableOpacity>

        {canEdit && (
          <TouchableOpacity
            onPress={() => router.push({ pathname: "/(sales)/transaction/new", params: { customer_id: t.customer_id, edit_id: t.id } })}
            style={styles.edit}
            testID="edit-tx-btn"
          >
            <Ionicons name="create-outline" size={20} color={theme.color.brand} />
            <Text style={styles.editText}>Edit Transaksi (1x)</Text>
          </TouchableOpacity>
        )}
        {canDelete && (
          <TouchableOpacity
            onPress={async () => {
              try {
                await api.deleteTransaction(t.id);
                toast.show("Transaksi dihapus", "success");
                router.back();
              } catch (e: any) {
                toast.show(e.message || "Gagal", "error");
              }
            }}
            style={styles.del}
            testID="delete-tx-btn"
          >
            <Ionicons name="trash-outline" size={20} color={theme.color.error} />
            <Text style={styles.delText}>Hapus Transaksi</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rLabel}>{label}</Text>
      <Text style={[styles.rValue, bold && { fontWeight: "700" }, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.color.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.color.border },
  back: { padding: 8 },
  title: { fontSize: 17, fontWeight: "600", color: theme.color.onSurface },
  hero: { alignItems: "center", paddingVertical: 16 },
  date: { fontSize: 12, color: theme.color.muted },
  customer: { fontSize: 18, fontWeight: "600", color: theme.color.onSurface, marginTop: 4 },
  sales: { fontSize: 12, color: theme.color.muted, marginTop: 2 },
  editedBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FEF3C7", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, marginTop: 8 },
  editedText: { fontSize: 11, color: theme.color.warning, fontWeight: "600" },
  section: { fontSize: 14, fontWeight: "600", marginTop: 16, marginBottom: 8, color: theme.color.onSurface },
  card: { borderWidth: 1, borderColor: theme.color.border, borderRadius: 14, overflow: "hidden" },
  item: { flexDirection: "row", padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.color.border, alignItems: "center" },
  iName: { flex: 1, fontSize: 14, color: theme.color.onSurface, fontWeight: "500" },
  iQty: { fontSize: 12, color: theme.color.muted, marginRight: 12 },
  iTotal: { fontSize: 14, fontWeight: "600", color: theme.color.brand },
  empty: { padding: 16, color: theme.color.muted, textAlign: "center" },
  row: { flexDirection: "row", justifyContent: "space-between", padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.color.border, alignItems: "center", gap: 12 },
  rLabel: { fontSize: 13, color: theme.color.muted },
  rValue: { fontSize: 14, fontWeight: "500", color: theme.color.onSurface, textAlign: "right", flexShrink: 1 },
  wa: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 14, backgroundColor: "#25D366", marginTop: 20 },
  waText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  edit: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: theme.color.brandPrimary, marginTop: 8 },
  editText: { color: theme.color.brand, fontWeight: "600" },
  del: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: theme.color.error, marginTop: 8 },
  delText: { color: theme.color.error, fontWeight: "600" },
  cardWrap: { alignItems: "center", marginBottom: 6 },
  ticketActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
    justifyContent: "flex-end",
    marginBottom: 12,
  },
  ticketBtnGhost: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.color.brandPrimary,
  },
  ticketBtnGhostText: { color: theme.color.brand, fontWeight: "700", fontSize: 12 },
  ticketBtnShare: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#25D366",
  },
  ticketBtnShareText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  lotteryCard: {
    borderWidth: 1,
    borderColor: theme.color.brandPrimary,
    borderRadius: 14,
    padding: 12,
    backgroundColor: theme.color.brandTertiary,
  },
  lotteryPeriod: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.color.brand,
    marginBottom: 10,
    textAlign: "center",
    letterSpacing: 0.3,
  },
  ticketsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "center",
  },
  ticket: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: theme.color.brandPrimary,
  },
  ticketCode: {
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 12,
    fontWeight: "700",
    color: theme.color.brand,
    letterSpacing: 0.5,
  },
  lotteryHint: {
    fontSize: 11,
    color: theme.color.brand,
    marginTop: 10,
    textAlign: "center",
    fontStyle: "italic",
  },
});
