import React, { useCallback, useState } from "react";
import {
  FlatList,
  Image,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { theme, rp } from "@/src/theme";
import { api, Customer, Transaction } from "@/src/api";
import { useToast } from "@/src/components/Toast";

type Props = {
  customerId: string;
  onOpenTransaction?: (txnId: string) => void;
  /** Show a "Hapus Pelanggan" danger button. Enabled for admin & superadmin views. */
  canDelete?: boolean;
};

export default function CustomerDetailReadonly({ customerId, onOpenTransaction, canDelete = false }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [c, setC] = useState<Customer | null>(null);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [photoZoom, setPhotoZoom] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [cust, list] = await Promise.all([
        api.getCustomer(customerId),
        api.listTransactions({ customer_id: customerId }),
      ]);
      setC(cust);
      setTxns(list);
    } catch {}
  }, [customerId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleDelete = async () => {
    if (!c || deleting) return;
    setDeleting(true);
    try {
      await api.deleteCustomer(c.id);
      toast.show(`Pelanggan #${c.customer_no} dihapus. Nomor tidak dipakai ulang.`, "success");
      setConfirmDelete(false);
      setTimeout(() => router.back(), 250);
    } catch (e: any) {
      toast.show(e?.message || "Gagal hapus pelanggan", "error");
      setDeleting(false);
    }
  };

  if (!c) {
    return (
      <SafeAreaView style={styles.wrap} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Ionicons name="chevron-back" size={24} color={theme.color.onSurface} />
          </TouchableOpacity>
          <Text style={styles.title}>Detail Pelanggan</Text>
          <View style={{ width: 32 }} />
        </View>
        <Text style={styles.loading}>Memuat…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={theme.color.onSurface} />
        </TouchableOpacity>
        <Text style={styles.title}>Detail Pelanggan</Text>
        <View style={{ width: 32 }} />
      </View>

      <FlatList
        data={txns}
        keyExtractor={(t) => t.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.color.brandPrimary} />
        }
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ListHeaderComponent={
          <>
            <View style={styles.hero}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{c.name[0]?.toUpperCase() || "?"}</Text>
              </View>
              <Text style={styles.name}>{c.name}</Text>
              <Text style={styles.no}>
                #{c.customer_no} · {c.barcode_id}
              </Text>
              {c.sales_code ? (
                <View style={styles.salesPill}>
                  <Ionicons name="person-circle-outline" size={14} color={theme.color.onBrandTertiary} />
                  <Text style={styles.salesPillText}>Sales {c.sales_code}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.kpiRow}>
              <View style={[styles.kpi, { backgroundColor: theme.color.brandTertiary }]}>
                <Text style={styles.kpiLabel}>Hutang</Text>
                <Text
                  style={[
                    styles.kpiValue,
                    { color: c.total_debt > 0 ? theme.color.error : theme.color.onBrandTertiary },
                  ]}
                >
                  Rp {rp(c.total_debt)}
                </Text>
              </View>
              <View style={[styles.kpi, { backgroundColor: theme.color.surfaceSecondary }]}>
                <Text style={styles.kpiLabel}>Pinjam Galon</Text>
                <Text style={styles.kpiValue}>{c.gallon_loans} gln</Text>
              </View>
            </View>

            <View style={styles.grid}>
              <MiniCard label="Total Belanja" value={"Rp " + rp(c.total_purchases || 0)} icon="wallet" />
              <MiniCard label="Jumlah Transaksi" value={String(c.purchase_count || 0)} icon="receipt" />
              <MiniCard
                label="Terakhir Beli"
                value={
                  c.last_purchase_date
                    ? new Date(c.last_purchase_date).toLocaleDateString("id-ID")
                    : "-"
                }
                icon="calendar"
              />
              <MiniCard label="Wilayah" value={c.group_letter || "-"} icon="map" />
            </View>

            {(c.wa_number || c.address) && (
              <View style={styles.info}>
                {c.wa_number ? (
                  <View style={styles.infoRow}>
                    <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                    <Text style={styles.infoText}>{c.wa_number}</Text>
                  </View>
                ) : null}
                {c.address ? (
                  <View style={styles.infoRow}>
                    <Ionicons name="location-outline" size={16} color={theme.color.muted} />
                    <Text style={styles.infoText}>{c.address}</Text>
                  </View>
                ) : null}
                {c.lat != null && c.lng != null ? (
                  <View style={styles.infoRow}>
                    <Ionicons name="pin-outline" size={16} color={theme.color.muted} />
                    <Text style={styles.infoText}>
                      {c.lat.toFixed(5)}, {c.lng.toFixed(5)}
                    </Text>
                  </View>
                ) : null}
              </View>
            )}

            {c.photo_rumah ? (
              <TouchableOpacity
                onPress={() => setPhotoZoom(true)}
                activeOpacity={0.85}
                style={styles.photoCard}
                testID="photo-rumah-view"
              >
                <View style={styles.photoHeader}>
                  <Ionicons name="home" size={14} color={theme.color.brand} />
                  <Text style={styles.photoTitle}>Foto Rumah Pelanggan</Text>
                  <Ionicons name="expand" size={14} color={theme.color.muted} />
                </View>
                <Image source={{ uri: c.photo_rumah }} style={styles.photoRumah} resizeMode="cover" />
              </TouchableOpacity>
            ) : null}

            {canDelete ? (
              <TouchableOpacity
                style={[
                  styles.dangerBtn,
                  ((c?.total_debt ?? 0) > 0 || (c?.gallon_loans ?? 0) > 0) && styles.dangerBtnDisabled,
                ]}
                onPress={() => {
                  if ((c?.total_debt ?? 0) > 0 || (c?.gallon_loans ?? 0) > 0) {
                    const parts: string[] = [];
                    if ((c?.total_debt ?? 0) > 0) parts.push(`hutang Rp ${rp(c!.total_debt)}`);
                    if ((c?.gallon_loans ?? 0) > 0) parts.push(`pinjam ${c!.gallon_loans} galon`);
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
                  name={
                    (c?.total_debt ?? 0) > 0 || (c?.gallon_loans ?? 0) > 0
                      ? "lock-closed-outline"
                      : "trash-outline"
                  }
                  size={18}
                  color={
                    (c?.total_debt ?? 0) > 0 || (c?.gallon_loans ?? 0) > 0
                      ? theme.color.muted
                      : theme.color.error
                  }
                />
                <Text
                  style={[
                    styles.dangerBtnText,
                    ((c?.total_debt ?? 0) > 0 || (c?.gallon_loans ?? 0) > 0) && { color: theme.color.muted },
                  ]}
                >
                  {(c?.total_debt ?? 0) > 0 || (c?.gallon_loans ?? 0) > 0
                    ? "Tidak bisa hapus (masih ada hutang/pinjam galon)"
                    : "Hapus Pelanggan"}
                </Text>
              </TouchableOpacity>
            ) : null}

            <Text style={styles.section}>Riwayat Transaksi ({txns.length})</Text>
          </>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.txnCard}
            disabled={!onOpenTransaction}
            onPress={() => onOpenTransaction?.(item.id)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.txnDate}>
                {new Date(item.date).toLocaleDateString("id-ID", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </Text>
              <Text style={styles.txnItems}>
                {(item.items || [])
                  .map((it) => `${it.qty}× ${it.product_name}`)
                  .join(", ")}
              </Text>
              <View style={styles.txnTags}>
                <View style={[styles.txnTag, { backgroundColor: theme.color.brandTertiary }]}>
                  <Text style={[styles.txnTagText, { color: theme.color.onBrandTertiary }]}>
                    Rp {rp(item.total)}
                  </Text>
                </View>
                {item.hutang_transaksi > 0 && (
                  <View style={[styles.txnTag, { backgroundColor: "#FEE2E2" }]}>
                    <Text style={[styles.txnTagText, { color: theme.color.error }]}>
                      Hutang Rp {rp(item.hutang_transaksi)}
                    </Text>
                  </View>
                )}
                {item.pinjam_galon > 0 && (
                  <View style={[styles.txnTag, { backgroundColor: theme.color.surfaceSecondary }]}>
                    <Text style={[styles.txnTagText, { color: theme.color.onSurfaceSecondary }]}>
                      Pinjam {item.pinjam_galon} gln
                    </Text>
                  </View>
                )}
              </View>
            </View>
            {onOpenTransaction && (
              <Ionicons name="chevron-forward" size={20} color={theme.color.muted} />
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>Belum ada transaksi</Text>
        }
      />

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

function MiniCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: any;
}) {
  return (
    <View style={styles.mini}>
      <Ionicons name={icon} size={18} color={theme.color.brand} />
      <Text style={styles.miniValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.color.surface },
  photoCard: {
    marginTop: 12,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  photoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 8,
    backgroundColor: theme.color.brandTertiary,
  },
  photoTitle: { flex: 1, fontSize: 12, fontWeight: "700", color: theme.color.brand },
  photoRumah: { width: "100%", aspectRatio: 4 / 3, backgroundColor: "#000" },
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
    padding: 16,
  },
  back: { padding: 4, width: 32 },
  title: { fontSize: 18, fontWeight: "600", color: theme.color.onSurface },
  loading: { textAlign: "center", marginTop: 40, color: theme.color.muted },
  hero: { alignItems: "center", marginBottom: 16 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.color.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: { fontSize: 28, fontWeight: "700", color: "#fff" },
  name: { fontSize: 20, fontWeight: "600", color: theme.color.onSurface },
  no: { fontSize: 12, color: theme.color.muted, marginTop: 2 },
  salesPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: theme.color.brandTertiary,
  },
  salesPillText: { fontSize: 11, fontWeight: "600", color: theme.color.onBrandTertiary },
  kpiRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  kpi: { flex: 1, borderRadius: 20, padding: 16 },
  kpiLabel: { fontSize: 11, color: theme.color.onSurfaceSecondary, fontWeight: "500" },
  kpiValue: { fontSize: 18, fontWeight: "600", color: theme.color.onSurface, marginTop: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  mini: {
    width: "48%",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.color.border,
    gap: 2,
  },
  miniValue: { fontSize: 15, fontWeight: "600", color: theme.color.onSurface, marginTop: 4 },
  miniLabel: { fontSize: 11, color: theme.color.muted },
  info: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.color.surfaceSecondary,
    marginBottom: 16,
    gap: 8,
  },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoText: { flex: 1, fontSize: 13, color: theme.color.onSurface },
  section: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 8,
    color: theme.color.onSurface,
  },
  txnCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.color.border,
    marginBottom: 8,
    gap: 8,
  },
  txnDate: { fontSize: 13, fontWeight: "600", color: theme.color.onSurface },
  txnItems: { fontSize: 12, color: theme.color.muted, marginTop: 2 },
  txnTags: { flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" },
  txnTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  txnTagText: { fontSize: 11, fontWeight: "500" },
  empty: { textAlign: "center", color: theme.color.muted, padding: 24 },
  dangerBtn: {
    marginTop: 8,
    marginBottom: 8,
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
  confirmIconWrap: { marginBottom: 12 },
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
  confirmActions: { flexDirection: "row", gap: 10, width: "100%" },
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
