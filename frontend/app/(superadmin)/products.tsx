import React, { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { theme, rp } from "@/src/theme";
import { api, Product } from "@/src/api";
import { useToast } from "@/src/components/Toast";

export default function SuperProducts() {
  const toast = useToast();
  const [items, setItems] = useState<Product[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.listProducts();
      setItems(r);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const doDelete = async (p: Product) => {
    try {
      await api.deleteProduct(p.id);
      toast.show("Produk dihapus", "success");
      load();
    } catch (e: any) {
      toast.show(e.message || "Gagal", "error");
    }
  };

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Produk & Harga</Text>
        <TouchableOpacity onPress={() => setCreating(true)} style={styles.addBtn} testID="add-product-btn">
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addBtnText}>Baru</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.color.brandPrimary} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.icon}>
              <Ionicons name="water" size={22} color={theme.color.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              {(() => {
                const roles = item.hide_price_roles || [];
                const legacySales = !!item.hide_price && roles.length === 0;
                const effRoles = legacySales ? ["sales"] : roles;
                if (effRoles.length > 0) return null;
                return <Text style={styles.price}>Rp {rp(item.price)} / {item.unit}</Text>;
              })()}
            </View>
            <TouchableOpacity onPress={() => setEditing(item)} style={styles.iconBtn} testID={`edit-product-${item.id}`}>
              <Ionicons name="create-outline" size={20} color={theme.color.brand} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => doDelete(item)} style={styles.iconBtn} testID={`delete-product-${item.id}`}>
              <Ionicons name="trash-outline" size={20} color={theme.color.error} />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Belum ada produk</Text>}
      />

      <ProductEditor
        visible={!!editing || creating}
        product={editing}
        onClose={() => { setEditing(null); setCreating(false); }}
        onSaved={() => { setEditing(null); setCreating(false); load(); }}
      />
    </SafeAreaView>
  );
}

