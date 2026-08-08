import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/AuthContext";
import { LoadingScreen } from "@/src/components/Loading";

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (user.role === "super_admin") {
      router.replace("/(superadmin)/dashboard");
    } else if (user.role === "admin") {
      router.replace("/(admin)/dashboard");
    } else if (user.role === "produksi") {
      router.replace("/(produksi)/dashboard");
    } else if (user.role === "gudang") {
      router.replace("/(gudang)/dashboard");
    } else {
      router.replace("/(sales)/dashboard");
    }
  }, [user, loading, router]);

  return <LoadingScreen />;
}
