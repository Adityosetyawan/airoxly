import React, { useState } from "react";
import { Settings as SettingsIcon, AlertTriangle, Trash2, ShieldCheck } from "lucide-react";
import { PageHeader, Panel } from "../components/common";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "../components/ui/dialog";
import { useToast } from "../hooks/use-toast";

const ResetModal = ({ open, onOpenChange, type }) => {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const phrase = type === "half" ? "RESET PENJUALAN" : "RESET SEMUA";
  const match = text === phrase;

  const del = type === "half"
    ? ["Semua transaksi", "Semua pengeluaran", "Semua laporan", "Riwayat GPS"]
    : ["Semua transaksi", "Semua pengeluaran", "Semua pelanggan", "Semua laporan & GPS"];
  const keep = type === "half"
    ? ["Akun user", "Produk", "Kelola part", "Pelanggan"]
    : ["Akun user", "Produk", "Kelola part"];

  const confirm = () => {
    toast({ title: "Reset dijalankan (mock)", description: `${phrase} berhasil.` });
    setText(""); onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setText(""); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" /> {type === "half" ? "HALF RESET" : "ALL RESET"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm font-semibold text-red-600">TINDAKAN INI TIDAK BISA DIBATALKAN.</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="font-bold text-red-600 mb-1">Yang Dihapus</p>
              <ul className="space-y-0.5 text-muted-foreground list-disc list-inside">{del.map((d) => <li key={d}>{d}</li>)}</ul>
            </div>
            <div>
              <p className="font-bold text-emerald-600 mb-1">Yang Tetap</p>
              <ul className="space-y-0.5 text-muted-foreground list-disc list-inside">{keep.map((k) => <li key={k}>{k}</li>)}</ul>
            </div>
          </div>
          <div className="border border-dashed border-border rounded-xl p-3">
            <p className="text-sm mb-2">Ketik <b className="font-mono">{phrase}</b> untuk konfirmasi:</p>
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={phrase} />
            <p className={`text-xs mt-1.5 ${match ? "text-emerald-600" : "text-muted-foreground"}`}>
              {text === "" ? "Belum diketik" : match ? "✓ Teks cocok" : `Belum cocok (${text.length}/${phrase.length} karakter)`}
            </p>
          </div>
          <Button onClick={confirm} disabled={!match}
            className={`w-full h-11 font-semibold ${match ? "bg-red-600 hover:bg-red-700" : "bg-secondary text-muted-foreground cursor-not-allowed"}`}>
            RESET SEKARANG
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Settings = () => {
  const [half, setHalf] = useState(false);
  const [all, setAll] = useState(false);
  return (
    <div>
      <PageHeader title="Pengaturan" subtitle="Konfigurasi & reset data" icon={SettingsIcon} />

      <Panel title="Informasi Sistem" className="mb-4">
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-600" /> Versi Aplikasi: <b>1.0.0</b></div>
          <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-600" /> Mode: <b>Preview (Mock)</b></div>
        </div>
      </Panel>

      <Panel title="Zona Berbahaya" className="border-red-200">
        <p className="text-sm text-muted-foreground mb-4">Reset data. Pastikan Anda memahami konsekuensinya.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <button onClick={() => setHalf(true)} className="flex items-center gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors text-left">
            <Trash2 className="w-5 h-5 text-amber-600" />
            <div><p className="font-bold text-amber-800">Half Reset</p><p className="text-xs text-amber-700">Hapus data penjualan, simpan master data</p></div>
          </button>
          <button onClick={() => setAll(true)} className="flex items-center gap-3 p-4 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 transition-colors text-left">
            <Trash2 className="w-5 h-5 text-red-600" />
            <div><p className="font-bold text-red-800">All Reset</p><p className="text-xs text-red-700">Hapus hampir semua data transaksional</p></div>
          </button>
        </div>
      </Panel>

      <ResetModal open={half} onOpenChange={setHalf} type="half" />
      <ResetModal open={all} onOpenChange={setAll} type="all" />
    </div>
  );
};

export default Settings;