function ProductEditor({ visible, product, onClose, onSaved }: { visible: boolean; product: Product | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("gln");
  const [price, setPrice] = useState("");
  const [order, setOrder] = useState("");
  const [hideRoles, setHideRoles] = useState<Record<string, boolean>>({
    sales: false,
    admin: false,
    gudang: false,
    produksi: false,
  });

  React.useEffect(() => {
    if (product) {
      setName(product.name);
      setUnit(product.unit);
      setPrice(String(product.price));
      setOrder(String(product.order || 0));
      const roles = product.hide_price_roles || [];
      // Legacy fallback: if hide_price=true and roles empty → treat as sales.
      const legacySales = !!product.hide_price && roles.length === 0;
      setHideRoles({
        sales: roles.includes("sales") || legacySales,
        admin: roles.includes("admin"),
        gudang: roles.includes("gudang"),
        produksi: roles.includes("produksi"),
      });
    } else {
      setName("");
      setUnit("gln");
      setPrice("");
      setOrder("");
      setHideRoles({ sales: false, admin: false, gudang: false, produksi: false });
    }
  }, [product, visible]);

  const toggleRole = (r: string) => setHideRoles((s) => ({ ...s, [r]: !s[r] }));

  const save = async () => {
    if (!name.trim()) {
      toast.show("Nama produk wajib", "error");
      return;
    }
    try {
      const roles = Object.entries(hideRoles).filter(([, v]) => v).map(([k]) => k);
      const payload = {
        name,
        unit,
        price: parseFloat(price) || 0,
        order: parseInt(order) || 0,
        hide_price: roles.includes("sales"), // keep legacy in sync
        hide_price_roles: roles,
      };
      if (product) await api.updateProduct(product.id, payload);
      else await api.createProduct(payload);
      toast.show("Tersimpan", "success");
      onSaved();
    } catch (e: any) {
      toast.show(e.message || "Gagal", "error");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{product ? "Edit Produk" : "Produk Baru"}</Text>
            <TouchableOpacity onPress={onClose} testID="close-modal-btn">
              <Ionicons name="close" size={24} color={theme.color.onSurface} />
            </TouchableOpacity>
          </View>
          <Text style={styles.label}>Nama Produk</Text>
          <TextInput value={name} onChangeText={setName} style={styles.input} testID="p-name-input" />
          <Text style={styles.label}>Satuan (gln / box / pcs)</Text>
          <TextInput value={unit} onChangeText={setUnit} style={styles.input} testID="p-unit-input" autoCapitalize="none" />
          <Text style={styles.label}>Harga</Text>
          <TextInput value={price} onChangeText={(v) => setPrice(v.replace(/[^\d.]/g, ""))} keyboardType="number-pad" style={styles.input} testID="p-price-input" />
          <Text style={styles.label}>Urutan</Text>
          <TextInput value={order} onChangeText={setOrder} keyboardType="number-pad" style={styles.input} testID="p-order-input" />

          <View style={styles.privacyCard}>
            <View style={styles.privacyHeader}>
              <Ionicons name="eye-off" size={16} color={theme.color.brand} />
              <Text style={styles.privacyTitle}>Sembunyikan Harga dari Role</Text>
            </View>
            <Text style={styles.toggleHint}>
              Role yang di-centang tidak akan melihat harga produk ini di aplikasinya. Superadmin selalu bisa lihat.
            </Text>
            {[
              { key: "sales", label: "Sales", desc: "Halaman pilih produk saat input transaksi" },
              { key: "admin", label: "Admin", desc: "Dashboard, laporan, dan detail transaksi" },
              { key: "gudang", label: "Gudang", desc: "Jaga-jaga jika kelak ada tampilan harga" },
              { key: "produksi", label: "Produksi", desc: "Jaga-jaga jika kelak ada tampilan harga" },
            ].map((r) => (
              <TouchableOpacity
                key={r.key}
                onPress={() => toggleRole(r.key)}
                style={styles.roleRow}
                testID={`p-hide-${r.key}-switch`}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, hideRoles[r.key] && styles.checkboxOn]}>
                  {hideRoles[r.key] && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.roleLabel}>{r.label}</Text>
                  <Text style={styles.roleDesc}>{r.desc}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity onPress={save} style={styles.saveBtn} testID="save-product-btn">
            <Text style={styles.saveBtnText}>Simpan</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.color.surface },
  header: { flexDirection: "row", padding: 16, alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 22, fontWeight: "600", color: theme.color.onSurface },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: theme.color.brandPrimary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  addBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: theme.color.border, marginBottom: 8 },
  icon: { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.color.brandTertiary, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 15, fontWeight: "500", color: theme.color.onSurface },
  price: { fontSize: 13, color: theme.color.brand, fontWeight: "600", marginTop: 2 },
  iconBtn: { padding: 8 },
  empty: { textAlign: "center", color: theme.color.muted, padding: 40 },
  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: theme.color.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  modalTitle: { fontSize: 17, fontWeight: "600", color: theme.color.onSurface },
  label: { fontSize: 13, fontWeight: "500", color: theme.color.onSurfaceSecondary, marginBottom: 6, marginTop: 10 },
  input: { borderWidth: 1, borderColor: theme.color.border, borderRadius: 12, padding: 14, fontSize: 15, color: theme.color.onSurface, backgroundColor: theme.color.surfaceSecondary },
  saveBtn: { backgroundColor: theme.color.brandPrimary, padding: 16, borderRadius: 14, alignItems: "center", marginTop: 20 },
  saveBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border },
  toggleTitle: { fontSize: 14, fontWeight: "600", color: theme.color.onSurface },
  toggleHint: { fontSize: 12, color: theme.color.muted, marginTop: 2, marginBottom: 8 },
  hiddenBadgeRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  hiddenBadge: { fontSize: 12, color: theme.color.muted, fontStyle: "italic" },
  privacyCard: { marginTop: 16, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.color.border, backgroundColor: theme.color.surfaceSecondary },
  privacyHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  privacyTitle: { fontSize: 14, fontWeight: "700", color: theme.color.onSurface },
  roleRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.color.border },
  roleLabel: { fontSize: 14, fontWeight: "600", color: theme.color.onSurface },
  roleDesc: { fontSize: 11, color: theme.color.muted, marginTop: 1 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: theme.color.border, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  checkboxOn: { backgroundColor: theme.color.brandPrimary, borderColor: theme.color.brandPrimary },
});
