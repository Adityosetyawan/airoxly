import { storage } from "@/src/utils/storage";

export const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL + "/api";
export const TOKEN_KEY = "oxly.auth.token";
export const USER_KEY = "oxly.auth.user";

export type Role = "super_admin" | "admin" | "sales" | "produksi" | "gudang";

export type User = {
  id: string;
  username: string;
  role: Role;
  name?: string;
  group_letter?: string;
  sales_code?: string;
  wa_number?: string;
  address?: string;
  year_joined?: number;
  salary?: number;
  commission?: number;
  bonus?: number;
  disabled?: boolean;
  google_email?: string;
  picture?: string;
  kelompok?: string;
};

export type Product = {
  id: string;
  name: string;
  unit: string;
  price: number;
  order: number;
};

export type Customer = {
  id: string;
  customer_no: number;
  name: string;
  address?: string;
  wa_number?: string;
  barcode_id: string;
  group_letter: string;
  sales_code?: string;
  created_by?: string;
  gallon_loans: number;
  total_debt: number;
  total_purchases: number;
  purchase_count: number;
  last_purchase_date?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export type TransactionItem = {
  product_id: string;
  product_name: string;
  unit: string;
  qty: number;
  price: number;
  subtotal: number;
};

export type Transaction = {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_no?: number;
  customer_wa?: string;
  sales_id: string;
  sales_code?: string;
  group_letter: string;
  items: TransactionItem[];
  total: number;
  bayar: number;
  hutang_transaksi: number;
  pinjam_galon: number;
  galon_kembali: number;
  prev_debt: number;
  new_debt: number;
  prev_loans: number;
  new_loans: number;
  date: string;
  date_only: string;
  edited: boolean;
  edit_count: number;
  lottery_tickets?: string[];
  lottery_period_name?: string;
};

export type Expense = {
  id: string;
  sales_id: string;
  sales_code?: string;
  group_letter?: string;
  category: string;
  description?: string;
  amount: number;
  date: string;
  date_only: string;
};

async function req<T = any>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await storage.secureGet<string>(TOKEN_KEY, "");
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = await res.json();
      detail = j.detail || detail;
    } catch {}
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as any;
  return res.json();
}

