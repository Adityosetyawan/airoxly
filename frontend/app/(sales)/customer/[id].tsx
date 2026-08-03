import React, { useCallback, useEffect, useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import ViewShot, { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import { theme, rp } from "@/src/theme";
import { api, Customer, Transaction } from "@/src/api";
import { useToast } from "@/src/components/Toast";

export default function CustomerDetail() {
  const params = useLocalSearchParams<{ id: string; action?: string }>();
  const router = useRouter();
  const toast = useToast();
  const [c, setC] = useState<Customer | null>(null);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [qrBusy, setQrBusy] = useState<null | "share" | "save">(null);
  const qrShotRef = useRef<ViewShot>(null);

  const load = useCallback(async () => {
    try {
      const [cust, list] = await Promise.all([
        api.getCustomer(params.id!),
        api.listTransactions({ customer_id: params.id }),
      ]);
      setC(cust);
      setTxns(list);
    } catch (e: any) {
      toast.show(e.message || "Gagal muat data", "error");
    }
  }, [params.id, toast]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (params.action === "transact" && c) {
      router.push({ pathname: "/(sales)/transaction/new", params: { customer_id: c.id } });
    }
  }, [params.action, c, router]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const captureQR = async (): Promise<string> => {
    if (!qrShotRef.current) throw new Error("QR belum siap");
    return await captureRef(qrShotRef, {
      format: "png",
      quality: 1,
      result: "tmpfile",
      fileName: `OXLY-QR-${c?.barcode_id || "customer"}`,
    });
  };

  const shareQR = async () => {
    if (!c) return;
    setQrBusy("share");
    try {
      const uri = await captureQR();
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        toast.show("Fitur share tidak tersedia di device ini", "error");
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: `QR Pelanggan ${c.name}`,
      });
    } catch (e: any) {
      toast.show(e?.message || "Gagal share QR", "error");
    } finally {
      setQrBusy(null);
    }
  };

  const saveQR = async () => {
    if (!c) return;
    setQrBusy("save");
    try {
      let perm = await MediaLibrary.getPermissionsAsync();
      if (!perm.granted) {
        if (!perm.canAskAgain) {
          toast.show("Izin galeri ditolak. Buka Settings untuk aktifkan.", "error");
          return;
        }
        perm = await MediaLibrary.requestPermissionsAsync();
        if (!perm.granted) {
          toast.show("Izin galeri diperlukan untuk menyimpan gambar", "error");
          return;
        }
      }
      const uri = await captureQR();
      await MediaLibrary.saveToLibraryAsync(uri);
      toast.show("QR tersimpan di galeri", "success");
    } catch (e: any) {
      toast.show(e?.message || "Gagal simpan QR", "error");
    } finally {
      setQrBusy(null);
    }
  };

  if (!c) {
    return (
      <SafeAreaView style={styles.wrap} edges={["top"]}>
        <Text style={{ textAlign: "center", marginTop: 40, color: theme.color.muted }}>Memuat…</Text>
      </SafeAreaView>
    );
  }

  const last = txns[0];

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} testID="back-btn">
          <Ionicons name="chevron-back" size={24} color={theme.color.onSurface} />
        </TouchableOpacity>
        <Text style={styles.title}>Detail Pelanggan</Text>
        <TouchableOpacity onPress={() => setShowQR((v) => !v)} style={styles.back} testID="show-qr-btn">
          <Ionicons name="qr-code-outline" size={22} color={theme.color.onSurface} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.color.brandPrimary} />}
      >
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{c.name[0]?.toUpperCase() || "?"}</Text>
          </View>
          <Text style={styles.name}>{c.name}</Text>
          <Text style={styles.no}>#{c.customer_no} · {c.barcode_id}</Text>
        </View>

        {showQR && (
          <View style={styles.qrWrap}>
            <ViewShot
              ref={qrShotRef}
              style={styles.qrCard}
              options={{ format: "png", quality: 1 }}
            >
              <Text style={styles.qrStore}>Air OXLY</Text>
              <Text style={styles.qrCustName}>{c.name}</Text>
              <Text style={styles.qrCustNo}>Pelanggan #{c.customer_no}</Text>
              <View style={styles.qrCodeBox}>
                <QRCode value={c.barcode_id} size={200} />
              </View>
              <Text style={styles.qrText}>{c.barcode_id}</Text>
              <Text style={styles.qrHint}>Scan untuk transaksi cepat</Text>
            </ViewShot>
            <View style={styles.qrActions}>
              <TouchableOpacity
                onPress={saveQR}
                disabled={qrBusy !== null}
                style={[styles.qrBtnGhost, qrBusy !== null && { opacity: 0.6 }]}
                testID="save-qr-btn"
              >
                <Ionicons name="download-outline" size={16} color={theme.color.brand} />
                <Text style={styles.qrBtnGhostText}>
                  {qrBusy === "save" ? "Menyimpan…" : "Simpan ke Galeri"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={shareQR}
                disabled={qrBusy !== null}
                style={[styles.qrBtnShare, qrBusy !== null && { opacity: 0.6 }]}
                testID="share-qr-btn"
              >
                <Ionicons name="share-social" size={16} color="#fff" />
                <Text style={styles.qrBtnShareText}>
                  {qrBusy === "share" ? "Menyiapkan…" : "Share"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.kpiRow}>
          <View style={[styles.kpi, { backgroundColor: theme.color.brandTertiary }]}>
            <Text style={styles.kpiLabel}>Hutang</Text>
            <Text style={[styles.kpiValue, { color: c.total_debt > 0 ? theme.color.error : theme.color.onBrandTertiary }]}>
              Rp {rp(c.total_debt)}
            </Text>
          </View>
          <View style={[styles.kpi, { backgroundColor: theme.color.surfaceSecondary }]}>
            <Text style={styles.kpiLabel}>Pinjam Galon</Text>
            <Text style={styles.kpiValue}>{c.gallon_loans} gln</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Row label="Alamat" value={c.address || "-"} />
          <Row label="No. WhatsApp" value={c.wa_number || "-"} />
          <Row label="Total belanja" value={"Rp " + rp(c.total_purchases || 0)} />
          <Row label="Jumlah transaksi" value={String(c.purchase_count || 0) + "×"} />
          <Row label="Terakhir beli" value={c.last_purchase_date ? new Date(c.last_purchase_date).toLocaleString("id-ID") : "Belum pernah"} />
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actMain}
            onPress={() => router.push({ pathname: "/(sales)/transaction/new", params: { customer_id: c.id } })}
            testID="new-txn-btn"
          >
            <Ionicons name="add-circle" size={20} color="#fff" />
            <Text style={styles.actMainText}>Transaksi Baru</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actGhost}
            onPress={() => router.push({ pathname: "/(sales)/customer/edit", params: { id: c.id } })}
            testID="edit-customer-btn"
          >
            <Ionicons name="create-outline" size={18} color={theme.color.brand} />
            <Text style={styles.actGhostText}>Edit</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.section}>Riwayat Transaksi ({txns.length})</Text>
        {txns.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={styles.tx}
            onPress={() => router.push({ pathname: "/(sales)/transaction/[id]", params: { id: t.id } })}
            testID={`tx-${t.id}`}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.txDate}>{new Date(t.date).toLocaleString("id-ID")}</Text>
              <Text style={styles.txMeta}>
                {t.items.reduce((a, b) => a + b.qty, 0)} item · bayar Rp {rp(t.bayar)}
                {t.edited ? " · diedit" : ""}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.txTotal}>Rp {rp(t.total)}</Text>
              {t.hutang_transaksi > 0 && <Text style={styles.txDebt}>Hutang Rp {rp(t.hutang_transaksi)}</Text>}
            </View>
          </TouchableOpacity>
        ))}
        {txns.length === 0 && <Text style={styles.emptyText}>Belum ada transaksi</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={3}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.color.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.color.border,
  },
  back: { padding: 8 },
  title: { fontSize: 17, fontWeight: "600", color: theme.color.onSurface },
  hero: { alignItems: "center", marginBottom: 20 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: theme.color.brandPrimary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 28, fontWeight: "600" },
  name: { fontSize: 20, fontWeight: "600", color: theme.color.onSurface, marginTop: 10 },
  no: { fontSize: 12, color: theme.color.muted, marginTop: 2 },
  qrWrap: { marginBottom: 16 },
  qrCard: {
    alignItems: "center",
    padding: 20,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  qrStore: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.color.brand,
    letterSpacing: 1,
  },
  qrCustName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000",
    marginTop: 6,
    textAlign: "center",
  },
  qrCustNo: { fontSize: 11, color: "#555", marginBottom: 12 },
  qrCodeBox: {
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
  },
  qrText: { fontSize: 14, marginTop: 12, fontWeight: "700", color: "#000", letterSpacing: 0.5 },
  qrHint: { fontSize: 10, color: "#666", marginTop: 4 },
  qrActions: { flexDirection: "row", gap: 8, marginTop: 12, justifyContent: "flex-end" },
  qrBtnGhost: {
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
  qrBtnGhostText: { color: theme.color.brand, fontWeight: "700", fontSize: 12 },
  qrBtnShare: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#25D366",
  },
  qrBtnShareText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  kpiRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  kpi: { flex: 1, borderRadius: 14, padding: 14 },
  kpiLabel: { fontSize: 12, color: theme.color.onSurfaceSecondary },
  kpiValue: { fontSize: 18, fontWeight: "600", marginTop: 4, color: theme.color.onSurface },
  card: { borderWidth: 1, borderColor: theme.color.border, borderRadius: 14 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.color.border,
    gap: 12,
  },
  rowLabel: { fontSize: 13, color: theme.color.muted },
  rowValue: { fontSize: 13, color: theme.color.onSurface, fontWeight: "500", flexShrink: 1, textAlign: "right" },
  actions: { flexDirection: "row", gap: 8, marginTop: 16 },
  actMain: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 14, backgroundColor: theme.color.brandPrimary },
  actMainText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  actGhost: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: theme.color.brandPrimary },
  actGhostText: { color: theme.color.brand, fontWeight: "600" },
  section: { fontSize: 15, fontWeight: "600", marginTop: 24, marginBottom: 8, color: theme.color.onSurface },
  tx: { flexDirection: "row", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.color.border, marginBottom: 8 },
  txDate: { fontSize: 13, fontWeight: "500", color: theme.color.onSurface },
  txMeta: { fontSize: 11, color: theme.color.muted, marginTop: 2 },
  txTotal: { fontSize: 14, fontWeight: "600", color: theme.color.brand },
  txDebt: { fontSize: 11, color: theme.color.error, marginTop: 2 },
  emptyText: { textAlign: "center", color: theme.color.muted, padding: 20, fontSize: 13 },
});
