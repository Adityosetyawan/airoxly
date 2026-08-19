import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { theme } from "@/src/theme";
import { api } from "@/src/api";
import { useToast } from "@/src/components/Toast";
import { PhotoCapture } from "@/src/components/PhotoCapture";
import { patchCachedCustomer } from "@/src/utils/offlineStore";

export default function EditCustomer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [wa, setWa] = useState("");
  const [address, setAddress] = useState("");
  const [photoRumah, setPhotoRumah] = useState<string | null>(null);
  const [origPhoto, setOrigPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const c = await api.getCustomer(id!);
        setName(c.name);
        setWa(c.wa_number || "");
        setAddress(c.address || "");
        setPhotoRumah(c.photo_rumah || null);
        setOrigPhoto(c.photo_rumah || null);
      } catch (e: any) {
        toast.show(e.message || "Gagal", "error");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, toast]);

  const save = async () => {
    setSaving(true);
    try {
      const body: any = { name, wa_number: wa, address };
      // Kirim foto hanya kalau ada perubahan
      if (photoRumah !== origPhoto) {
        body.photo_rumah = photoRumah || ""; // "" utk hapus
      }
      await api.updateCustomer(id!, body);
      // Patch cache offline supaya list & detail langsung refresh
      await patchCachedCustomer(id!, {
        name,
        wa_number: wa,
        address,
        ...(photoRumah !== origPhoto ? { photo_rumah: photoRumah || undefined } : {}),
      });
      toast.show("Tersimpan", "success");
      router.back();
    } catch (e: any) {
      toast.show(e.message || "Gagal", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.wrap} edges={["top"]}>
        <Text style={{ textAlign: "center", marginTop: 40, color: theme.color.muted }}>Memuat…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.wrap} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} testID="back-btn">
          <Ionicons name="chevron-back" size={24} color={theme.color.onSurface} />
        </TouchableOpacity>
        <Text style={styles.title}>Edit Pelanggan</Text>
        <View style={{ width: 40 }} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Nama</Text>
          <TextInput value={name} onChangeText={setName} style={styles.input} testID="name-input" />
          <Text style={styles.label}>No. WhatsApp</Text>
          <TextInput value={wa} onChangeText={setWa} keyboardType="phone-pad" style={styles.input} testID="wa-input" />
          <Text style={styles.label}>Alamat</Text>
          <TextInput value={address} onChangeText={setAddress} multiline style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]} testID="address-input" />
          <Text style={styles.label}>Foto Rumah</Text>
          <PhotoCapture
            value={photoRumah}
            onChange={setPhotoRumah}
            label="Foto rumah pelanggan"
            watermark
            testID="photo-rumah-edit"
          />
          <TouchableOpacity onPress={save} disabled={saving} style={[styles.btn, saving && { opacity: 0.6 }]} testID="save-btn">
            <Text style={styles.btnText}>{saving ? "Menyimpan…" : "Simpan"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.color.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.color.border },
  back: { padding: 8 },
  title: { fontSize: 17, fontWeight: "600", color: theme.color.onSurface },
  label: { fontSize: 13, fontWeight: "500", color: theme.color.onSurfaceSecondary, marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: theme.color.border, borderRadius: 12, padding: 14, fontSize: 15, color: theme.color.onSurface, backgroundColor: theme.color.surfaceSecondary },
  btn: { backgroundColor: theme.color.brandPrimary, padding: 16, borderRadius: 14, alignItems: "center", marginTop: 24 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
