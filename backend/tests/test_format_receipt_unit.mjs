// Unit test for formatReceipt() — iter_12 (REVERT of iter_11).
//
// User wants image (Kartu Undian) + text nota sent together in ONE WhatsApp
// message via native share sheet. Since the ticket numbers are already IN the
// image, the text MUST NOT duplicate them. This is a selective revert of
// iter_11 (which had added a "🎁 *Kupon Undian*" section back).
//
// Assertions:
//   WITH lottery_tickets (non-empty):
//     - NO "Kupon Undian" section
//     - NO "🎁" emoji
//     - NO "Nomor Undian" (legacy) either
//     - NO ticket-code leakage (no "OXLY-ABC123", etc.)
//     - NO "Anda mendapat" line
//     - NO "Simpan struk ini sebagai bukti kupon undian." trailer
//     - Core lines still present: Pembelian, Total, Bayar, Sisa hutang,
//       Total pinjam galon, Terima kasih, Pinjam galon, customer header.
//   WITHOUT lottery_tickets / EMPTY array:
//     - Same behavior — no ticket section, core lines present.
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

// ----- CASE 1: WITH tickets (should still NOT include lottery section) -----
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
  new_debt: 15000,
  new_loans: 1,
  edited: false,
  lottery_tickets: ["OXLY-ABC123", "OXLY-XYZ789", "OXLY-DEF456"],
  lottery_period_name: "Undian Test",
});
console.log("---RECEIPT WITH TICKETS (iter_12: MUST NOT contain lottery text)---");
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
  // WITH-tickets assertions (iter_12: NO lottery text anywhere)
  "[with] Does NOT have 'Kupon Undian' label": !withTickets.includes("Kupon Undian"),
  "[with] Does NOT have legacy 'Nomor Undian' label": !withTickets.includes("Nomor Undian"),
  "[with] Does NOT have '🎁' emoji": !withTickets.includes("🎁"),
  "[with] Does NOT have 'Anda mendapat' line": !withTickets.includes("Anda mendapat"),
  "[with] Does NOT contain ticket code OXLY-ABC123": !withTickets.includes("OXLY-ABC123"),
  "[with] Does NOT contain ticket code OXLY-XYZ789": !withTickets.includes("OXLY-XYZ789"),
  "[with] Does NOT contain ticket code OXLY-DEF456": !withTickets.includes("OXLY-DEF456"),
  "[with] Does NOT contain 'Simpan struk ini sebagai bukti kupon undian.'": !withTickets.includes("Simpan struk ini sebagai bukti kupon undian."),
  "[with] Does NOT contain period name 'Undian Test'": !withTickets.includes("Undian Test"),
  // Core lines must still be present
  "[with] Has '*Pembelian:*'": withTickets.includes("*Pembelian:*"),
  "[with] Has 'Total: Rp 60.000'": /Total: Rp\s?60\.000/.test(withTickets),
  "[with] Has 'Bayar: Rp 60.000'": /Bayar: Rp\s?60\.000/.test(withTickets),
  "[with] Has 'Sisa hutang:'": withTickets.includes("Sisa hutang:"),
  "[with] Has 'Total pinjam galon:'": withTickets.includes("Total pinjam galon:"),
  "[with] Has 'Terima kasih 🙏'": withTickets.includes("Terima kasih 🙏"),
  "[with] Has 'Pinjam galon: 1 gln'": withTickets.includes("Pinjam galon: 1 gln"),
  "[with] Has customer 'Budi (No.12)'": withTickets.includes("Budi (No.12)"),
  "[with] Has '*Air OXLY*' store header": withTickets.includes("*Air OXLY*"),
  "[with] Has 'Sales: A1'": withTickets.includes("Sales: A1"),

  // WITHOUT-tickets assertions
  "[no-tickets] NO 'Kupon Undian' section": !noTickets.includes("Kupon Undian"),
  "[no-tickets] NO 'Nomor Undian' section": !noTickets.includes("Nomor Undian"),
  "[no-tickets] NO '🎁' lottery emoji": !noTickets.includes("🎁"),
  "[no-tickets] NO 'Anda mendapat' line": !noTickets.includes("Anda mendapat"),
  "[no-tickets] Has 'Total: Rp 30.000'": /Total: Rp\s?30\.000/.test(noTickets),
  "[no-tickets] Has 'Terima kasih 🙏'": noTickets.includes("Terima kasih 🙏"),
  // no-debt behavior: "Sisa hutang" & "Total pinjam galon" must NOT appear when 0
  "[no-tickets] NO 'Sisa hutang:' when new_debt=0": !noTickets.includes("Sisa hutang:"),
  "[no-tickets] NO 'Total pinjam galon:' when new_loans=0": !noTickets.includes("Total pinjam galon:"),

  // EMPTY-array assertions (should behave same as WITHOUT)
  "[empty-arr] NO 'Kupon Undian' section": !emptyTickets.includes("Kupon Undian"),
  "[empty-arr] NO '🎁' lottery emoji": !emptyTickets.includes("🎁"),
  "[empty-arr] Has 'Terima kasih 🙏'": emptyTickets.includes("Terima kasih 🙏"),
};

let ok = 0, fail = 0;
for (const [k, v] of Object.entries(checks)) {
  console.log(`${v ? "PASS" : "FAIL"}: ${k}`);
  v ? ok++ : fail++;
}
console.log(`\nTotal: ${ok} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
