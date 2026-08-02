import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { theme } from "@/src/theme";
import { api } from "@/src/api";
import { useToast } from "@/src/components/Toast";

export default function NewCustomer() {
  const params = useLocalSearchParams<{ barcode?: string }>();
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [wa, setWa] = useState("");
  const [address, setAddress] = useState("");
  const [barcode, setBarcode] = useState(params.barcode || "");
  const [loading, setLoading] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      toast.show("Nama harus diisi", "error");
      return;
    }
    setLoading(true);
    try {
      const c = await api.createCustomer({
        name: name.trim(),
        wa_number: wa.trim(),
        address: address.trim(),
        barcode_id: barcode.trim() || undefined,
      });
      toast.show("Pelanggan disimpan", "success");
      router.replace({ pathname: "/(sales)/customer/[id]", params: { id: c.id } });
    } catch (e: any) {
      toast.show(e.message || "Gagal simpan", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.wrap} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} testID="back-btn">
          <Ionicons name="chevron-back" size={24} color={theme.color.onSurface} />
        </TouchableOpacity>
        <Text style={styles.title}>Pelanggan Baru</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Nama *</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Nama pelanggan" placeholderTextColor={theme.color.muted} style={styles.input} testID="name-input" />

          <Text style={styles.label}>No. WhatsApp</Text>
          <TextInput value={wa} onChangeText={setWa} placeholder="08123..." placeholderTextColor={theme.color.muted} keyboardType="phone-pad" style={styles.input} testID="wa-input" />

          <Text style={styles.label}>Alamat</Text>
          <TextInput value={address} onChangeText={setAddress} placeholder="Alamat rumah" placeholderTextColor={theme.color.muted} multiline style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]} testID="address-input" />

          <Text style={styles.label}>Barcode / QR (opsional)</Text>
          <TextInput value={barcode} onChangeText={setBarcode} placeholder="Kosongkan untuk auto-generate" placeholderTextColor={theme.color.muted} style={styles.input} testID="barcode-input" />
          <Text style={styles.hint}>Jika dikosongkan, sistem generate otomatis: [KODE_SALES]-OXLY-[No.urut per sales]</Text>

          <TouchableOpacity onPress={save} disabled={loading} style={[styles.btn, loading && { opacity: 0.6 }]} testID="save-customer-btn">
            <Text style={styles.btnText}>{loading ? "Menyimpan…" : "Simpan Pelanggan"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  label: { fontSize: 13, fontWeight: "500", color: theme.color.onSurfaceSecondary, marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: theme.color.onSurface,
    backgroundColor: theme.color.surfaceSecondary,
  },
  hint: { fontSize: 12, color: theme.color.muted, marginTop: 6 },
  btn: {
    backgroundColor: theme.color.brandPrimary,
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 24,
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
