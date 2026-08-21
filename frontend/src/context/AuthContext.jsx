import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "@/lib/api";

const AuthContext = createContext(null);

export const formatApiErrorDetail = (detail) => {
  if (detail == null) return "Terjadi kesalahan. Silakan coba lagi.";
  if (typeof detail === "string")
    return detail.includes("<") ? "Server sedang tidak dapat dihubungi. Coba lagi beberapa saat." : detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
};

const getCachedUser = () => {
  try {
    const raw = localStorage.getItem("oxly_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    const token = localStorage.getItem("oxly_token");
    if (!token) {
      setUser(null);
      return;
    }
    api
      .get("/auth/me")
      .then((res) => {
        localStorage.setItem("oxly_user", JSON.stringify(res.data));
        setUser(res.data);
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          localStorage.removeItem("oxly_token");
          localStorage.removeItem("oxly_user");
          setUser(null);
        } else {
          setUser(getCachedUser());
        }
      });
  }, []);

  const login = useCallback(async (username, password) => {
    const res = await api.post("/auth/login", { username, password });
    localStorage.setItem("oxly_token", res.data.access_token);
    localStorage.setItem("oxly_user", JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch (e) {
      /* sesi lokal tetap dibersihkan */
    }
    localStorage.removeItem("oxly_token");
    localStorage.removeItem("oxly_user");
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
