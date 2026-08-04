// Unit test for formatReceipt() — verifies:
// - "Nomor Undian" section is NOT emitted even when lottery_tickets provided
// - Core lines (Pembelian, Total, Bayar, Sisa hutang, Total pinjam galon, Terima kasih) remain
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

// Bundle whatsapp.ts -> ESM using esbuild
const bundlePath = "/tmp/whatsapp_bundle.mjs";
// Stub react-native since we don't need it for formatReceipt
const stubDir = "/tmp/rn_stub";
execSync(`mkdir -p ${stubDir}/react-native && echo "export const Linking = { canOpenURL: async()=>true, openURL: async()=>{} }; export const Platform = { OS: 'web', select: (o)=>o.default||o.android||o.ios };" > ${stubDir}/react-native/index.mjs && echo '{"name":"react-native","main":"index.mjs","type":"module"}' > ${stubDir}/react-native/package.json`);

execSync(
  `esbuild /app/frontend/src/whatsapp.ts --bundle --format=esm --platform=neutral --outfile=${bundlePath} --alias:react-native=${stubDir}/react-native/index.mjs --loader:.ts=ts`,
  { stdio: "inherit" }
);

const mod = await import(bundlePath);
const { formatReceipt } = mod;

const out = formatReceipt({
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

console.log("---RECEIPT---");
console.log(out);
console.log("---END---");

const checks = {
  "NO 'Nomor Undian' section": !out.includes("Nomor Undian"),
  "NO '🎁' lottery emoji": !out.includes("🎁"),
  "NO ticket codes leaked": !out.includes("OXLY-ABC123"),
  "Has '*Pembelian:*'": out.includes("*Pembelian:*"),
  "Has 'Total: Rp 60.000'": /Total: Rp\s?60\.000/.test(out),
  "Has 'Bayar: Rp 60.000'": /Bayar: Rp\s?60\.000/.test(out),
  "Has 'Sisa hutang:'": out.includes("Sisa hutang:"),
  "Has 'Total pinjam galon:'": out.includes("Total pinjam galon:"),
  "Has 'Terima kasih 🙏'": out.includes("Terima kasih 🙏"),
  "Has 'Pinjam galon: 1 gln'": out.includes("Pinjam galon: 1 gln"),
  "Has customer 'Budi (No.12)'": out.includes("Budi (No.12)"),
};

let ok = 0, fail = 0;
for (const [k, v] of Object.entries(checks)) {
  console.log(`${v ? "PASS" : "FAIL"}: ${k}`);
  v ? ok++ : fail++;
}
console.log(`\nTotal: ${ok} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
