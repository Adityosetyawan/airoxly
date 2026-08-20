import React, { useState } from "react";
import { Factory, Plus, Droplet } from "lucide-react";
import { SPAREPARTS, TRANSFERS, rupiah } from "../mock/mockData";
import { useAuth } from "../context/AuthContext";
import { PageHeader, Panel, StatCard, Badge } from "../components/common";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "../components/ui/dialog";
import { useToast } from "../hooks/use-toast";

const Production = () => {
  const { toast } = useToast();
  const [parts, setParts] = useState(SPAREPARTS);
  const [produced, setProduced] = useState(0);
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(0);

  const galonPart = parts.find((p) => p.name === "Galon Polos");

  const doProduce = () => {
    if (qty <= 0) return;
    if (galonPart && qty > galonPart.produksi) {
      toast({ title: "Stok galon kurang", description: `Tersedia ${galonPart.produksi} galon di produksi`, variant: "destructive" });
      return;
    }
    setParts(parts.map((p) => p.name === "Galon Polos" ? { ...p, produksi: p.produksi - qty } : p));
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
                <p className="text-sm text-muted-foreground">Akan mengurangi stok galon di produksi sebanyak jumlah ini.</p>
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
          {TRANSFERS.map((t) => (
            <div key={t.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-semibold text-sm">{t.qty}× {t.part}</p>
                <p className="text-xs text-muted-foreground">{t.by} · {new Date(t.date).toLocaleDateString("id-ID")}</p>
              </div>
              <Badge tone="blue">Diterima</Badge>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
};

export default Production;
