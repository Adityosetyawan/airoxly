import React, { useState } from "react";
import { Warehouse, Send, ArrowRight } from "lucide-react";
import { SPAREPARTS, TRANSFERS } from "../mock/mockData";
import { useAuth } from "../context/AuthContext";
import { PageHeader, Panel, Badge } from "../components/common";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "../components/ui/dialog";
import { useToast } from "../hooks/use-toast";

const PRESETS = [5, 10, 25, 50, 100];

const WarehousePage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const readOnly = user?.role === "produksi";
  const [parts, setParts] = useState(SPAREPARTS);
  const [transfers, setTransfers] = useState(TRANSFERS);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(SPAREPARTS[0].id);
  const [qty, setQty] = useState(0);
  const [note, setNote] = useState("");

  const part = parts.find((p) => p.id === selected);

  const doTransfer = () => {
    if (qty <= 0 || qty > part.gudang) {
      toast({ title: "Jumlah tidak valid", description: `Stok gudang tersedia: ${part.gudang}`, variant: "destructive" });
      return;
    }
    setParts(parts.map((p) => p.id === selected ? { ...p, gudang: p.gudang - qty, produksi: p.produksi + qty } : p));
    setTransfers([{ id: `tr${Date.now()}`, part: part.name, qty, note, by: user?.name, date: new Date().toISOString() }, ...transfers]);
    toast({ title: "Transfer berhasil", description: `${qty}× ${part.name} dikirim ke Produksi` });
    setQty(0); setNote(""); setOpen(false);
  };

  return (
    <div>
      <PageHeader title={readOnly ? "Stok Produksi" : "Stok Gudang"} subtitle={readOnly ? "Pantau kiriman sparepart dari gudang" : "Kelola stok & kirim ke produksi"} icon={Warehouse}
        action={!readOnly && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-emerald-500 hover:bg-emerald-600"><Send className="w-4 h-4 mr-1" /> Kirim Sparepart ke Produksi</Button></DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Kirim Sparepart ke Produksi</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {parts.map((p) => (
                    <button key={p.id} onClick={() => setSelected(p.id)}
                      className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${selected === p.id ? "bg-emerald-500 text-white" : "bg-secondary hover:bg-accent"}`}>{p.name}</button>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <Label>Jumlah</Label>
                  <Input type="number" value={qty} onChange={(e) => setQty(+e.target.value)} />
                  <div className="flex flex-wrap gap-2 mt-1">
                    {PRESETS.map((v) => <button key={v} onClick={() => setQty((q) => q + v)} className="px-2.5 py-1 rounded-lg bg-secondary text-sm font-semibold hover:bg-accent">+{v}</button>)}
                  </div>
                </div>
                <div className="space-y-1.5"><Label>Catatan (opsional)</Label><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. stok produksi menipis" /></div>
                <div className="bg-emerald-50 rounded-xl p-3 text-sm text-emerald-800">
                  Preview: Gudang jadi <b>{Math.max(0, part.gudang - qty)}</b> · Produksi jadi <b>{part.produksi + (qty > 0 ? qty : 0)}</b>
                </div>
                <Button onClick={doTransfer} className="w-full h-11 bg-emerald-500 hover:bg-emerald-600 font-semibold">Kirim Sekarang</Button>
              </div>
            </DialogContent>
          </Dialog>
        )} />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {parts.map((p) => (
          <Panel key={p.id} className="animate-fade-up">
            <p className="font-bold">{p.name}</p>
            <div className="flex items-center justify-between mt-3 text-sm">
              <div className="text-center flex-1"><p className="text-2xl font-extrabold text-blue-600">{p.gudang}</p><p className="text-xs text-muted-foreground">Gudang</p></div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <div className="text-center flex-1"><p className="text-2xl font-extrabold text-violet-600">{p.produksi}</p><p className="text-xs text-muted-foreground">Produksi</p></div>
            </div>
            <div className="mt-3 pt-3 border-t border-border text-center"><Badge tone="gray">Total: {p.gudang + p.produksi}</Badge></div>
          </Panel>
        ))}
      </div>

      <Panel title="Riwayat Transfer" className="mt-4">
        <div className="divide-y divide-border">
          {transfers.map((t) => (
            <div key={t.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-semibold text-sm">{t.qty}× {t.part}</p>
                <p className="text-xs text-muted-foreground">{t.by} · {new Date(t.date).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}{t.note ? ` · ${t.note}` : ""}</p>
              </div>
              <Badge tone="emerald">Gudang → Produksi</Badge>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
};

export default WarehousePage;
