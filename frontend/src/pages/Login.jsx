import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, AlertTriangle, Droplets } from "lucide-react";
import { useAuth, formatApiErrorDetail } from "@/context/AuthContext";

const LOGIN_BG =
  "https://images.unsplash.com/photo-1527576539890-dfa815648363?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MDV8MHwxfHNlYXJjaHwxfHxzd2lzcyUyMGFyY2hpdGVjdHVyZSUyMG1vbm9jaHJvbWV8ZW58MHx8fHwxNzg3MzI4MzU5fDA&ixlib=rb-4.1.0&q=85";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const u = await login(email.trim(), password);
      toast.success(`Selamat datang, ${u.name}`);
      navigate("/", { replace: true });
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (detail) {
        setError(formatApiErrorDetail(detail));
      } else if (err.response) {
        setError("Server sedang tidak dapat dihubungi. Coba lagi beberapa saat.");
      } else {
        setError("Tidak dapat terhubung ke server airoxly. Periksa koneksi Anda.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div data-testid="login-page" className="grid min-h-screen bg-white lg:grid-cols-2">
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-[#0A0A0A]">
              <Droplets className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="font-display text-xl font-extrabold tracking-tight text-[#0A0A0A]">Air OXLY</p>
              <p className="text-xs font-medium uppercase tracking-widest text-gray-500">Admin Console</p>
            </div>
          </div>

          <h1 className="mt-10 font-display text-3xl font-extrabold tracking-tight text-[#0A0A0A] sm:text-4xl">
            Masuk ke dasbor
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Gunakan akun airoxly Anda. Hak akses menyesuaikan peran (SuperAdmin, Admin, Sales).
          </p>

          {error && (
            <div
              data-testid="login-error-alert"
              className="mt-6 flex items-start gap-2 rounded-md border border-[#E03131]/40 bg-[#E03131]/5 px-3 py-2.5 text-sm text-[#E03131]"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label htmlFor="login-email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-600">
                Email
              </label>
              <input
                id="login-email"
                data-testid="login-email-input"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@airoxly.id"
                className="w-full rounded-md border border-[#DEE2E6] bg-white px-3 py-2.5 text-sm text-[#0A0A0A] outline-none transition-colors placeholder:text-gray-400 focus:border-[#0A0A0A]"
              />
            </div>
            <div>
              <label htmlFor="login-password" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-600">
                Kata Sandi
              </label>
              <input
                id="login-password"
                data-testid="login-password-input"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-md border border-[#DEE2E6] bg-white px-3 py-2.5 text-sm text-[#0A0A0A] outline-none transition-colors placeholder:text-gray-400 focus:border-[#0A0A0A]"
              />
            </div>
            <button
              data-testid="login-submit-button"
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[#0A0A0A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2b2b2b] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Memproses…" : "Masuk"}
            </button>
          </form>

          <p className="mt-8 text-xs text-gray-400">
            Terkunci di luar akun? Hubungi SuperAdmin untuk pengaturan ulang kata sandi.
          </p>
        </div>
      </div>

      <div className="relative hidden lg:block">
        <img src={LOGIN_BG} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[#0A0A0A]/70" />
        <div className="absolute bottom-0 left-0 p-10">
          <p className="font-display text-2xl font-bold leading-snug text-white sm:text-3xl">
            Satu sumber kebenaran
            <br />
            untuk operasional Air OXLY.
          </p>
          <p className="mt-3 text-sm text-white/70">
            Penjualan, pelanggan, dan pengeluaran — langsung dari MongoDB airoxly.
          </p>
        </div>
      </div>
    </div>
  );
}
