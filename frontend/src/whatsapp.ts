import { Linking, Platform } from "react-native";

function sanitize(num: string) {
  // strip non digits, remove leading 0/+62 -> 62
  const digits = (num || "").replace(/[^\d]/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return "62" + digits.slice(1);
  if (digits.startsWith("62")) return digits;
  return digits;
}

export async function sendWhatsApp(phone: string, message: string) {
  const n = sanitize(phone);
  if (!n) throw new Error("Nomor WA kosong");
  const encoded = encodeURIComponent(message);
  const url = `https://wa.me/${n}?text=${encoded}`;
  const supported = await Linking.canOpenURL(url);
  if (!supported) throw new Error("Tidak bisa membuka WhatsApp");
  await Linking.openURL(url);
}

export function formatReceipt(opts: {
  storeName?: string;
  salesCode?: string;
  customerName: string;
  customerNo?: number;
  date: string;
  items: { product_name: string; qty: number; unit: string; price: number; subtotal: number }[];
  total: number;
  bayar: number;
  hutang_transaksi: number;
  pinjam_galon: number;
  galon_kembali: number;
  new_debt: number;
  new_loans: number;
  edited?: boolean;
}) {
  const fmt = (n: number) =>
    "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n || 0));
  const lines: string[] = [];
  lines.push(`*${opts.storeName || "Air OXLY"}*`);
  if (opts.edited) lines.push("_(Struk diperbaharui)_");
  lines.push(`Sales: ${opts.salesCode || "-"}`);
  lines.push(`Tanggal: ${new Date(opts.date).toLocaleString("id-ID")}`);
  lines.push(`Pelanggan: ${opts.customerName}${opts.customerNo ? ` (No.${opts.customerNo})` : ""}`);
  lines.push("");
  lines.push("*Pembelian:*");
  opts.items.forEach((it) => {
    if (it.qty > 0) lines.push(`• ${it.product_name} — ${it.qty} ${it.unit} × ${fmt(it.price)} = ${fmt(it.subtotal)}`);
  });
  lines.push("");
  lines.push(`Total: ${fmt(opts.total)}`);
  lines.push(`Bayar: ${fmt(opts.bayar)}`);
  if (opts.hutang_transaksi > 0) lines.push(`Kekurangan/Hutang transaksi: ${fmt(opts.hutang_transaksi)}`);
  if (opts.pinjam_galon > 0) lines.push(`Pinjam galon: ${opts.pinjam_galon} gln`);
  if (opts.galon_kembali > 0) lines.push(`Galon kembali: ${opts.galon_kembali} gln`);
  lines.push("");
  lines.push(`Sisa hutang: ${fmt(opts.new_debt)}`);
  lines.push(`Total pinjam galon: ${opts.new_loans} gln`);
  lines.push("");
  lines.push("Terima kasih 🙏");
  return lines.join("\n");
}
