// Unit test for formatReceipt() — verifies (iter_11 / restored behavior):
// WITH lottery_tickets:
//   - "🎁 *Kupon Undian – {period_name}*" header line is emitted
//   - "Anda mendapat N nomor undian:" line
//   - Each ticket code on its own bullet line "• OXLY-XXXXXX"
//   - "Simpan struk ini sebagai bukti kupon undian." trailing line
// WITHOUT lottery_tickets (empty / undefined):
//   - No "Kupon Undian" section, no 🎁 emoji, no ticket-code leakage
// Core lines (Pembelian, Total, Bayar, Sisa hutang, Total pinjam galon, Terima kasih) always remain.
import { execSync } from "node:child_process";

const bundlePath = "/tmp/whatsapp_bundle.mjs";
const stubDir = "/tmp/rn_stub";
execSync(`mkdir -p ${stubDir}/react-native && echo "export const Linking = { canOpenURL: async()=>true, openURL: async()=>{} }; export const Platform = { OS: 'web', select: (o)=>o.default||o.android||o.ios };" > ${stubDir}/react-native/index.mjs && echo '{"name":"react-native","main":"index.mjs","type":"module"}' > ${stubDir}/react-native/package.json`);

execSync(
  `esbuild /app/frontend/src/whatsapp.ts --bundle --format=esm --platform=neutral --outfile=${bundlePath} --alias:react-native=${stubDir}/react-native/index.mjs --loader:.ts=ts`,
  { stdio: "inherit" }
);

const mod = await import(bundlePath);
const { formatReceipt } = mod;

// ----- CASE 1: WITH tickets -----
const withTickets = formatReceipt({
  storeName: "Air OXLY",
  salesCode: "A1",
  customerName: "Budi",
  customerNo: 12,
  date: new Date().toISOString(),
  items: [
    { product_name: "Air Galon 19L", qty: 3, unit: "gln", price: 20000, subtotal: 60000 },
  ],
  total: 60000,
  bayar: 60000,
  hutang_transaksi: 0,
  pinjam_galon: 1,
  galon_kembali: 0,
  new_debt: 0,
  new_loans: 1,
  edited: false,
  lottery_tickets: ["OXLY-ABC123", "OXLY-XYZ789", "OXLY-DEF456"],
  lottery_period_name: "Undian Test",
});
console.log("---RECEIPT WITH TICKETS---");
console.log(withTickets);
console.log("---END---");

// ----- CASE 2: WITHOUT tickets (undefined) -----
const noTickets = formatReceipt({
  storeName: "Air OXLY",
  salesCode: "A1",
  customerName: "Siti",
  customerNo: 5,
  date: new Date().toISOString(),
  items: [
    { product_name: "Cup 150ml", qty: 2, unit: "dus", price: 15000, subtotal: 30000 },
  ],
  total: 30000,
  bayar: 30000,
  hutang_transaksi: 0,
  pinjam_galon: 0,
  galon_kembali: 0,
  new_debt: 0,
  new_loans: 0,
});
console.log("---RECEIPT WITHOUT TICKETS---");
console.log(noTickets);
console.log("---END---");

// ----- CASE 3: empty array -----
const emptyTickets = formatReceipt({
  storeName: "Air OXLY",
  salesCode: "A1",
  customerName: "Rina",
  customerNo: 7,
  date: new Date().toISOString(),
  items: [
    { product_name: "Botol 600ml", qty: 1, unit: "dus", price: 25000, subtotal: 25000 },
  ],
  total: 25000,
  bayar: 25000,
  hutang_transaksi: 0,
  pinjam_galon: 0,
  galon_kembali: 0,
  new_debt: 0,
  new_loans: 0,
  lottery_tickets: [],
});

const checks = {
  // WITH-tickets assertions
  "[with] Has '🎁' emoji": withTickets.includes("🎁"),
  "[with] Has 'Kupon Undian' label (not 'Nomor Undian')": withTickets.includes("Kupon Undian"),
  "[with] Uses period name 'Undian Test'": withTickets.includes("Undian Test"),
  "[with] Header contains 'Kupon Undian – Undian Test'": withTickets.includes("Kupon Undian – Undian Test"),
  "[with] Has 'Anda mendapat 3 nomor undian:'": withTickets.includes("Anda mendapat 3 nomor undian:"),
  "[with] Has '• OXLY-ABC123'": withTickets.includes("• OXLY-ABC123"),
  "[with] Has '• OXLY-XYZ789'": withTickets.includes("• OXLY-XYZ789"),
  "[with] Has '• OXLY-DEF456'": withTickets.includes("• OXLY-DEF456"),
  "[with] Has 'Simpan struk ini sebagai bukti kupon undian.'": withTickets.includes("Simpan struk ini sebagai bukti kupon undian."),
  "[with] Does NOT use old 'Nomor Undian' label": !withTickets.includes("Nomor Undian"),
  "[with] Has '*Pembelian:*'": withTickets.includes("*Pembelian:*"),
  "[with] Has 'Total: Rp 60.000'": /Total: Rp\s?60\.000/.test(withTickets),
  "[with] Has 'Bayar: Rp 60.000'": /Bayar: Rp\s?60\.000/.test(withTickets),
  "[with] Has 'Sisa hutang:'": withTickets.includes("Sisa hutang:"),
  "[with] Has 'Total pinjam galon:'": withTickets.includes("Total pinjam galon:"),
  "[with] Has 'Terima kasih 🙏'": withTickets.includes("Terima kasih 🙏"),
  "[with] Has 'Pinjam galon: 1 gln'": withTickets.includes("Pinjam galon: 1 gln"),
  "[with] Has customer 'Budi (No.12)'": withTickets.includes("Budi (No.12)"),

  // WITHOUT-tickets assertions
  "[no-tickets] NO 'Kupon Undian' section": !noTickets.includes("Kupon Undian"),
  "[no-tickets] NO 'Nomor Undian' section": !noTickets.includes("Nomor Undian"),
  "[no-tickets] NO '🎁' lottery emoji": !noTickets.includes("🎁"),
  "[no-tickets] NO 'Anda mendapat' line": !noTickets.includes("Anda mendapat"),
  "[no-tickets] Has 'Total: Rp 30.000'": /Total: Rp\s?30\.000/.test(noTickets),
  "[no-tickets] Has 'Terima kasih 🙏'": noTickets.includes("Terima kasih 🙏"),

  // EMPTY-array assertions (should behave same as WITHOUT)
  "[empty-arr] NO 'Kupon Undian' section": !emptyTickets.includes("Kupon Undian"),
  "[empty-arr] NO '🎁' lottery emoji": !emptyTickets.includes("🎁"),
};

let ok = 0, fail = 0;
for (const [k, v] of Object.entries(checks)) {
  console.log(`${v ? "PASS" : "FAIL"}: ${k}`);
  v ? ok++ : fail++;
}
console.log(`\nTotal: ${ok} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
