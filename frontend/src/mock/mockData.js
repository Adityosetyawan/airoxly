// ===== Air OXLY - Mock Data (frontend-only teaser) =====
// Semua data di sini adalah data tiruan (MOCK). Nanti akan diganti backend.

export const DEMO_USERS = [
  { id: "u1", username: "superadmin", password: "super123", name: "Budi Santoso", role: "superadmin", area: "Pusat" },
  { id: "u2", username: "adminA", password: "admin123", name: "Rina Admin", role: "admin", area: "Area A" },
  { id: "u3", username: "A1", password: "sales123", name: "Agus Sales", role: "sales", area: "Area A", target: 2000000 },
  { id: "u4", username: "A2", password: "sales123", name: "Dewi Sales", role: "sales", area: "Area A", target: 1800000 },
  { id: "u5", username: "gudang", password: "gudang123", name: "Hasan Gudang", role: "gudang", area: "Pusat" },
  { id: "u6", username: "produksi", password: "prod123", name: "Sari Produksi", role: "produksi", area: "Pusat" },
];

export const ROLE_LABELS = {
  superadmin: "Super Admin",
  admin: "Admin",
  sales: "Sales",
  gudang: "Gudang",
  produksi: "Produksi",
};

export const PRODUCTS = [
  { id: "p1", name: "Galon Polos 19L", price: 6000, refill: true, stock: 320, icon: "droplet" },
  { id: "p2", name: "Galon Bermerek 19L", price: 18000, refill: false, stock: 145, icon: "droplet" },
  { id: "p3", name: "Botol 600ml (dus)", price: 42000, refill: false, stock: 88, icon: "package" },
  { id: "p4", name: "Botol 1500ml (dus)", price: 55000, refill: false, stock: 64, icon: "package" },
  { id: "p5", name: "Gelas 240ml (dus)", price: 24000, refill: false, stock: 210, icon: "package" },
];

export const CUSTOMERS = [
  { id: "c1", name: "Warung Bu Tini", phone: "0812-1111-2222", address: "Jl. Melati No. 12", area: "Area A", barcode: "AOX-0001", galonPinjam: 3, lastBuy: "2026-08-19" },
  { id: "c2", name: "Toko Sumber Rejeki", phone: "0813-3333-4444", address: "Jl. Kenanga No. 5", area: "Area A", barcode: "AOX-0002", galonPinjam: 8, lastBuy: "2026-08-20" },
  { id: "c3", name: "Kantin Sekolah 21", phone: "0857-5555-6666", address: "Jl. Pendidikan No. 21", area: "Area A", barcode: "AOX-0003", galonPinjam: 2, lastBuy: "2026-08-18" },
  { id: "c4", name: "Cafe Kopi Senja", phone: "0821-7777-8888", address: "Jl. Merdeka No. 9", area: "Area B", barcode: "AOX-0004", galonPinjam: 5, lastBuy: "2026-08-20" },
  { id: "c5", name: "Rumah Pak Joko", phone: "0838-9999-0000", address: "Perum Griya Asri B2", area: "Area A", barcode: "AOX-0005", galonPinjam: 1, lastBuy: "2026-08-17" },
  { id: "c6", name: "Masjid Al-Ikhlas", phone: "0812-2323-4545", address: "Jl. Damai No. 1", area: "Area B", barcode: "AOX-0006", galonPinjam: 4, lastBuy: "2026-08-16" },
];

export const TRANSACTIONS = [
  { id: "t1", customerId: "c2", customer: "Toko Sumber Rejeki", salesId: "u3", sales: "Agus Sales", items: [{ productId: "p1", name: "Galon Polos 19L", qty: 10, price: 6000 }], total: 60000, bayar: 60000, kembali: 0, galonPinjam: 0, galonKembali: 5, date: "2026-08-20T08:15:00", status: "lunas" },
  { id: "t2", customerId: "c1", customer: "Warung Bu Tini", salesId: "u3", sales: "Agus Sales", items: [{ productId: "p1", name: "Galon Polos 19L", qty: 3, price: 6000 }, { productId: "p3", name: "Botol 600ml (dus)", qty: 2, price: 42000 }], total: 102000, bayar: 100000, kembali: 0, galonPinjam: 3, galonKembali: 0, date: "2026-08-20T09:30:00", status: "utang" },
  { id: "t3", customerId: "c4", customer: "Cafe Kopi Senja", salesId: "u4", sales: "Dewi Sales", items: [{ productId: "p2", name: "Galon Bermerek 19L", qty: 5, price: 18000 }], total: 90000, bayar: 90000, kembali: 0, galonPinjam: 0, galonKembali: 2, date: "2026-08-20T10:05:00", status: "lunas" },
  { id: "t4", customerId: "c3", customer: "Kantin Sekolah 21", salesId: "u3", sales: "Agus Sales", items: [{ productId: "p5", name: "Gelas 240ml (dus)", qty: 4, price: 24000 }], total: 96000, bayar: 96000, kembali: 0, galonPinjam: 0, galonKembali: 0, date: "2026-08-19T14:20:00", status: "lunas" },
  { id: "t5", customerId: "c5", customer: "Rumah Pak Joko", salesId: "u4", sales: "Dewi Sales", items: [{ productId: "p1", name: "Galon Polos 19L", qty: 2, price: 6000 }], total: 12000, bayar: 12000, kembali: 0, galonPinjam: 1, galonKembali: 1, date: "2026-08-19T16:45:00", status: "lunas" },
];

