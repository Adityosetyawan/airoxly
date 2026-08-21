import axios from "axios";

const base = process.env.REACT_APP_AIROXLY_API_URL || process.env.REACT_APP_BACKEND_URL;

if (!base) {
  throw new Error(
    "Konfigurasi API hilang: REACT_APP_AIROXLY_API_URL / REACT_APP_BACKEND_URL belum diset saat build. " +
    "Isi di Vercel → Settings → Environment Variables, lalu redeploy."
  );
}

const api = axios.create({
  baseURL: `${base}/api`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("oxly_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const isLoginCall = error.config?.url?.includes("/auth/login");
    if (error.response?.status === 401 && !isLoginCall && !window.location.pathname.startsWith("/login")) {
      localStorage.removeItem("oxly_token");
      localStorage.removeItem("oxly_user");
      window.location.assign("/login");
    }
    return Promise.reject(error);
  }
);

export default api;
