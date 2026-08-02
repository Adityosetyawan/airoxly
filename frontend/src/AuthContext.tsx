import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, getSavedUser, User, TOKEN_KEY } from "./api";
import { storage } from "./utils/storage";

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({} as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    setLoading(true);
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
    setLoading(false);
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = async (username: string, password: string) => {
    const r = await api.login(username, password);
    setUser(r.user);
    return r.user;
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
  };

  const refresh = async () => {
    const u = await api.me();
    setUser(u);
  };

  return <Ctx.Provider value={{ user, loading, login, logout, refresh }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
