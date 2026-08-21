import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { api, getSavedUser, User, TOKEN_KEY } from "./api";
import { storage } from "./utils/storage";
import {
  consumeWebSessionIdIfAny,
  extractSessionId,
  startGoogleSignIn,
} from "./googleAuth";

// Helper: navigate to role-specific dashboard.
// Reliable for native Stack: go to root (index.tsx) which routes based on
// user state (that we already updated via setUser). Avoids native Stack
// group-switching bugs that produced blank screens in previous attempts.
function navigateToRoleHome() {
  // Small delay so React finishes propagating the new `user` state before
  // index.tsx reads it (its useEffect depends on `user`).
  setTimeout(() => {
    try {
      router.replace("/");
    } catch {}
  }, 60);
  // Belt-and-braces: fire again after 600ms for stubborn Android Stack cache.
  setTimeout(() => {
    try {
      router.replace("/");
    } catch {}
  }, 600);
}

/**
 * Navigate directly to a role's dashboard by URL. Used for STOP-IMPERSONATION
 * to guarantee we land on the Super Admin dashboard even if index-based
 * routing has stale state.
 */
function navigateToRoleDashboard(role: string | undefined | null) {
  const target =
    role === "super_admin" ? "/(superadmin)/dashboard"
    : role === "admin" ? "/(admin)/dashboard"
    : role === "gudang" ? "/(gudang)/dashboard"
    : role === "produksi" ? "/(produksi)/dashboard"
    : role === "sales" ? "/(sales)/dashboard"
    : "/";
  // Fire multiple times to defeat native Stack caching quirks.
  const fire = () => { try { router.replace(target as any); } catch {} };
  setTimeout(fire, 0);
  setTimeout(fire, 200);
  setTimeout(fire, 700);
}

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<User>;
  loginWithGoogle: () => Promise<User | null>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Impersonate another user (Super Admin only). */
  impersonate: (target_user_id: string) => Promise<User>;
  /** Stop impersonation and restore the original Super Admin session. */
  stopImpersonation: () => Promise<User | null>;
  /** True when the current session is an impersonation of another user. */
  isImpersonating: boolean;
};

const Ctx = createContext<AuthCtx>({} as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isImpersonating, setIsImpersonating] = useState(false);

  const refreshImpersonationFlag = useCallback(async () => {
    setIsImpersonating(await api.isImpersonating());
  }, []);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    try {
      // 1) Web: if we came back from Emergent redirect with #session_id=…,
      //    process it FIRST to avoid a race with a stale saved token.
      if (Platform.OS === "web") {
        try {
          const r = await consumeWebSessionIdIfAny();
          if (r?.user) {
            setUser(r.user);
            return;
          }
        } catch {
          // Failed exchange — continue to normal bootstrap path.
        }
      } else {
        // 2) Native: cold-start deep link may carry ?session_id=…
        try {
          const initial = await Linking.getInitialURL();
          const sid = extractSessionId(initial);
          if (sid) {
            const r = await api.googleSession(sid);
            setUser(r.user);
            return;
          }
        } catch {}
      }

      // 3) Otherwise: use stored token if present
      const token = await storage.secureGet<string>(TOKEN_KEY, "");
      const saved = await getSavedUser();
      if (saved && token) {
        setUser(saved);
        // Refresh in background
        api.me().then(setUser).catch(async () => {
          await api.logout();
          setUser(null);
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
    refreshImpersonationFlag();
  }, [bootstrap, refreshImpersonationFlag]);

  const login = async (username: string, password: string) => {
    const r = await api.login(username, password);
    setUser(r.user);
    // Fresh login clears any leftover impersonation backup.
    await storage.removeItem("oxly.impersonation_backup_token");
    await storage.removeItem("oxly.impersonation_backup_user");
    setIsImpersonating(false);
    return r.user;
  };

  const loginWithGoogle = async (): Promise<User | null> => {
    const r = await startGoogleSignIn();
    if (r?.user) {
      setUser(r.user);
      await storage.removeItem("oxly.impersonation_backup_token");
      await storage.removeItem("oxly.impersonation_backup_user");
      setIsImpersonating(false);
      return r.user;
    }
    return null;
  };

  const logout = async () => {
    await api.logout();
    await storage.removeItem("oxly.impersonation_backup_token");
    await storage.removeItem("oxly.impersonation_backup_user");
    try {
      const { purgeOfflineStore } = await import("@/src/utils/offlineStore");
      await purgeOfflineStore();
    } catch {}
    setIsImpersonating(false);
    setUser(null);
  };

  const refresh = async () => {
    const u = await api.me();
    setUser(u);
  };

  const impersonate = async (target_user_id: string) => {
    const r = await api.impersonate(target_user_id);
    setUser(r.user);
    setIsImpersonating(true);
    // Route via / (index) which reads updated user state and picks correct dashboard
    navigateToRoleHome();
    return r.user;
  };

  const stopImpersonation = async () => {
    const orig = await api.stopImpersonation();
    // Update React state FIRST so any dependent screens re-render with the
    // restored Super Admin identity before we navigate.
    if (orig) setUser(orig);
    setIsImpersonating(false);
    // Clear any cached data that belonged to the impersonated user (best-effort).
    try {
      const { purgeOfflineStore } = await import("@/src/utils/offlineStore");
      await purgeOfflineStore();
    } catch {}
    // Go DIRECTLY to the restored user's dashboard (default: super_admin).
    navigateToRoleDashboard(orig?.role || "super_admin");
    return orig;
  };

  return (
    <Ctx.Provider
      value={{
        user,
        loading,
        login,
        loginWithGoogle,
        logout,
        refresh,
        impersonate,
        stopImpersonation,
        isImpersonating,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
