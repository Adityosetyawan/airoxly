import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { Loader2 } from "lucide-react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import AdminLayout from "@/layouts/AdminLayout";
import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import Customers from "@/pages/Customers";
import Products from "@/pages/Products";
import Transactions from "@/pages/Transactions";
import Expenses from "@/pages/Expenses";
import LiveMap from "@/pages/LiveMap";
import Users from "@/pages/Users";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30000 },
  },
});

const FullScreenLoader = () => (
  <div data-testid="app-loading" className="flex min-h-screen items-center justify-center bg-white">
    <Loader2 className="h-8 w-8 animate-spin text-[#0A0A0A]" />
  </div>
);

const RequireAuth = ({ children }) => {
  const { user } = useAuth();
  if (user === undefined) return <FullScreenLoader />;
  if (user === null) return <Navigate to="/login" replace />;
  return children;
};

const RequireRole = ({ roles, children }) => {
  const { user } = useAuth();
  if (user === undefined) return <FullScreenLoader />;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
};

function App() {
  return (
    <div className="App">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                element={
                  <RequireAuth>
                    <AdminLayout />
                  </RequireAuth>
                }
              >
                <Route path="/" element={<Dashboard />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/products" element={<Products />} />
                <Route path="/transactions" element={<Transactions />} />
                <Route path="/expenses" element={<Expenses />} />
                <Route
                  path="/map"
                  element={
                    <RequireRole roles={["super_admin", "admin"]}>
                      <LiveMap />
                    </RequireRole>
                  }
                />
                <Route
                  path="/users"
                  element={
                    <RequireRole roles={["super_admin"]}>
                      <Users />
                    </RequireRole>
                  }
                />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </QueryClientProvider>
    </div>
  );
}

export default App;
