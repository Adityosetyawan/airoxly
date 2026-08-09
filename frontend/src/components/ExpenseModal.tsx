import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { theme } from "@/src/theme";
import { api, Expense } from "@/src/api";
import { useToast } from "@/src/components/Toast";

const CATEGORIES = [
  { id: "BBM", icon: "car-outline" },
  { id: "Servis", icon: "construct-outline" },
  { id: "Makan", icon: "restaurant-outline" },
  { id: "Parkir", icon: "cash-outline" },
  { id: "Lain-lain", icon: "ellipsis-horizontal-outline" },
] as const;

export function ExpenseModal({
  visible,
  onClose,
  onSaved,
  expense,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  expense?: Expense | null; // if provided, edit mode
}) {
  const toast = useToast();
  const isEdit = !!expense;
  const [category, setCategory] = useState<string>("BBM");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [photo, setPhoto] = useState<string | null>(null); // data URI or "" cleared
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setCategory("BBM");
    setDescription("");
    setAmount("");
    setPhoto(null);
  };

  useEffect(() => {
    if (visible) {
      if (expense) {
        setCategory(expense.category || "BBM");
        setDescription(expense.description || "");
        setAmount(String(Math.round(expense.amount || 0)));
        setPhoto(expense.photo_base64 || null);
      } else {
        reset();
      }
    }
  }, [visible, expense]);

  const pickPhoto = async (from: "camera" | "gallery") => {
    try {
      let perm;
      if (from === "camera") {
        perm = await ImagePicker.getCameraPermissionsAsync();
        if (!perm.granted) {
          if (!perm.canAskAgain) {
            toast.show("Izin kamera diblokir. Buka Pengaturan.", "error");
            Linking.openSettings().catch(() => {});
            return;
          }
          perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            toast.show("Izin kamera dibutuhkan untuk foto nota", "error");
            return;
          }
        }
      } else {
        perm = await ImagePicker.getMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          if (!perm.canAskAgain) {
            toast.show("Izin galeri diblokir. Buka Pengaturan.", "error");
            Linking.openSettings().catch(() => {});
            return;
          }
          perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) {
            toast.show("Izin galeri dibutuhkan", "error");
            return;
          }
        }
      }
      const opts: ImagePicker.ImagePickerOptions = {
        mediaTypes: "images",
        quality: 0.55,
        base64: true,
        allowsEditing: false,
      };
      const res =
        from === "camera"
          ? await ImagePicker.launchCameraAsync(opts)
          : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      if (a.base64) {
        setPhoto(`data:image/jpeg;base64,${a.base64}`);
      } else if (a.uri) {
        setPhoto(a.uri);
      }
    } catch (e: any) {
      toast.show(e.message || "Gagal ambil foto", "error");
    }
  };

  const save = async () => {
    const num = parseFloat(amount);
    if (!num || num <= 0) {
      toast.show("Nominal harus lebih dari 0", "error");
      return;
    }
    setSaving(true);
    try {
      if (isEdit && expense) {
        const patch: any = {
          category,
          description,
          amount: num,
        };
        // photo state semantics:
        //   null   → user hasn't touched or the original had no photo → don't send
        //   "…"    → new / kept photo → send full payload
        //   ""     → user removed → send "" to clear on backend
        if (photo === "") {
          patch.photo_base64 = "";
        } else if (photo && photo !== (expense.photo_base64 || null)) {
          patch.photo_base64 = photo;
        }
        await api.updateExpense(expense.id, patch);
        toast.show("Pengeluaran diperbarui", "success");
      } else {
        await api.createExpense({
          category,
          description,
          amount: num,
          photo_base64: photo || undefined,
        });
        toast.show("Pengeluaran tersimpan", "success");
      }
      reset();
      onSaved();
    } catch (e: any) {
      toast.show(e.message || "Gagal simpan", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.wrap}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{isEdit ? "Edit Pengeluaran" : "Tambah Pengeluaran"}</Text>
            <TouchableOpacity onPress={onClose} testID="close-expense-modal">
              <Ionicons name="close" size={24} color={theme.color.onSurface} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 560 }}>
            <Text style={styles.label}>Foto Nota (opsional)</Text>
            {photo ? (
              <View style={styles.photoBox}>
                <Image source={{ uri: photo }} style={styles.photo} resizeMode="cover" />
                <View style={styles.photoActions}>
                  <TouchableOpacity onPress={() => pickPhoto("camera")} style={styles.photoBtn} testID="expense-retake-btn">
                    <Ionicons name="camera" size={14} color="#fff" />
                    <Text style={styles.photoBtnText}>Foto Ulang</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setPhoto("")} style={[styles.photoBtn, { backgroundColor: theme.color.error }]} testID="expense-remove-photo-btn">
                    <Ionicons name="trash" size={14} color="#fff" />
                    <Text style={styles.photoBtnText}>Hapus</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.pickerRow}>
                <TouchableOpacity onPress={() => pickPhoto("camera")} style={styles.pickerBtn} testID="expense-camera-btn">
                  <Ionicons name="camera" size={22} color={theme.color.brand} />
                  <Text style={styles.pickerText}>Kamera</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => pickPhoto("gallery")} style={styles.pickerBtn} testID="expense-gallery-btn">
                  <Ionicons name="images" size={22} color={theme.color.brand} />
                  <Text style={styles.pickerText}>Galeri</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.label}>Kategori</Text>
            <View style={styles.catRow}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setCategory(c.id)}
                  style={[styles.catChip, category === c.id && styles.catChipActive]}
                  testID={`expense-cat-${c.id}`}
                >
                  <Ionicons
                    name={c.icon as any}
                    size={16}
                    color={category === c.id ? "#fff" : theme.color.onSurfaceSecondary}
                  />
                  <Text style={[styles.catText, category === c.id && styles.catTextActive]}>{c.id}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Keterangan (opsional)</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="mis. Isi Pertamax 5 liter"
              placeholderTextColor={theme.color.muted}
              style={styles.input}
              testID="expense-desc-input"
            />

            <Text style={styles.label}>Nominal (Rp)</Text>
            <TextInput
              value={amount}
              onChangeText={(v) => setAmount(v.replace(/[^\d]/g, ""))}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={theme.color.muted}
              style={[styles.input, { fontSize: 18, fontWeight: "600" }]}
              testID="expense-amount-input"
            />

            {isEdit && expense?.edit_count ? (
              <Text style={styles.editCount}>
                <Ionicons name="information-circle-outline" size={12} /> Sudah diedit {expense.edit_count}× — nominal tercatat pada laporan bulanan.
              </Text>
            ) : null}

            <TouchableOpacity
              onPress={save}
              disabled={saving}
              style={[styles.btn, saving && { opacity: 0.6 }]}
              testID="save-expense-btn"
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>{isEdit ? "Simpan Perubahan" : "Simpan Pengeluaran"}</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  card: { backgroundColor: theme.color.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { fontSize: 18, fontWeight: "600", color: theme.color.onSurface },
  label: { fontSize: 13, fontWeight: "500", color: theme.color.onSurfaceSecondary, marginBottom: 6, marginTop: 10 },
  catRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: theme.color.surfaceSecondary,
  },
  catChipActive: { backgroundColor: theme.color.brandPrimary },
  catText: { fontSize: 13, color: theme.color.onSurfaceSecondary, fontWeight: "500" },
  catTextActive: { color: "#fff" },
  input: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: theme.color.onSurface,
    backgroundColor: theme.color.surfaceSecondary,
  },
  btn: {
    backgroundColor: theme.color.brandPrimary,
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 20,
  },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  pickerRow: { flexDirection: "row", gap: 12 },
  pickerBtn: {
    flex: 1,
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.color.brandPrimary,
    alignItems: "center",
    gap: 8,
    backgroundColor: theme.color.brandTertiary,
  },
  pickerText: { color: theme.color.onBrandTertiary, fontSize: 13, fontWeight: "600" },
  photoBox: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surfaceSecondary,
  },
  photo: { width: "100%", height: 220 },
  photoActions: { flexDirection: "row", gap: 8, padding: 8, backgroundColor: theme.color.surface },
  photoBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: theme.color.brandPrimary,
  },
  photoBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  editCount: { marginTop: 8, fontSize: 11, color: theme.color.muted, fontStyle: "italic" },
});
