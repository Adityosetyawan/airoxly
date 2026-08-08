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
import { api, Role, User } from "@/src/api";
import { useToast } from "@/src/components/Toast";

const ROLES: { id: Role; label: string }[] = [
  { id: "sales", label: "Sales" },
  { id: "admin", label: "Admin" },
  { id: "produksi", label: "Produksi" },
  { id: "gudang", label: "Gudang" },
  { id: "super_admin", label: "Super Admin" },
];

export default function UserForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const toast = useToast();
  const [role, setRole] = useState<Role>("sales");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [wa, setWa] = useState("");
  const [address, setAddress] = useState("");
  const [salesCode, setSalesCode] = useState("");
  const [groupLetter, setGroupLetter] = useState("");
  const [googleEmail, setGoogleEmail] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [salary, setSalary] = useState("");
  const [commission, setCommission] = useState("");
  const [bonus, setBonus] = useState("");
  const [disabled, setDisabled] = useState(false);
  const [kelompok, setKelompok] = useState("");
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const u = (await api.listUsers()).find((x) => x.id === id);
        if (u) {
          setRole(u.role);
          setUsername(u.username);
          setName(u.name || "");
          setWa(u.wa_number || "");
          setAddress(u.address || "");
          setSalesCode(u.sales_code || "");
          setGroupLetter(u.group_letter || "");
          setGoogleEmail(u.google_email || "");
          setYear(String(u.year_joined || ""));
          setSalary(String(u.salary || ""));
          setCommission(String(u.commission || ""));
          setBonus(String(u.bonus || ""));
          setDisabled(!!u.disabled);
          setKelompok((u as any).kelompok || "");
        }
      } catch (e: any) {
        toast.show(e.message || "Gagal", "error");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, toast]);

  const save = async () => {
    if (!username.trim() || (!id && !password)) {
      toast.show("Username & password wajib", "error");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        username: username.trim(),
        name,
        wa_number: wa,
        address,
        role,
        sales_code: salesCode.trim().toUpperCase() || undefined,
        group_letter: groupLetter.trim().toUpperCase() || undefined,
        google_email: googleEmail.trim().toLowerCase() || undefined,
        year_joined: parseInt(year) || null,
        salary: parseFloat(salary) || 0,
        commission: parseFloat(commission) || 0,
        bonus: parseFloat(bonus) || 0,
        kelompok: kelompok.trim() || undefined,
      };
      if (id) {
        payload.disabled = disabled;
        if (password) payload.password = password;
        await api.updateUser(id, payload);
      } else {
        payload.password = password;
        await api.createUser(payload);
      }
      toast.show("Tersimpan", "success");
      router.back();
    } catch (e: any) {
      toast.show(e.message || "Gagal", "error");
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!id) return;
    try {
      await api.deleteUser(id);
      toast.show("User dihapus", "success");
      router.back();
    } catch (e: any) {
      toast.show(e.message || "Gagal", "error");
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
        <Text style={styles.title}>{id ? "Edit User" : "Tambah User"}</Text>
        <View style={{ width: 40 }} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Role</Text>
          <View style={styles.roleRow}>
            {ROLES.map((r) => (
              <TouchableOpacity
                key={r.id}
                onPress={() => setRole(r.id)}
                style={[styles.roleChip, role === r.id && styles.roleChipActive]}
                testID={`role-${r.id}`}
              >
                <Text style={[styles.roleText, role === r.id && styles.roleTextActive]}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Field label="Username" value={username} onChange={setUsername} testID="username-input" autoCap="none" />
          <Field label={id ? "Password (opsional)" : "Password"} value={password} onChange={setPassword} testID="password-input" secure />
          <Field label="Nama Lengkap" value={name} onChange={setName} testID="name-input" />
          <Field label="No. WhatsApp" value={wa} onChange={setWa} testID="wa-input" keyboard="phone-pad" />
          <Field
            label="Email Google (opsional — untuk login dengan Google)"
            value={googleEmail}
            onChange={(v: string) => setGoogleEmail(v.trim())}
            testID="google-email-input"
            keyboard="email-address"
            autoCap="none"
          />
          <Field label="Alamat" value={address} onChange={setAddress} testID="address-input" multiline />

          {role !== "super_admin" && role !== "produksi" && role !== "gudang" && (
            <>
              {role === "sales" ? (
                <Field label="Kode Sales (mis. A1)" value={salesCode} onChange={(v: string) => setSalesCode(v.toUpperCase())} testID="salesCode-input" autoCap="characters" />
              ) : null}
              <Field label="Wilayah (Huruf A-Z)" value={groupLetter} onChange={(v: string) => setGroupLetter(v.toUpperCase().slice(0, 1))} testID="group-input" autoCap="characters" />
            </>
          )}
          {role === "sales" && (
            <>
              <Field label="Tahun Masuk" value={year} onChange={setYear} testID="year-input" keyboard="number-pad" />
              <Field label="Gaji" value={salary} onChange={setSalary} testID="salary-input" keyboard="number-pad" />
              <Field label="Komisi" value={commission} onChange={setCommission} testID="commission-input" keyboard="number-pad" />
              <Field label="Bonus" value={bonus} onChange={setBonus} testID="bonus-input" keyboard="number-pad" />
            </>
          )}

          {(role === "produksi" || role === "gudang") && (
            <Field
              label={role === "produksi" ? "Kelompok Produksi (mis. Kelompok 1)" : "Regu Gudang (mis. Regu A)"}
              value={kelompok}
              onChange={setKelompok}
              testID="kelompok-input"
            />
          )}

          {id && (
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Nonaktifkan</Text>
              <Switch value={disabled} onValueChange={setDisabled} testID="disable-switch" />
            </View>
          )}

          <TouchableOpacity onPress={save} disabled={saving} style={[styles.btn, saving && { opacity: 0.6 }]} testID="save-btn">
            <Text style={styles.btnText}>{saving ? "Menyimpan…" : "Simpan"}</Text>
          </TouchableOpacity>

          {id && (
            <TouchableOpacity onPress={del} style={styles.delBtn} testID="delete-btn">
              <Text style={styles.delText}>Hapus User</Text>
            </TouchableOpacity>
          )}
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
  roleRow: { flexDirection: "row", gap: 8 },
  roleChip: { flex: 1, padding: 10, borderRadius: 999, backgroundColor: theme.color.surfaceSecondary, alignItems: "center" },
  roleChipActive: { backgroundColor: theme.color.brandPrimary },
  roleText: { color: theme.color.onSurfaceSecondary, fontWeight: "500", fontSize: 13 },
  roleTextActive: { color: "#fff" },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16 },
  switchLabel: { fontSize: 14, color: theme.color.onSurface },
  btn: { backgroundColor: theme.color.brandPrimary, padding: 16, borderRadius: 14, alignItems: "center", marginTop: 24 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  delBtn: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: theme.color.error, alignItems: "center", marginTop: 8 },
  delText: { color: theme.color.error, fontWeight: "600" },
});
