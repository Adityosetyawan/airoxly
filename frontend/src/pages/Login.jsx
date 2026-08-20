import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Droplet, Eye, EyeOff, LogIn } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useToast } from "../hooks/use-toast";

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      const res = login(username.trim(), password);
      setLoading(false);
      if (res.ok) {
        toast({ title: `Selamat datang, ${res.user.name}!`, description: "Berhasil masuk ke Air OXLY" });
        navigate("/");
      } else {
        toast({ title: "Gagal masuk", description: res.error, variant: "destructive" });
      }
    }, 500);
  };

  const quickFill = (u, p) => { setUsername(u); setPassword(p); };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-background to-background flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="flex flex-col items-center text-center mb-8 animate-fade-up">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <Droplet className="w-10 h-10 text-white" fill="white" />
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-foreground">Air OXLY</h1>
          <p className="text-muted-foreground text-sm mt-1">Sistem Penjualan Air Minum</p>
        </div>

        {/* Card */}
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 animate-fade-up" style={{ animationDelay: "60ms" }}>
          <h2 className="text-xl font-bold">Masuk</h2>
          <p className="text-sm text-muted-foreground mb-5">Gunakan akun Super Admin / Admin / Sales</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input id="username" placeholder="mis. superadmin" value={username}
                onChange={(e) => setUsername(e.target.value)} className="h-11 bg-secondary/60" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input id="password" type={show ? "text" : "password"} placeholder="••••••••" value={password}
                  onChange={(e) => setPassword(e.target.value)} className="h-11 bg-secondary/60 pr-11" required />
                <button type="button" onClick={() => setShow((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <Button type="submit" disabled={loading}
              className="w-full h-11 text-base font-semibold bg-emerald-500 hover:bg-emerald-600">
              {loading ? "Memproses..." : (<><LogIn className="w-4 h-4 mr-2" /> Masuk</>)}
            </Button>
          </form>
        </div>

        {/* Demo accounts */}
        <div className="mt-6 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 animate-fade-up" style={{ animationDelay: "120ms" }}>
          <p className="font-bold text-emerald-800 text-sm mb-2">Akun Uji Coba (klik untuk isi)</p>
          <div className="grid gap-1.5">
            {[
              ["Super Admin", "superadmin", "super123"],
              ["Admin", "adminA", "admin123"],
              ["Sales", "A1", "sales123"],
              ["Gudang", "gudang", "gudang123"],
              ["Produksi", "produksi", "prod123"],
            ].map(([label, u, p]) => (
              <button key={u} onClick={() => quickFill(u, p)}
                className="flex items-center justify-between text-left text-sm text-emerald-700 hover:bg-emerald-100 rounded-lg px-2.5 py-1.5 transition-colors">
                <span className="font-semibold">{label}</span>
                <span className="font-mono text-emerald-600">{u} / {p}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
