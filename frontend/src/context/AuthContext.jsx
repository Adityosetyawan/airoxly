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

const decodeToken = (token) => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (!payload.exp || payload.exp * 1000 < Date.now()) return null;
    return { id: payload.sub, email: payload.email, name: payload.name || payload.email, role: payload.role };
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
      .then((res) => setUser(res.data))
      .catch((err) => {
        if (err.response?.status === 401) {
          localStorage.removeItem("oxly_token");
          setUser(null);
        } else {
          setUser(decodeToken(token));
        }
      });
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    localStorage.setItem("oxly_token", res.data.access_token);
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
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
