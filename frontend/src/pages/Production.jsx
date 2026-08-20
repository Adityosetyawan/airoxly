import React, { useEffect, useState } from "react";
import { Factory, Plus, Droplet } from "lucide-react";
import { PageHeader, Panel, StatCard, Badge } from "../components/common";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "../components/ui/dialog";
import { useToast } from "../hooks/use-toast";
import api from "../api";

const Production = () => {
  const { toast } = useToast();
  const [parts, setParts] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [produced, setProduced] = useState(0);
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(0);

  const load = async () => {
    const [sp, tr] = await Promise.all([api.get("/spareparts"), api.get("/warehouse/transfers")]);
    setParts(sp.data); setTransfers(tr.data);
  };
  useEffect(() => { load(); }, []);

  const galonPart = parts.find((p) => p.name === "Galon Polos");

  const doProduce = () => {
    if (qty <= 0) return;
    if (galonPart && qty > galonPart.produksi) {
      toast({ title: "Stok galon kurang", description: `Tersedia ${galonPart.produksi} galon di produksi`, variant: "destructive" });
      return;
    }
    // catatan produksi bersifat lokal (mock) - pengurangan stok server via transfer
    setProduced((n) => n + qty);
    toast({ title: "Produksi tercatat", description: `${qty} galon selesai diproduksi` });
    setQty(0); setOpen(false);
  };

  return (
    <div>
      <PageHeader title="Produksi" subtitle="Proses produksi galon & pantau stok" icon={Factory}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-emerald-500 hover:bg-emerald-600"><Plus className="w-4 h-4 mr-1" /> Catat Produksi</Button></DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Catat Produksi Galon</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5"><Label>Jumlah Galon</Label><Input type="number" value={qty} onChange={(e) => setQty(+e.target.value)} /></div>
                <p className="text-sm text-muted-foreground">Mencatat jumlah galon yang selesai diproduksi hari ini.</p>
                <Button onClick={doProduce} className="w-full h-11 bg-emerald-500 hover:bg-emerald-600">Simpan</Button>
              </div>
            </DialogContent>
          </Dialog>
        } />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard label="Galon Diproduksi Hari Ini" value={produced} sub="unit" icon={Droplet} />
        {parts.map((p) => (
          <StatCard key={p.id} label={`Stok ${p.name}`} value={p.produksi} sub="di produksi" icon={Factory} tone="violet" />
        ))}
      </div>

      <Panel title="Kiriman dari Gudang">
        <div className="divide-y divide-border">
          {transfers.map((t) => (
            <div key={t.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-semibold text-sm">{t.qty}× {t.part}</p>
                <p className="text-xs text-muted-foreground">{t.by} · {new Date(t.date).toLocaleDateString("id-ID")}</p>
              </div>
              <Badge tone="blue">Diterima</Badge>
            </div>
          ))}
          {transfers.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Belum ada kiriman.</p>}
        </div>
      </Panel>
    </div>
  );
};

export default Production;
