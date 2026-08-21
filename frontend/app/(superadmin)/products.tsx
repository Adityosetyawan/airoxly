import React, { useCallback, useState } from "react";
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { theme, rp } from "@/src/theme";
import { api, Product, User } from "@/src/api";
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
              {((item.allowed_groups?.length ?? 0) > 0 || (item.allowed_sales?.length ?? 0) > 0) && (
                <View style={styles.accessBadge}>
                  <Ionicons name="lock-closed" size={11} color={theme.color.warning} />
                  <Text style={styles.accessBadgeText}>
                    Khusus{item.allowed_groups && item.allowed_groups.length > 0 ? ` Wilayah ${item.allowed_groups.join("/")}` : ""}
                    {item.allowed_sales && item.allowed_sales.length > 0 ? `${(item.allowed_groups?.length ?? 0) > 0 ? " · " : " "}${item.allowed_sales.join(", ")}` : ""}
                  </Text>
                </View>
              )}
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
  const [allSales, setAllSales] = useState<User[]>([]);
  const [allowedGroups, setAllowedGroups] = useState<string[]>([]);
  const [allowedSales, setAllowedSales] = useState<string[]>([]);

  // Load sales users list once when modal opens.
  React.useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        const users = await api.listUsers({ role: "sales" });
        // Sort by sales_code for consistent display.
        users.sort((a, b) => (a.sales_code || a.username || "").localeCompare(b.sales_code || b.username || ""));
        setAllSales(users);
      } catch { /* ignore */ }
    })();
  }, [visible]);

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
      setAllowedGroups(product.allowed_groups || []);
      setAllowedSales(product.allowed_sales || []);
    } else {
      setName("");
      setUnit("gln");
      setPrice("");
      setOrder("");
      setHideRoles({ sales: false, admin: false, gudang: false, produksi: false });
      setAllowedGroups([]);
      setAllowedSales([]);
    }
  }, [product, visible]);

  const toggleRole = (r: string) => setHideRoles((s) => ({ ...s, [r]: !s[r] }));

  const toggleGroup = (g: string) => setAllowedGroups((arr) => arr.includes(g) ? arr.filter((x) => x !== g) : [...arr, g]);
  const toggleSalesCode = (code: string) => setAllowedSales((arr) => arr.includes(code) ? arr.filter((x) => x !== code) : [...arr, code]);

  // Derive available group letters from loaded sales users (unique, uppercased).
  const availableGroups = React.useMemo(() => {
    const s = new Set<string>();
    for (const u of allSales) {
      const g = (u.group_letter || "").toUpperCase().trim();
      if (g) s.add(g);
    }
    return Array.from(s).sort();
  }, [allSales]);

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
        allowed_groups: allowedGroups.map((g) => g.toUpperCase()),
        allowed_sales: allowedSales.map((s) => s.toUpperCase()),
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
          <ScrollView style={{ maxHeight: 560 }} contentContainerStyle={{ paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
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

          {/* Akses Produk per-Wilayah & per-Sales */}
          <View style={styles.privacyCard}>
            <View style={styles.privacyHeader}>
              <Ionicons name="lock-closed" size={16} color={theme.color.brand} />
              <Text style={styles.privacyTitle}>Akses Produk (Prioritas Wilayah/Sales)</Text>
            </View>
            <Text style={styles.toggleHint}>
              Kosongkan keduanya = terbuka untuk SEMUA sales. Kalau diisi, hanya sales yang cocok dengan{" "}
              <Text style={{ fontWeight: "700" }}>Wilayah</Text> ATAU <Text style={{ fontWeight: "700" }}>Sales</Text>{" "}
              yang bisa melihat & menjual produk ini.
            </Text>

            <Text style={styles.subLabel}>Wilayah (Group Letter)</Text>
            {availableGroups.length === 0 ? (
              <Text style={styles.emptyChip}>Belum ada sales terdaftar</Text>
            ) : (
              <View style={styles.chipsWrap}>
                {availableGroups.map((g) => {
                  const active = allowedGroups.includes(g);
                  return (
                    <TouchableOpacity
                      key={g}
                      onPress={() => toggleGroup(g)}
                      style={[styles.chip, active && styles.chipOn]}
                      testID={`p-group-${g}`}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextOn]}>Wilayah {g}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <Text style={styles.subLabel}>Sales Spesifik</Text>
            {allSales.length === 0 ? (
              <Text style={styles.emptyChip}>Belum ada sales terdaftar</Text>
            ) : (
              <View style={styles.chipsWrap}>
                {allSales.map((u) => {
                  const code = (u.sales_code || u.username || "").toUpperCase();
                  const active = allowedSales.includes(code);
                  return (
                    <TouchableOpacity
                      key={u.id}
                      onPress={() => toggleSalesCode(code)}
                      style={[styles.chip, active && styles.chipOn]}
                      testID={`p-sales-${code}`}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextOn]}>
                        {code}{u.name ? ` · ${u.name}` : ""}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {(allowedGroups.length > 0 || allowedSales.length > 0) && (
              <TouchableOpacity
                onPress={() => { setAllowedGroups([]); setAllowedSales([]); }}
                style={styles.clearBtn}
                testID="clear-access-btn"
              >
                <Ionicons name="close-circle" size={14} color={theme.color.error} />
                <Text style={styles.clearBtnText}>Bersihkan (buka untuk semua)</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity onPress={save} style={styles.saveBtn} testID="save-product-btn">
            <Text style={styles.saveBtnText}>Simpan</Text>
          </TouchableOpacity>
          </ScrollView>
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
  subLabel: { fontSize: 12, fontWeight: "700", color: theme.color.onSurfaceSecondary, marginTop: 10, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: theme.color.border, backgroundColor: "#fff" },
  chipOn: { backgroundColor: theme.color.brandPrimary, borderColor: theme.color.brandPrimary },
  chipText: { fontSize: 12, fontWeight: "600", color: theme.color.onSurface },
  chipTextOn: { color: "#fff" },
  emptyChip: { fontSize: 12, color: theme.color.muted, fontStyle: "italic" },
  clearBtn: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginTop: 10, paddingVertical: 4 },
  clearBtnText: { fontSize: 12, fontWeight: "600", color: theme.color.error },
  accessBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4, alignSelf: "flex-start", backgroundColor: "#FEF3C7", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  accessBadgeText: { fontSize: 11, fontWeight: "600", color: theme.color.warning },
});
