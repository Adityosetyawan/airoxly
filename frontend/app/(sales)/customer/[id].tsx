import React, { useCallback, useEffect, useRef, useState } from "react";
import { Image, Modal, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import ViewShot from "react-native-view-shot";
import * as Location from "expo-location";
import { theme, rp } from "@/src/theme";
import { api, Customer, Transaction } from "@/src/api";
import { useToast } from "@/src/components/Toast";
import { saveShot, shareShot } from "@/src/utils/capture";
import { getCachedCustomer, patchCachedCustomer } from "@/src/utils/offlineStore";

export default function CustomerDetail() {
  const params = useLocalSearchParams<{ id: string; action?: string }>();
  const router = useRouter();
  const toast = useToast();
  const [c, setC] = useState<Customer | null>(null);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [qrBusy, setQrBusy] = useState<null | "share" | "save">(null);
  const [locBusy, setLocBusy] = useState(false);
  const [photoZoom, setPhotoZoom] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const qrShotRef = useRef<ViewShot>(null);

  const load = useCallback(async () => {
    // Pending (offline-created) customers only exist in the local cache —
    // don't waste a network request on them.
    if (params.id && params.id.startsWith("local-")) {
      const cached = await getCachedCustomer(params.id);
      if (cached) {
        setC(cached);
        setTxns([]);
      } else {
        // Cache stub disappeared — most likely the sync already promoted this
        // customer to a real server record. Bounce back to the list so the
        // user picks up the freshly-synced customer_no.
        toast.show("Pelanggan sudah tersinkron — silakan buka dari daftar", "success");
        setTimeout(() => router.replace("/(sales)/customers"), 400);
      }
      return;
    }
    try {
      const [cust, list] = await Promise.all([
        api.getCustomer(params.id!),
        api.listTransactions({ customer_id: params.id }),
      ]);
      setC(cust);
      setTxns(list);
    } catch (e: any) {
      // Offline fallback — show cached customer info; transaction history
      // stays empty until we're online again.
      const cached = await getCachedCustomer(params.id!);
      if (cached) {
        setC(cached);
        setTxns([]);
      } else {
        toast.show(e.message || "Gagal muat data", "error");
      }
    }
  }, [params.id, toast, router]);

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

  const captureFilename = () => `OXLY-QR-${c?.barcode_id || "customer"}`;

  const shareQR = async () => {
    if (!c) return;
    setQrBusy("share");
    try {
      await shareShot(qrShotRef, "oxly-qr-shot", captureFilename(), `QR Pelanggan ${c.name}`);
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
      await saveShot(qrShotRef, "oxly-qr-shot", captureFilename());
      toast.show(
        Platform.OS === "web" ? "QR berhasil diunduh" : "QR tersimpan di galeri",
        "success",
      );
    } catch (e: any) {
      toast.show(e?.message || "Gagal simpan QR", "error");
    } finally {
      setQrBusy(null);
    }
  };

  const setLocation = async () => {
    if (!c) return;
    setLocBusy(true);
    try {
      let perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted) {
        if (!perm.canAskAgain) {
          toast.show("Izin lokasi ditolak. Buka Settings untuk aktifkan.", "error");
          return;
        }
        perm = await Location.requestForegroundPermissionsAsync();
        if (!perm.granted) {
          toast.show("Izin lokasi diperlukan untuk simpan titik pelanggan", "error");
          return;
        }
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const updated = await api.updateCustomer(c.id, {
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      });
      setC(updated);
      // Update cache offline juga supaya perubahan langsung terlihat
      // walau offline / setelah re-focus screen
      await patchCachedCustomer(c.id, {
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      });
      toast.show("Lokasi pelanggan tersimpan", "success");
    } catch (e: any) {
      toast.show(e?.message || "Gagal ambil lokasi", "error");
    } finally {
      setLocBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!c || deleting) return;
    setDeleting(true);
    try {
      await api.deleteCustomer(c.id);
      toast.show(`Pelanggan #${c.customer_no} dihapus. Nomor tidak dipakai ulang.`, "success");
      setConfirmDelete(false);
      // Slight delay so toast animates in before nav pop
      setTimeout(() => router.back(), 250);
    } catch (e: any) {
      toast.show(e?.message || "Gagal hapus pelanggan", "error");
      setDeleting(false);
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
          <Text style={styles.no}>
            {c.id.startsWith("local-") ? "Belum sinkron — nomor akan otomatis dibuat" : `#${c.customer_no} · ${c.barcode_id}`}
          </Text>
        </View>

        {c.id.startsWith("local-") && (
          <View style={styles.pendingBanner}>
            <Ionicons name="cloud-offline" size={18} color="#92400E" />
            <View style={{ flex: 1 }}>
              <Text style={styles.pendingTitle}>Pelanggan pending sync</Text>
              <Text style={styles.pendingSub}>
                Data disimpan lokal. Nomor pelanggan resmi akan dibuat otomatis begitu online.
                Anda tetap bisa input transaksi — akan tersinkron bersamaan.
              </Text>
            </View>
          </View>
        )}

        {showQR && (
          <View style={styles.qrWrap}>
          <View nativeID="oxly-qr-shot">
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
          </View>
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
          <Row
            label="Titik Lokasi"
            value={
              c.lat != null && c.lng != null
                ? `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`
                : "Belum diset"
            }
          />
          <Row label="Total belanja" value={"Rp " + rp(c.total_purchases || 0)} />
          <Row label="Jumlah transaksi" value={String(c.purchase_count || 0) + "×"} />
          <Row label="Terakhir beli" value={c.last_purchase_date ? new Date(c.last_purchase_date).toLocaleString("id-ID") : "Belum pernah"} />
        </View>

        {c.photo_rumah ? (
          <View style={styles.photoCard}>
            <View style={styles.photoHeader}>
              <Ionicons name="home" size={16} color={theme.color.brand} />
              <Text style={styles.photoTitle}>Foto Rumah Pelanggan</Text>
            </View>
            <TouchableOpacity onPress={() => setPhotoZoom(true)} activeOpacity={0.8} testID="open-photo-rumah">
              <Image
                source={{ uri: c.photo_rumah }}
                style={styles.photoRumah}
                resizeMode="cover"
              />
              <View style={styles.zoomHint}>
                <Ionicons name="expand" size={14} color="#fff" />
                <Text style={styles.zoomHintText}>Tap untuk perbesar</Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : null}

        <TouchableOpacity
          onPress={setLocation}
          disabled={locBusy}
          style={[styles.locBtn, locBusy && { opacity: 0.6 }]}
          testID="set-location-btn"
        >
          <Ionicons
            name={c.lat != null ? "refresh-outline" : "location-outline"}
            size={18}
            color={theme.color.brand}
          />
          <Text style={styles.locBtnText}>
            {locBusy
              ? "Mengambil GPS…"
              : c.lat != null
              ? "Perbarui Titik Lokasi Pelanggan"
              : "Set Titik Lokasi Pelanggan (GPS)"}
          </Text>
        </TouchableOpacity>

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

        <TouchableOpacity
          style={[
            styles.dangerBtn,
            (c.total_debt > 0 || c.gallon_loans > 0) && styles.dangerBtnDisabled,
          ]}
          onPress={() => {
            if (c.total_debt > 0 || c.gallon_loans > 0) {
              const parts: string[] = [];
              if (c.total_debt > 0) parts.push(`hutang Rp ${rp(c.total_debt)}`);
              if (c.gallon_loans > 0) parts.push(`pinjam ${c.gallon_loans} galon`);
              toast.show(
                `Tidak bisa hapus: masih ada ${parts.join(" & ")}. Selesaikan dulu.`,
                "error",
              );
              return;
            }
            setConfirmDelete(true);
          }}
          testID="delete-customer-btn"
        >
          <Ionicons
            name={c.total_debt > 0 || c.gallon_loans > 0 ? "lock-closed-outline" : "trash-outline"}
            size={18}
            color={c.total_debt > 0 || c.gallon_loans > 0 ? theme.color.muted : theme.color.error}
          />
          <Text
            style={[
              styles.dangerBtnText,
              (c.total_debt > 0 || c.gallon_loans > 0) && { color: theme.color.muted },
            ]}
          >
            {c.total_debt > 0 || c.gallon_loans > 0
              ? "Tidak bisa hapus (masih ada hutang/pinjam galon)"
              : "Hapus Pelanggan"}
          </Text>
        </TouchableOpacity>

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

      {/* Modal zoom Foto Rumah */}
      <Modal visible={photoZoom} transparent animationType="fade" onRequestClose={() => setPhotoZoom(false)}>
        <TouchableOpacity style={styles.zoomOverlay} activeOpacity={1} onPress={() => setPhotoZoom(false)}>
          <View style={styles.zoomHeader}>
            <Text style={styles.zoomHeaderText}>Foto Rumah — {c?.name}</Text>
            <TouchableOpacity onPress={() => setPhotoZoom(false)} style={styles.zoomClose}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
          {c?.photo_rumah ? (
            <Image source={{ uri: c.photo_rumah }} style={styles.zoomImg} resizeMode="contain" />
          ) : null}
        </TouchableOpacity>
      </Modal>

      {/* Modal konfirmasi hapus pelanggan */}
      <Modal
        visible={confirmDelete}
        transparent
        animationType="fade"
        onRequestClose={() => !deleting && setConfirmDelete(false)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <View style={styles.confirmIconWrap}>
              <Ionicons name="alert-circle" size={40} color={theme.color.error} />
            </View>
            <Text style={styles.confirmTitle}>Hapus Pelanggan?</Text>
            <Text style={styles.confirmDesc}>
              Pelanggan <Text style={{ fontWeight: "800" }}>{c.name}</Text> (#{c.customer_no}) akan dihapus permanen.
              {"\n\n"}Riwayat transaksi tetap tersimpan. Nomor pelanggan #{c.customer_no}{" "}
              <Text style={{ fontWeight: "700" }}>tidak akan dipakai ulang</Text>.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancel}
                onPress={() => setConfirmDelete(false)}
                disabled={deleting}
                testID="cancel-delete-btn"
              >
                <Text style={styles.confirmCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmDelete, deleting && { opacity: 0.6 }]}
                onPress={handleDelete}
                disabled={deleting}
                testID="confirm-delete-btn"
              >
                <Ionicons name="trash" size={16} color="#fff" />
                <Text style={styles.confirmDeleteText}>{deleting ? "Menghapus…" : "Ya, Hapus"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  photoCard: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: theme.color.surfaceSecondary,
  },
  photoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 10,
    backgroundColor: theme.color.brandTertiary,
  },
  photoTitle: { fontSize: 13, fontWeight: "700", color: theme.color.brand },
  photoRumah: { width: "100%", aspectRatio: 4 / 3, backgroundColor: "#000" },
  zoomHint: {
    position: "absolute",
    right: 8,
    bottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  zoomHintText: { color: "#fff", fontSize: 10, fontWeight: "600" },
  zoomOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
  },
  zoomHeader: {
    position: "absolute",
    top: 40,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  zoomHeaderText: { color: "#fff", fontSize: 15, fontWeight: "700", flex: 1 },
  zoomClose: { padding: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.15)" },
  zoomImg: { width: "100%", height: "80%" },
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
  pendingBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#F59E0B",
    marginBottom: 12,
  },
  pendingTitle: { fontSize: 13, fontWeight: "700", color: "#92400E" },
  pendingSub: { fontSize: 11, color: "#78350F", marginTop: 2, lineHeight: 15 },
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
  locBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.color.brandPrimary,
    borderStyle: "dashed",
    marginTop: 12,
    backgroundColor: theme.color.brandTertiary,
  },
  locBtnText: { color: theme.color.brand, fontWeight: "600", fontSize: 13 },
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
  dangerBtn: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.color.error,
    backgroundColor: "rgba(239,68,68,0.06)",
  },
  dangerBtnText: { color: theme.color.error, fontWeight: "700", fontSize: 14 },
  dangerBtnDisabled: {
    borderColor: theme.color.border,
    backgroundColor: theme.color.surfaceSecondary,
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  confirmBox: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: theme.color.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
  },
  confirmIconWrap: {
    marginBottom: 12,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.color.onSurface,
    marginBottom: 8,
    textAlign: "center",
  },
  confirmDesc: {
    fontSize: 13,
    color: theme.color.muted,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  confirmActions: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  confirmCancel: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.color.border,
    alignItems: "center",
  },
  confirmCancelText: { color: theme.color.onSurface, fontWeight: "600" },
  confirmDelete: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.color.error,
  },
  confirmDeleteText: { color: "#fff", fontWeight: "700" },
});
