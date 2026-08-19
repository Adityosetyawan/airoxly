import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider, useAuth } from "@/src/AuthContext";
import { ToastProvider } from "@/src/components/Toast";
import PwaInstallHint from "@/src/components/PwaInstallHint";
import ImpersonationBanner from "@/src/components/ImpersonationBanner";


LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();

// Inner shell that reads auth state and keys the Stack by user role.
// Ganti key → force remount seluruh Stack navigator saat role user berubah
// (misal impersonate ke sales → kembali ke super_admin). Ini menyelesaikan
// masalah Stack native cache yang bikin router.replace tidak switch route
// group dengan benar.
function StackShell() {
  const { user } = useAuth();
  const stackKey = user ? `${user.id}-${user.role}` : "guest";
  return <Stack key={stackKey} screenOptions={{ headerShown: false, animation: "fade" }} />;
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <ToastProvider>
            <StackShell />
            <ImpersonationBanner />
            <PwaInstallHint />
          </ToastProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
