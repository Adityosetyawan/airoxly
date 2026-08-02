import React, { useState } from "react";
import {
  KeyboardAvoidingView,
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
import { theme } from "@/src/theme";
import { api } from "@/src/api";
import { useToast } from "@/src/components/Toast";

const CATEGORIES = [
  { id: "BBM", icon: "car-outline" },
  { id: "Makan", icon: "fast-food-outline" },
  { id: "Parkir", icon: "cash-outline" },
  { id: "Servis", icon: "construct-outline" },
  { id: "Lain-lain", icon: "ellipsis-horizontal-outline" },
] as const;

export function ExpenseModal({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [category, setCategory] = useState<string>("BBM");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setCategory("BBM");
    setDescription("");
    setAmount("");
  };

  const save = async () => {
    const num = parseFloat(amount);
    if (!num || num <= 0) {
      toast.show("Nominal harus lebih dari 0", "error");
      return;
    }
    setSaving(true);
    try {
      await api.createExpense({ category, description, amount: num });
      toast.show("Pengeluaran tersimpan", "success");
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
            <Text style={styles.title}>Tambah Pengeluaran</Text>
            <TouchableOpacity onPress={onClose} testID="close-expense-modal">
              <Ionicons name="close" size={24} color={theme.color.onSurface} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 500 }}>
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

            <TouchableOpacity
              onPress={save}
              disabled={saving}
              style={[styles.btn, saving && { opacity: 0.6 }]}
              testID="save-expense-btn"
            >
              <Text style={styles.btnText}>{saving ? "Menyimpan…" : "Simpan Pengeluaran"}</Text>
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
});
