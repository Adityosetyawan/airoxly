import React, { useState, useEffect } from "react";
import { NavLink, useNavigate, Outlet } from "react-router-dom";
import {
  Droplet, LayoutDashboard, Package, Users, ShoppingCart, BarChart3,
  Wallet, UserCog, MapPin, Warehouse, Factory, Gift, Settings, BookOpen,
  LogOut, Menu, X, ChevronRight,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ROLE_LABELS } from "../mock/mockData";
import { Button } from "./ui/button";
import api from "../api";

const NAV = {
  superadmin: [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/produk", label: "Produk", icon: Package },
    { to: "/pelanggan", label: "Pelanggan", icon: Users },
    { to: "/transaksi", label: "Transaksi", icon: ShoppingCart },
    { to: "/laporan", label: "Laporan", icon: BarChart3 },
    { to: "/pengeluaran", label: "Pengeluaran", icon: Wallet },
    { to: "/peta", label: "Peta Live", icon: MapPin },
    { to: "/gudang", label: "Gudang", icon: Warehouse },
    { to: "/produksi", label: "Produksi", icon: Factory },
    { to: "/undian", label: "Undian", icon: Gift },
    { to: "/user", label: "Kelola User", icon: UserCog },
    { to: "/pengaturan", label: "Pengaturan", icon: Settings },
    { to: "/panduan", label: "Buku Panduan", icon: BookOpen },
  ],
  admin: [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/produk", label: "Produk", icon: Package },
    { to: "/pelanggan", label: "Pelanggan", icon: Users },
    { to: "/transaksi", label: "Transaksi", icon: ShoppingCart },
    { to: "/laporan", label: "Laporan", icon: BarChart3 },
    { to: "/pengeluaran", label: "Pengeluaran", icon: Wallet },
    { to: "/peta", label: "Peta Live", icon: MapPin },
    { to: "/undian", label: "Undian", icon: Gift },
    { to: "/panduan", label: "Buku Panduan", icon: BookOpen },
  ],
  sales: [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/transaksi", label: "Transaksi", icon: ShoppingCart },
    { to: "/pelanggan", label: "Pelanggan", icon: Users },
    { to: "/laporan", label: "Laporan Saya", icon: BarChart3 },
    { to: "/panduan", label: "Buku Panduan", icon: BookOpen },
  ],
  gudang: [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/gudang", label: "Stok Gudang", icon: Warehouse },
    { to: "/panduan", label: "Buku Panduan", icon: BookOpen },
  ],
  produksi: [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/produksi", label: "Produksi", icon: Factory },
    { to: "/panduan", label: "Buku Panduan", icon: BookOpen },
  ],
};

const Layout = () => {
  const { user, logout, impersonating, stopImpersonate } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const items = NAV[user?.role] || [];

  const handleLogout = () => { logout(); navigate("/login"); };

  // Ping GPS untuk peran sales (lokasi asli via browser, jam kerja 08:00-17:00)
  useEffect(() => {
    if (user?.role !== "sales") return;
    const withinWorkingHours = () => {
      const h = new Date().getHours();
      return h >= 8 && h < 17;
    };
    const doPing = () => {
      if (!withinWorkingHours()) return;
      const send = (lat, lng) => api.post("/locations/ping", { lat, lng }).catch(() => {});
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => send(pos.coords.latitude, pos.coords.longitude),
          () => send(-6.2088 + (Math.random() - 0.5) * 0.03, 106.8456 + (Math.random() - 0.5) * 0.03),
          { enableHighAccuracy: true, timeout: 8000 }
        );
      } else {
        send(-6.2088 + (Math.random() - 0.5) * 0.03, 106.8456 + (Math.random() - 0.5) * 0.03);
      }
    };
    doPing();
    const id = setInterval(doPing, 120000); // tiap 120 detik
    return () => clearInterval(id);
  }, [user?.role]);

  const initials = (user?.name || "?").split(" ").map((s) => s[0]).slice(0, 2).join("");

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 h-16 border-b border-border">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-md shadow-emerald-500/30">
          <Droplet className="w-5 h-5 text-white" fill="white" />
        </div>
        <div>
          <p className="font-extrabold leading-tight">Air OXLY</p>
          <p className="text-[11px] text-muted-foreground -mt-0.5">Sistem Penjualan</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {items.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end} onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30"
                  : "text-foreground/70 hover:bg-emerald-50 hover:text-emerald-700"
              }`
            }>
            {({ isActive }) => (
              <>
                <it.icon className="w-[18px] h-[18px]" />
                <span className="flex-1">{it.label}</span>
                {isActive && <ChevronRight className="w-4 h-4 opacity-80" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl">
          <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{user?.name}</p>
            <p className="text-[11px] text-muted-foreground">{ROLE_LABELS[user?.role]}</p>
          </div>
          <button onClick={handleLogout} title="Keluar"
            className="p-2 rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 bg-card border-r border-border z-30">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-card shadow-xl animate-fade-up">
            <SidebarContent />
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-20 h-16 bg-card/80 backdrop-blur border-b border-border flex items-center gap-3 px-4 lg:px-8">
          <button className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-secondary" onClick={() => setOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Terhubung
          </div>
        </header>

        {/* Impersonation banner */}
        {impersonating && (
          <div className="bg-amber-100 border-b border-amber-300 text-amber-900 px-4 lg:px-8 py-2.5 flex items-center justify-between text-sm">
            <span>Anda sedang melihat sebagai <b>{user?.name}</b> ({ROLE_LABELS[user?.role]}).</span>
            <Button size="sm" variant="outline" onClick={() => { stopImpersonate(); navigate("/"); }}
              className="h-8 border-amber-400 text-amber-900 hover:bg-amber-200">
              <X className="w-3.5 h-3.5 mr-1" /> Kembali ke Super Admin
            </Button>
          </div>
        )}

        <main className="p-4 lg:p-8 max-w-7xl mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
