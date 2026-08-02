import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { theme } from "@/src/theme";
import { api, User } from "@/src/api";
import { useAuth } from "@/src/AuthContext";
import { useToast } from "@/src/components/Toast";

export default function SalesForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [wa, setWa] = useState("");
  const [address, setAddress] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [salary, setSalary] = useState("");
  const [commission, setCommission] = useState("");
  const [bonus, setBonus] = useState("");
  const [salesCode, setSalesCode] = useState("");
  const [disabled, setDisabled] = useState(false);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState<User | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const u = (await api.listUsers()).find((x) => x.id === id);
        if (u) {
          setExisting(u);
          setUsername(u.username);
          setName(u.name || "");
          setWa(u.wa_number || "");
          setAddress(u.address || "");
          setYear(String(u.year_joined || ""));
          setSalary(String(u.salary || ""));
          setCommission(String(u.commission || ""));
          setBonus(String(u.bonus || ""));
          setSalesCode(u.sales_code || "");
          setDisabled(!!u.disabled);
        }
      } catch (e: any) {
        toast.show(e.message || "Gagal muat", "error");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, toast]);

  const save = async () => {
    if (!username.trim() || (!id && !password)) {
      toast.show("Username dan password wajib diisi", "error");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        username: username.trim(),
        name,
        wa_number: wa,
        address,
        year_joined: parseInt(year) || null,
        salary: parseFloat(salary) || 0,
        commission: parseFloat(commission) || 0,
        bonus: parseFloat(bonus) || 0,
        sales_code: salesCode.trim().toUpperCase() || undefined,
        group_letter: user?.group_letter,
      };
      if (id) {
        payload.disabled = disabled;
        if (password) payload.password = password;
        await api.updateUser(id, payload);
      } else {
        payload.password = password;
        payload.role = "sales";
        await api.createUser(payload);
      }
      toast.show("Tersimpan", "success");
      router.back();
    } catch (e: any) {
      toast.show(e.message || "Gagal simpan", "error");
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
        <Text style={styles.title}>{id ? "Edit Sales" : "Tambah Sales"}</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <Field label="Kode Sales (mis. A1)" value={salesCode} onChange={(v) => setSalesCode(v.toUpperCase())} testID="salesCode-input" autoCap="characters" />
          <Field label="Username" value={username} onChange={setUsername} testID="username-input" autoCap="none" />
          <Field label={id ? "Password (opsional, kosongkan jika tidak ganti)" : "Password"} value={password} onChange={setPassword} testID="password-input" secure />
          <Field label="Nama Lengkap" value={name} onChange={setName} testID="name-input" />
          <Field label="No. WhatsApp" value={wa} onChange={setWa} testID="wa-input" keyboard="phone-pad" />
          <Field label="Alamat Rumah" value={address} onChange={setAddress} testID="address-input" multiline />
          <Field label="Tahun Masuk Kerja" value={year} onChange={setYear} testID="year-input" keyboard="number-pad" />
          <Field label="Gaji" value={salary} onChange={setSalary} testID="salary-input" keyboard="number-pad" />
          <Field label="Komisi" value={commission} onChange={setCommission} testID="commission-input" keyboard="number-pad" />
          <Field label="Bonus" value={bonus} onChange={setBonus} testID="bonus-input" keyboard="number-pad" />

          {id && (
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Nonaktifkan akun</Text>
              <Switch value={disabled} onValueChange={setDisabled} testID="disabled-switch" />
            </View>
          )}

          <TouchableOpacity onPress={save} disabled={saving} style={[styles.btn, saving && { opacity: 0.6 }]} testID="save-btn">
            <Text style={styles.btnText}>{saving ? "Menyimpan…" : "Simpan"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChange, testID, keyboard, secure, multiline, autoCap }: any) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboard}
        secureTextEntry={secure}
        multiline={multiline}
        autoCapitalize={autoCap || "sentences"}
        placeholderTextColor={theme.color.muted}
        style={[styles.input, multiline && { minHeight: 60, textAlignVertical: "top" }]}
        testID={testID}
      />
    </View>
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
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16 },
  switchLabel: { fontSize: 14, color: theme.color.onSurface },
});
