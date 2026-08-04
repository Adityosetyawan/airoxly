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

/**
 * Broadcast a personalized WhatsApp message to multiple recipients.
 *
 * - On web: opens each recipient in a new tab via window.open()
 *   (allowed because triggered from a single user gesture; some browsers may block
 *   additional tabs after the first — user must allow pop-ups).
 * - On native: opens WA sheets sequentially with a delay so the OS can queue them.
 *
 * Returns counts: { sent, skipped, failed }.
 */
export async function broadcastWhatsApp(
  recipients: { phone: string; message: string; label?: string }[],
): Promise<{ sent: number; skipped: number; failed: number }> {
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i];
    const n = sanitize(r.phone);
    if (!n) {
      skipped += 1;
      continue;
    }
    const encoded = encodeURIComponent(r.message);
    const url = `https://wa.me/${n}?text=${encoded}`;
    try {
      if (Platform.OS === "web") {
        // Open each in a new tab. Browsers typically allow the first pop-up;
        // subsequent ones may require user permission.
        const w = typeof window !== "undefined" ? window.open(url, "_blank") : null;
        if (!w) failed += 1;
        else sent += 1;
      } else {
        const supported = await Linking.canOpenURL(url);
        if (!supported) {
          failed += 1;
        } else {
          await Linking.openURL(url);
          sent += 1;
        }
      }
    } catch {
      failed += 1;
    }
    // Small delay so devices/browsers don't drop subsequent opens
    await new Promise((res) => setTimeout(res, 400));
  }
  return { sent, skipped, failed };
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
  lottery_tickets?: string[];
  lottery_period_name?: string;
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
  if (opts.lottery_tickets && opts.lottery_tickets.length > 0) {
    lines.push("");
    lines.push(`🎁 *Nomor Undian${opts.lottery_period_name ? " – " + opts.lottery_period_name : ""}*`);
    lines.push(`Anda dapat ${opts.lottery_tickets.length} nomor undian:`);
    opts.lottery_tickets.forEach((t) => lines.push(`• ${t}`));
    lines.push("Simpan struk ini untuk verifikasi pemenang.");
  }
  lines.push("");
  lines.push("Terima kasih 🙏");
  return lines.join("\n");
}
