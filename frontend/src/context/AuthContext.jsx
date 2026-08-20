import React, { createContext, useContext, useEffect, useState } from "react";
import { DEMO_USERS } from "../mock/mockData";

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [impersonating, setImpersonating] = useState(null); // {realUser}
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("aox_user");
    const imp = localStorage.getItem("aox_impersonate");
    if (saved) setUser(JSON.parse(saved));
    if (imp) setImpersonating(JSON.parse(imp));
    setLoading(false);
  }, []);

  const login = (username, password) => {
    const found = DEMO_USERS.find(
      (u) => u.username.toLowerCase() === username.toLowerCase() && u.password === password
    );
    if (found) {
      const safe = { ...found, password: undefined };
      setUser(safe);
      localStorage.setItem("aox_user", JSON.stringify(safe));
      return { ok: true, user: safe };
    }
    return { ok: false, error: "Username atau password salah" };
  };

  const logout = () => {
    setUser(null);
    setImpersonating(null);
    localStorage.removeItem("aox_user");
    localStorage.removeItem("aox_impersonate");
  };

  const impersonate = (target) => {
    // simpan user asli lalu ganti ke target
    setImpersonating(user);
    localStorage.setItem("aox_impersonate", JSON.stringify(user));
    const safe = { ...target, password: undefined };
    setUser(safe);
    localStorage.setItem("aox_user", JSON.stringify(safe));
  };

  const stopImpersonate = () => {
    if (impersonating) {
      setUser(impersonating);
      localStorage.setItem("aox_user", JSON.stringify(impersonating));
      setImpersonating(null);
      localStorage.removeItem("aox_impersonate");
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
