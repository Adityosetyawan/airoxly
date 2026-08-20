import { useEffect } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Toaster } from "./components/ui/toaster";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Customers from "./pages/Customers";
import Transactions from "./pages/Transactions";
import Reports from "./pages/Reports";
import Expenses from "./pages/Expenses";
import Users from "./pages/Users";
import LiveMap from "./pages/LiveMap";
import WarehousePage from "./pages/Warehouse";
import Production from "./pages/Production";
import Lottery from "./pages/Lottery";
import Settings from "./pages/Settings";
import Guide from "./pages/Guide";

const ROLE_ACCESS = {
  superadmin: ["produk", "pelanggan", "transaksi", "laporan", "pengeluaran", "peta", "gudang", "produksi", "undian", "user", "pengaturan", "panduan"],
  admin: ["produk", "pelanggan", "transaksi", "laporan", "pengeluaran", "peta", "undian", "panduan"],
  sales: ["transaksi", "pelanggan", "laporan", "panduan"],
  gudang: ["gudang", "panduan"],
  produksi: ["produksi", "panduan"],
};

const Protected = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Memuat...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

const Guard = ({ page, children }) => {
  const { user } = useAuth();
  const location = useLocation();
  const allowed = ROLE_ACCESS[user?.role] || [];
  if (!allowed.includes(page)) return <Navigate to="/" replace state={{ from: location }} />;
  return children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Protected><Layout /></Protected>}>
        <Route index element={<Dashboard />} />
        <Route path="produk" element={<Guard page="produk"><Products /></Guard>} />
        <Route path="pelanggan" element={<Guard page="pelanggan"><Customers /></Guard>} />
        <Route path="transaksi" element={<Guard page="transaksi"><Transactions /></Guard>} />
        <Route path="laporan" element={<Guard page="laporan"><Reports /></Guard>} />
        <Route path="pengeluaran" element={<Guard page="pengeluaran"><Expenses /></Guard>} />
        <Route path="peta" element={<Guard page="peta"><LiveMap /></Guard>} />
        <Route path="gudang" element={<Guard page="gudang"><WarehousePage /></Guard>} />
        <Route path="produksi" element={<Guard page="produksi"><Production /></Guard>} />
        <Route path="undian" element={<Guard page="undian"><Lottery /></Guard>} />
        <Route path="user" element={<Guard page="user"><Users /></Guard>} />
        <Route path="pengaturan" element={<Guard page="pengaturan"><Settings /></Guard>} />
        <Route path="panduan" element={<Guard page="panduan"><Guide /></Guard>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster />
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
