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
import { useRouter } from "expo-router";
import { theme } from "@/src/theme";
import { useAuth } from "@/src/AuthContext";
import { useToast } from "@/src/components/Toast";

export default function Login() {
  const { login, loginWithGoogle } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gLoading, setGLoading] = useState(false);

  const goHome = (role: string) => {
    if (role === "super_admin") router.replace("/(superadmin)/dashboard");
    else if (role === "admin") router.replace("/(admin)/dashboard");
    else router.replace("/(sales)/dashboard");
  };

  const onSubmit = async () => {
    if (!username.trim() || !password) {
      toast.show("Isi username dan password", "error");
      return;
    }
    setLoading(true);
    try {
      const u = await login(username.trim(), password);
      toast.show(`Selamat datang, ${u.name || u.username}`, "success");
      goHome(u.role);
    } catch (e: any) {
      toast.show(e.message || "Login gagal", "error");
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    setGLoading(true);
    try {
      const u = await loginWithGoogle();
      // On web, control never returns here (page navigated).
      // On native, we get the user back after redirect resolves.
      if (u) {
        toast.show(`Selamat datang, ${u.name || u.username}`, "success");
        goHome(u.role);
      }
    } catch (e: any) {
      toast.show(e.message || "Login Google gagal", "error");
    } finally {
      setGLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.wrap} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoWrap}>
            <View style={styles.logoBadge}>
              <Ionicons name="water" size={48} color="#fff" />
            </View>
            <Text style={styles.brand}>Air OXLY</Text>
            <Text style={styles.tag}>Sistem Penjualan Air Minum</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Masuk</Text>
            <Text style={styles.sub}>Gunakan akun Super Admin / Admin / Sales</Text>

            <Text style={styles.label}>Username</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="mis. superadmin"
              placeholderTextColor={theme.color.muted}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              testID="login-username-input"
            />

            <Text style={styles.label}>Password</Text>
            <View style={styles.pwdRow}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={theme.color.muted}
                secureTextEntry={!showPass}
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                testID="login-password-input"
              />
              <TouchableOpacity
                onPress={() => setShowPass((v) => !v)}
                style={styles.eye}
                testID="toggle-password-visibility"
              >
                <Ionicons
                  name={showPass ? "eye-off-outline" : "eye-outline"}
                  size={22}
                  color={theme.color.muted}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={onSubmit}
              disabled={loading}
              style={[styles.btn, loading && { opacity: 0.6 }]}
              testID="login-submit-button"
            >
              <Text style={styles.btnText}>{loading ? "Memuat…" : "Masuk"}</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>atau</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              onPress={onGoogle}
              disabled={gLoading || loading}
              style={[styles.btnGoogle, (gLoading || loading) && { opacity: 0.6 }]}
              testID="login-google-button"
            >
              <Ionicons name="logo-google" size={18} color="#EA4335" />
              <Text style={styles.btnGoogleText}>
                {gLoading ? "Membuka Google…" : "Masuk dengan Google"}
              </Text>
            </TouchableOpacity>
            <Text style={styles.gHint}>
              Email Google harus sudah terdaftar oleh Super Admin
            </Text>
          </View>

          <View style={styles.hint}>
            <Text style={styles.hintTitle}>Akun Uji Coba</Text>
            <Text style={styles.hintLine}>Super Admin: superadmin / super123</Text>
            <Text style={styles.hintLine}>Admin A: adminA / admin123</Text>
            <Text style={styles.hintLine}>Sales A1: A1 / sales123</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.color.surface },
  scroll: { padding: 24, paddingBottom: 40, flexGrow: 1, justifyContent: "center" },
  logoWrap: { alignItems: "center", marginBottom: 32 },
  logoBadge: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: theme.color.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: theme.color.brandPrimary,
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  brand: { fontSize: 28, fontWeight: "600", color: theme.color.onSurface, letterSpacing: -0.5 },
  tag: { fontSize: 14, color: theme.color.muted, marginTop: 4 },
  card: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
  },
  title: { fontSize: 20, fontWeight: "600", color: theme.color.onSurface },
  sub: { fontSize: 13, color: theme.color.muted, marginTop: 4, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "500", color: theme.color.onSurfaceSecondary, marginBottom: 6, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: theme.color.onSurface,
    backgroundColor: theme.color.surfaceSecondary,
    marginBottom: 4,
  },
  pwdRow: { flexDirection: "row", alignItems: "center", position: "relative" },
  eye: { position: "absolute", right: 12, padding: 8 },
  btn: {
    backgroundColor: theme.color.brandPrimary,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginTop: 20,
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
    gap: 12,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: theme.color.border },
  dividerText: { fontSize: 12, color: theme.color.muted, fontWeight: "500" },
  btnGoogle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: theme.color.surface,
    borderRadius: 14,
    padding: 15,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  btnGoogleText: {
    color: theme.color.onSurface,
    fontSize: 15,
    fontWeight: "600",
  },
  gHint: {
    fontSize: 11,
    color: theme.color.muted,
    marginTop: 8,
    textAlign: "center",
  },
  hint: {
    marginTop: 20,
    padding: 14,
    borderRadius: 12,
    backgroundColor: theme.color.brandTertiary,
  },
  hintTitle: { fontSize: 12, fontWeight: "600", color: theme.color.onBrandTertiary, marginBottom: 4 },
  hintLine: { fontSize: 12, color: theme.color.onBrandTertiary, lineHeight: 18 },
});
