import React, { createContext, useContext, useEffect, useState } from "react";
import api from "../api";

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [impersonating, setImpersonating] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("aox_user");
    const imp = localStorage.getItem("aox_impersonate");
    const token = localStorage.getItem("aox_token");
    if (saved && token) setUser(JSON.parse(saved));
    if (imp) setImpersonating(JSON.parse(imp));
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    try {
      const { data } = await api.post("/auth/login", { username, password });
      localStorage.setItem("aox_token", data.access_token);
      localStorage.setItem("aox_user", JSON.stringify(data.user));
      setUser(data.user);
      return { ok: true, user: data.user };
    } catch (e) {
      return { ok: false, error: e?.response?.data?.detail || "Gagal masuk. Coba lagi." };
    }
  };

  const logout = () => {
    setUser(null);
    setImpersonating(null);
    localStorage.removeItem("aox_user");
    localStorage.removeItem("aox_token");
    localStorage.removeItem("aox_impersonate");
    localStorage.removeItem("aox_real_token");
  };

  const impersonate = async (target) => {
    try {
      const { data } = await api.get(`/auth/impersonate/${target.id}`);
      // simpan sesi asli
      setImpersonating(user);
      localStorage.setItem("aox_impersonate", JSON.stringify(user));
      localStorage.setItem("aox_real_token", localStorage.getItem("aox_token"));
      // ganti ke target
      localStorage.setItem("aox_token", data.access_token);
      localStorage.setItem("aox_user", JSON.stringify(data.user));
      setUser(data.user);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e?.response?.data?.detail || "Gagal impersonasi" };
    }
  };

  const stopImpersonate = () => {
    if (impersonating) {
      const realToken = localStorage.getItem("aox_real_token");
      if (realToken) localStorage.setItem("aox_token", realToken);
      localStorage.setItem("aox_user", JSON.stringify(impersonating));
      setUser(impersonating);
      setImpersonating(null);
      localStorage.removeItem("aox_impersonate");
      localStorage.removeItem("aox_real_token");
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, login, logout, loading, impersonate, stopImpersonate, impersonating }}
    >
      {children}
    </AuthContext.Provider>
  );
};
