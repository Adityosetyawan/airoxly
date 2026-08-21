import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  LayoutDashboard, Users, Package, ShoppingCart, Wallet, Map, UserCog, LogOut, Droplets,
  Warehouse, Factory, Clock, Sparkles,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ROLE_LABELS } from "@/lib/format";

const NAV = [
  { to: "/", label: "Dasbor", icon: LayoutDashboard, roles: ["super_admin", "admin", "sales", "produksi", "gudang"] },
  { to: "/customers", label: "Pelanggan", icon: Users, roles: ["super_admin", "admin", "sales"] },
  { to: "/products", label: "Produk", icon: Package, roles: ["super_admin", "admin"] },
  { to: "/transactions", label: "Transaksi", icon: ShoppingCart, roles: ["super_admin", "admin", "sales"] },
  { to: "/expenses", label: "Pengeluaran", icon: Wallet, roles: ["super_admin", "admin"] },
  { to: "/map", label: "Peta Live", icon: Map, roles: ["super_admin", "admin"] },
  { to: "/users", label: "Pengguna", icon: UserCog, roles: ["super_admin"] },
  { to: "/warehouse", label: "Gudang", icon: Warehouse, roles: ["super_admin", "admin", "gudang"] },
  { to: "/production", label: "Produksi", icon: Factory, roles: ["super_admin", "admin", "produksi"] },
  { to: "/shifts", label: "Shift", icon: Clock, roles: ["super_admin", "admin"] },
];

const UPCOMING = [
  { label: "AI Vision", icon: Sparkles, fase: "Fase 4", roles: ["super_admin"] },
];

const TITLES = {
  "/": "Dasbor Overview",
  "/customers": "Pelanggan",
  "/products": "Produk",
  "/transactions": "Transaksi",
  "/expenses": "Pengeluaran",
  "/map": "Peta Live",
  "/users": "Pengguna & Peran",
  "/warehouse": "Gudang",
  "/production": "Produksi",
  "/shifts": "Shift",
};

const initials = (name = "") =>
  name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    toast.success("Anda telah keluar");
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <aside
        data-testid="admin-sidebar"
        className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-[#0A0A0A] text-white md:flex"
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white">
            <Droplets className="h-5 w-5 text-[#0A0A0A]" />
          </div>
          <div>
            <p className="font-display text-base font-extrabold tracking-tight">Air OXLY</p>
            <p className="text-[10px] font-medium uppercase tracking-widest text-white/50">Admin Console</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-widest text-white/40">Menu</p>
          {NAV.filter((m) => m.roles.includes(user.role)).map((m) => (
            <NavLink
              key={m.to}
              to={m.to}
              end={m.to === "/"}
              data-testid={`sidebar-nav-${m.label.toLowerCase().replace(/\s+/g, "-")}`}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? "bg-white text-[#0A0A0A]" : "text-white/70 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <m.icon className="h-4 w-4" />
              {m.label}
            </NavLink>
          ))}

          {UPCOMING.some((m) => m.roles.includes(user.role)) && (
            <>
              <p className="px-2 pb-2 pt-6 text-[10px] font-semibold uppercase tracking-widest text-white/40">
                Modul Berikutnya
              </p>
              {UPCOMING.filter((m) => m.roles.includes(user.role)).map((m) => (
                <div
                  key={m.label}
                  data-testid={`sidebar-upcoming-${m.label.toLowerCase().replace(/\s+/g, "-")}`}
                  className="flex cursor-not-allowed items-center justify-between rounded-md px-3 py-2 text-sm text-white/35"
                  title={`${m.label} — tersedia di ${m.fase}`}
                >
                  <span className="flex items-center gap-3">
                    <m.icon className="h-4 w-4" />
                    {m.label}
                  </span>
                  <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-medium">{m.fase}</span>
                </div>
              ))}
            </>
          )}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-bold">
              {initials(user.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p data-testid="sidebar-user-name" className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-white/50">{ROLE_LABELS[user.role] || user.role}</p>
            </div>
            <button
              data-testid="sidebar-logout-button"
              onClick={handleLogout}
              title="Keluar"
              className="rounded-md p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="md:ml-60">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[#DEE2E6] bg-white px-4 md:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#0A0A0A] md:hidden">
              <Droplets className="h-4 w-4 text-white" />
            </div>
            <h2 data-testid="topbar-title" className="font-display text-base font-bold tracking-tight text-[#0A0A0A]">
              {TITLES[location.pathname] || "Air OXLY Admin"}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span
              data-testid="topbar-role-badge"
              className="rounded-full border border-[#DEE2E6] bg-white px-2.5 py-0.5 text-xs font-semibold text-[#0A0A0A]"
            >
              {ROLE_LABELS[user.role] || user.role}
            </span>
            <span data-testid="topbar-user-name" className="hidden text-sm font-medium text-gray-700 sm:block">
              {user.name}
            </span>
            <button
              data-testid="topbar-logout-button"
              onClick={handleLogout}
              title="Keluar"
              className="rounded-full border border-[#DEE2E6] p-2 text-gray-600 transition-colors hover:border-[#0A0A0A] hover:text-[#0A0A0A] md:hidden"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