export const EXPENSES = [
  { id: "e1", title: "Bensin motor operasional", amount: 50000, category: "Transport", by: "Agus Sales", date: "2026-08-20" },
  { id: "e2", title: "Servis mesin RO", amount: 350000, category: "Perawatan", by: "Hasan Gudang", date: "2026-08-19" },
  { id: "e3", title: "Beli tutup galon", amount: 120000, category: "Bahan", by: "Sari Produksi", date: "2026-08-18" },
  { id: "e4", title: "Konsumsi tim", amount: 85000, category: "Lain-lain", by: "Rina Admin", date: "2026-08-18" },
];

export const SPAREPARTS = [
  { id: "s1", name: "Galon Polos", gudang: 150, produksi: 15 },
  { id: "s2", name: "Tutup Galon", gudang: 1200, produksi: 300 },
  { id: "s3", name: "Segel/Tisu", gudang: 800, produksi: 150 },
  { id: "s4", name: "Tissue Galon", gudang: 500, produksi: 90 },
];

export const TRANSFERS = [
  { id: "tr1", part: "Galon Polos", qty: 20, note: "Stok produksi menipis", by: "Hasan Gudang", date: "2026-08-20T07:00:00" },
  { id: "tr2", part: "Tutup Galon", qty: 200, note: "", by: "Hasan Gudang", date: "2026-08-19T13:00:00" },
];

export const LOTTERY = {
  active: true,
  title: "Undian Berhadiah Agustus 2026",
  prize: "Motor Listrik + 10 Voucher Belanja",
  totalCoupons: 1240,
  drawDate: "2026-08-31",
  winners: [
    { id: "w1", name: "Warung Bu Tini", coupon: "AOX-8842", prize: "Voucher Rp 100.000" },
    { id: "w2", name: "Cafe Kopi Senja", coupon: "AOX-1290", prize: "Voucher Rp 50.000" },
  ],
};

// Titik GPS live sales (koordinat sekitar Jakarta) - mock
export const GPS_POINTS = [
  { id: "u3", name: "Agus Sales", lat: -6.2088, lng: 106.8456, lastPing: "2 menit lalu", status: "aktif", top: 42, left: 55 },
  { id: "u4", name: "Dewi Sales", lat: -6.1751, lng: 106.865, lastPing: "5 menit lalu", status: "aktif", top: 28, left: 38 },
];

// Ringkasan overview untuk dashboard
export const OVERVIEW = {
  todaySales: 258000,
  todayTransactions: 4,
  todayCustomers: 4,
  monthSales: 18450000,
  monthTransactions: 312,
  activeSales: 2,
  totalCustomers: CUSTOMERS.length,
  totalProducts: PRODUCTS.length,
  outstandingUtang: 2000,
  weeklyTrend: [
    { day: "Sen", value: 2100000 },
    { day: "Sel", value: 2650000 },
    { day: "Rab", value: 1980000 },
    { day: "Kam", value: 3120000 },
    { day: "Jum", value: 2870000 },
    { day: "Sab", value: 3450000 },
    { day: "Min", value: 1580000 },
  ],
  topProducts: [
    { name: "Galon Polos 19L", sold: 1240, pct: 62 },
    { name: "Galon Bermerek 19L", sold: 380, pct: 19 },
    { name: "Botol 600ml", sold: 210, pct: 11 },
    { name: "Gelas 240ml", sold: 160, pct: 8 },
  ],
};

export const rupiah = (n) =>
  "Rp " + (n || 0).toLocaleString("id-ID");
