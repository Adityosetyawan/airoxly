import React from "react";
import { BookOpen, Download, ChevronRight } from "lucide-react";
import { PageHeader, Panel } from "../components/common";
import { Button } from "../components/ui/button";
import { useToast } from "../hooks/use-toast";

const SECTIONS = [
  { t: "Login & Peran", d: "Cara masuk aplikasi dan penjelasan peran Super Admin, Admin, Sales, Gudang, Produksi." },
  { t: "Membuat Transaksi", d: "Langkah membuat transaksi baru: pilih pelanggan, tambah produk, catat galon pinjam/kembali, dan pembayaran." },
  { t: "Kelola Pelanggan", d: "Menambah pelanggan, barcode otomatis, dan melihat riwayat pembelian." },
  { t: "Stok & Transfer Sparepart", d: "Gudang mengirim sparepart ke Produksi, dan pemantauan stok terpisah." },
  { t: "Laporan & Ekspor", d: "Melihat laporan penjualan harian/mingguan/bulanan dan mengekspor data." },
  { t: "Reset Data", d: "Half Reset vs All Reset — apa yang dihapus dan yang tetap tersimpan." },
];

const Guide = () => {
  const { toast } = useToast();
  return (
    <div>
      <PageHeader title="Buku Panduan" subtitle="Panduan penggunaan aplikasi Air OXLY" icon={BookOpen} />

      <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 mb-4 flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-emerald-800 font-semibold">Butuh versi cetak? Unduh panduan lengkap dalam format PDF.</p>
        <Button className="bg-emerald-500 hover:bg-emerald-600" onClick={() => toast({ title: "Unduh PDF", description: "Panduan PDF (mock)" })}>
          <Download className="w-4 h-4 mr-1" /> Download PDF
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {SECTIONS.map((s, i) => (
          <Panel key={s.t} className="animate-fade-up hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-sm">{i + 1}</div>
              <div className="flex-1">
                <p className="font-bold flex items-center justify-between">{s.t} <ChevronRight className="w-4 h-4 text-muted-foreground" /></p>
                <p className="text-sm text-muted-foreground mt-1">{s.d}</p>
              </div>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
};

export default Guide;
