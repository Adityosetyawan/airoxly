import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import { api, getSavedUser, User, TOKEN_KEY } from "./api";
import { storage } from "./utils/storage";
import {
  consumeWebSessionIdIfAny,
  extractSessionId,
  startGoogleSignIn,
} from "./googleAuth";

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<User>;
  loginWithGoogle: () => Promise<User | null>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({} as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
  }, [bootstrap]);

  const login = async (username: string, password: string) => {
    const r = await api.login(username, password);
    setUser(r.user);
    return r.user;
  };

  const loginWithGoogle = async (): Promise<User | null> => {
    const r = await startGoogleSignIn();
    if (r?.user) {
      setUser(r.user);
      return r.user;
    }
    return null;
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
  };

  const refresh = async () => {
    const u = await api.me();
    setUser(u);
  };

  return (
    <Ctx.Provider value={{ user, loading, login, loginWithGoogle, logout, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