export const api = {
  login: async (username: string, password: string) => {
    const r = await req<{ access_token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    await storage.secureSet(TOKEN_KEY, r.access_token);
    await storage.setItem(USER_KEY, JSON.stringify(r.user));
    return r;
  },
  logout: async () => {
    // Best-effort revoke server-side session (JWT is stateless)
    try { await req("/auth/logout", { method: "POST" }); } catch {}
    await storage.secureRemove(TOKEN_KEY);
    await storage.removeItem(USER_KEY);
  },
  me: () => req<User>("/auth/me"),

  /**
   * Exchange a one-time Emergent `session_id` for a 7-day session_token.
   * Called from the Google Sign-in redirect handler.
   */
  googleSession: async (session_id: string) => {
    const r = await req<{ session_token: string; user: User }>("/auth/session", {
      method: "POST",
      body: JSON.stringify({ session_id }),
    });
    await storage.secureSet(TOKEN_KEY, r.session_token);
    await storage.setItem(USER_KEY, JSON.stringify(r.user));
    return r;
  },

  // Users
  listUsers: (params?: { role?: string; group_letter?: string }) => {
    const q = new URLSearchParams();
    if (params?.role) q.set("role", params.role);
    if (params?.group_letter) q.set("group_letter", params.group_letter);
    const s = q.toString();
    return req<User[]>(`/users${s ? "?" + s : ""}`);
  },
  createUser: (body: any) => req<User>("/users", { method: "POST", body: JSON.stringify(body) }),
  updateUser: (id: string, body: any) => req<User>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteUser: (id: string) => req(`/users/${id}`, { method: "DELETE" }),

  // Products
  listProducts: () => req<Product[]>("/products"),
  createProduct: (body: any) => req<Product>("/products", { method: "POST", body: JSON.stringify(body) }),
  updateProduct: (id: string, body: any) => req<Product>(`/products/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteProduct: (id: string) => req(`/products/${id}`, { method: "DELETE" }),

  // Customers
  listCustomers: (params?: { sort?: string; q?: string; sales_id?: string }) => {
    const q = new URLSearchParams();
    if (params?.sort) q.set("sort", params.sort);
    if (params?.q) q.set("q", params.q);
    if (params?.sales_id) q.set("sales_id", params.sales_id);
    const s = q.toString();
    return req<Customer[]>(`/customers${s ? "?" + s : ""}`);
  },
  getCustomer: (id: string) => req<Customer>(`/customers/${id}`),
  lookupCustomer: (barcode: string) => req<Customer>(`/customers/lookup/${encodeURIComponent(barcode)}`),
  createCustomer: (body: any) => req<Customer>("/customers", { method: "POST", body: JSON.stringify(body) }),
  updateCustomer: (id: string, body: any) => req<Customer>(`/customers/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteCustomer: (id: string) => req(`/customers/${id}`, { method: "DELETE" }),

  // Transactions
  listTransactions: (params?: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => v && q.set(k, v));
    const s = q.toString();
    return req<Transaction[]>(`/transactions${s ? "?" + s : ""}`);
  },
  getTransaction: (id: string) => req<Transaction>(`/transactions/${id}`),
  createTransaction: (body: any) => req<Transaction>("/transactions", { method: "POST", body: JSON.stringify(body) }),
  editTransaction: (id: string, body: any) => req<Transaction>(`/transactions/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteTransaction: (id: string) => req(`/transactions/${id}`, { method: "DELETE" }),

  // Reports
  dailyReport: (params?: { date?: string; group_letter?: string; sales_code?: string }) => {
    const q = new URLSearchParams();
    if (params?.date) q.set("date", params.date);
    if (params?.group_letter) q.set("group_letter", params.group_letter);
    if (params?.sales_code) q.set("sales_code", params.sales_code);
    const s = q.toString();
    return req<any>(`/reports/daily${s ? "?" + s : ""}`);
  },

  // Expenses
  listExpenses: (params?: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => v && q.set(k, v));
    const s = q.toString();
    return req<Expense[]>(`/expenses${s ? "?" + s : ""}`);
  },
  createExpense: (body: { category: string; description?: string; amount: number; date?: string }) =>
    req<Expense>("/expenses", { method: "POST", body: JSON.stringify(body) }),
  deleteExpense: (id: string) => req(`/expenses/${id}`, { method: "DELETE" }),

  // Part prices (red — super admin)
  listPartPrices: () => req<any[]>("/part-prices"),
  createPartPrice: (body: { name: string; rp_per_pcs: number; order?: number }) =>
    req<any>("/part-prices", { method: "POST", body: JSON.stringify(body) }),
  updatePartPrice: (id: string, body: { name: string; rp_per_pcs: number; order?: number }) =>
    req(`/part-prices/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deletePartPrice: (id: string) => req(`/part-prices/${id}`, { method: "DELETE" }),

  // Settings
  getSetting: (key: string) => req<{ key: string; value: any }>(`/settings/${key}`),
  setSetting: (key: string, value: any) =>
    req(`/settings/${key}`, { method: "PUT", body: JSON.stringify({ key, value }) }),

  // Monthly report
  monthlyReport: (params: { sales_id: string; year: number; month: number }) => {
    const q = new URLSearchParams({
      sales_id: params.sales_id,
      year: String(params.year),
      month: String(params.month),
    });
    return req<any>(`/reports/monthly?${q.toString()}`);
  },
  updateMonthlyReport: (
    params: { sales_id: string; year: number; month: number },
    body: any,
  ) => {
    const q = new URLSearchParams({
      sales_id: params.sales_id,
      year: String(params.year),
      month: String(params.month),
    });
    return req(`/reports/monthly?${q.toString()}`, { method: "PATCH", body: JSON.stringify(body) });
  },

  // Location
  pingLocation: (lat: number, lng: number) =>
    req("/location/ping", { method: "POST", body: JSON.stringify({ lat, lng }) }),
  liveLocations: () => req<any[]>("/location/live"),
  locationHistory: (sales_id: string, date?: string) => {
    const q = new URLSearchParams();
    if (date) q.set("date", date);
    const s = q.toString();
    return req<{ id: string; sales_id: string; sales_code?: string; lat: number; lng: number; ts: string }[]>(
      `/location/history/${sales_id}${s ? "?" + s : ""}`,
    );
  },

  // Stats
  overview: () => req<any>("/stats/overview"),

  // Lottery / Undian
  listLotteryPeriods: () => req<any[]>("/lottery/periods"),
  activeLotteryPeriod: () => req<any | null>("/lottery/periods/active"),
  createLotteryPeriod: (body: {
    name: string;
    start_date: string;
    end_date: string;
    winner_count: number;
    is_active: boolean;
    prize_description?: string;
    description?: string;
  }) => req<any>("/lottery/periods", { method: "POST", body: JSON.stringify(body) }),
  updateLotteryPeriod: (
    id: string,
    body: Partial<{ name: string; start_date: string; end_date: string; winner_count: number; is_active: boolean; prize_description: string; description: string }>,
  ) => req<any>(`/lottery/periods/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  activateLotteryPeriod: (id: string) =>
    req<any>(`/lottery/periods/${id}/activate`, { method: "POST" }),
  deleteLotteryPeriod: (id: string) =>
    req<{ ok: boolean }>(`/lottery/periods/${id}`, { method: "DELETE" }),
  drawLottery: (id: string) => req<any>(`/lottery/periods/${id}/draw`, { method: "POST" }),
  listLotteryTickets: (params: { period_id?: string; sales_id?: string; customer_id?: string; limit?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.period_id) q.set("period_id", params.period_id);
    if (params.sales_id) q.set("sales_id", params.sales_id);
    if (params.customer_id) q.set("customer_id", params.customer_id);
    if (params.limit) q.set("limit", String(params.limit));
    const s = q.toString();
    return req<any[]>(`/lottery/tickets${s ? "?" + s : ""}`);
  },
  lotteryStats: (period_id?: string) =>
    req<any>(`/lottery/stats${period_id ? "?period_id=" + period_id : ""}`),
  listAllWinners: (limit = 200) =>
    req<any[]>(`/lottery/winners?limit=${limit}`),

  // Production
  createProductionDaily: (body: any) =>
    req<any>("/production/daily", { method: "POST", body: JSON.stringify(body) }),
  listProductionDaily: (params: { date_from?: string; date_to?: string; sales_id?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.date_from) q.set("date_from", params.date_from);
    if (params.date_to) q.set("date_to", params.date_to);
    if (params.sales_id) q.set("sales_id", params.sales_id);
    const s = q.toString();
    return req<any[]>(`/production/daily${s ? "?" + s : ""}`);
  },
  deleteProductionDaily: (id: string) => req(`/production/daily/${id}`, { method: "DELETE" }),

  // Warehouse daily
  createWarehouseDaily: (body: any) =>
    req<any>("/warehouse/daily", { method: "POST", body: JSON.stringify(body) }),
  listWarehouseDaily: (params: { date_from?: string; date_to?: string; sales_id?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.date_from) q.set("date_from", params.date_from);
    if (params.date_to) q.set("date_to", params.date_to);
    if (params.sales_id) q.set("sales_id", params.sales_id);
    const s = q.toString();
    return req<any[]>(`/warehouse/daily${s ? "?" + s : ""}`);
  },
  deleteWarehouseDaily: (id: string) => req(`/warehouse/daily/${id}`, { method: "DELETE" }),

  // Warehouse incoming
  createWarehouseIncoming: (body: any) =>
    req<any>("/warehouse/incoming", { method: "POST", body: JSON.stringify(body) }),
  listWarehouseIncoming: (params: { date_from?: string; date_to?: string; item?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.date_from) q.set("date_from", params.date_from);
    if (params.date_to) q.set("date_to", params.date_to);
    if (params.item) q.set("item", params.item);
    const s = q.toString();
    return req<any[]>(`/warehouse/incoming${s ? "?" + s : ""}`);
  },
  deleteWarehouseIncoming: (id: string) => req(`/warehouse/incoming/${id}`, { method: "DELETE" }),

  // Warehouse stock
  getWarehouseStock: () => req<Record<string, number>>("/warehouse/stock"),

  // Validate bawa-sisa vs transactions
  validateSalesBawaSisa: (sales_id: string, date: string) =>
    req<{ bawa_total: number; sisa_total: number; terjual_by_gudang: number; terjual_by_transaksi: number; match: boolean; diff: number }>(
      `/production/validate-sales/${sales_id}/${date}`,
    ),
};

export async function getSavedUser(): Promise<User | null> {
  const raw = await storage.getItem<string>(USER_KEY, "");
  if (!raw) return null;
  try {
    return JSON.parse(raw as string);
  } catch {
    return null;
  }
}
