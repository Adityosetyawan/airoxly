import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { View } from "react-native";
import * as Location from "expo-location";
import { useAuth } from "@/src/AuthContext";
import { theme } from "@/src/theme";
import { api } from "@/src/api";
import OfflineBanner from "@/src/components/OfflineBanner";
import { useOnlineStatus } from "@/src/hooks/useOnlineStatus";
import { cacheCustomers, cacheProducts } from "@/src/utils/offlineStore";
import { syncPendingTransactions } from "@/src/utils/offlineSync";

// Jakarta local time working window for GPS ping (mirror of backend).
const GPS_START_HOUR = 8;
const GPS_END_HOUR = 17;

function isWithinWorkingHours(): boolean {
  // Use device local time. Sales devices are used in Indonesia (WIB / UTC+7)
  // so local hour matches Jakarta hour.
  const h = new Date().getHours();
  return h >= GPS_START_HOUR && h < GPS_END_HOUR;
}

export default function SalesLayout() {
  const { user, loading } = useAuth();
  const online = useOnlineStatus();

  // Background GPS ping every 120s — ONLY during 08:00–17:00 (mirror of backend guard).
  // Interval 120s (bukan 60s) untuk hemat bandwidth + kurangi beban server ~50%.
  useEffect(() => {
    if (!user || user.role !== "sales") return;
    let cancelled = false;
    const ping = async () => {
      if (!isWithinWorkingHours()) return; // silently skip outside jam kerja
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== "granted") return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        await api.pingLocation(loc.coords.latitude, loc.coords.longitude);
      } catch {}
    };
    ping();
    const i = setInterval(ping, 120000);
    return () => {
      cancelled = true;
      clearInterval(i);
    };
  }, [user]);

  // Refresh offline cache whenever we're online (initial load + reconnect).
  useEffect(() => {
    if (!user || user.role !== "sales") return;
    if (!online) return;
    let cancelled = false;
    (async () => {
      try {
        const [customers, products] = await Promise.all([
          api.listCustomers({ sort: "no" }),
          api.listProducts(),
        ]);
        if (cancelled) return;
        await cacheCustomers(customers);
        await cacheProducts(products);
      } catch {
        // Non-fatal — stale cache remains usable.
      }
    })();
    // Also flush any queued transactions on reconnect.
    syncPendingTransactions().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user, online]);

  if (loading) return null;
  if (!user) return <Redirect href="/login" />;
  if (user.role !== "sales") {
    const target =
      user.role === "super_admin" ? "/(superadmin)/dashboard"
      : user.role === "admin" ? "/(admin)/dashboard"
      : user.role === "gudang" ? "/(gudang)/dashboard"
      : user.role === "produksi" ? "/(produksi)/dashboard"
      : "/";
    return <Redirect href={target as any} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.surface }}>
      <OfflineBanner />
      <View style={{ flex: 1 }}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: theme.color.brandPrimary,
            tabBarInactiveTintColor: theme.color.muted,
            tabBarStyle: {
              backgroundColor: theme.color.surface,
              borderTopColor: theme.color.border,
            },
            tabBarLabelStyle: { fontSize: 11, fontWeight: "500" },
          }}
        >
          <Tabs.Screen
            name="dashboard"
            options={{
              title: "Beranda",
              tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
            }}
          />
          <Tabs.Screen
            name="customers"
            options={{
              title: "Pelanggan",
              tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
            }}
          />
          <Tabs.Screen
            name="scan"
            options={{
              title: "Scan / Baru",
              tabBarIcon: ({ color, size }) => <Ionicons name="scan-outline" size={size} color={color} />,
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              title: "Profil",
              tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
            }}
          />
          <Tabs.Screen name="customer/new" options={{ href: null }} />
          <Tabs.Screen name="customer/[id]" options={{ href: null }} />
          <Tabs.Screen name="customer/edit" options={{ href: null }} />
          <Tabs.Screen name="transaction/new" options={{ href: null }} />
          <Tabs.Screen name="transaction/[id]" options={{ href: null }} />
          <Tabs.Screen name="winners" options={{ href: null }} />
          <Tabs.Screen name="reminders" options={{ href: null }} />
        </Tabs>
      </View>
    </View>
  );
}
