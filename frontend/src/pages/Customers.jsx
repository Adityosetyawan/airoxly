import React, { useEffect, useState } from "react";
import { Users, Plus, Search, Phone, MapPin, Droplet } from "lucide-react";
import { PageHeader, Panel, Badge } from "../components/common";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "../components/ui/dialog";
import { useToast } from "../hooks/use-toast";
import api from "../api";

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", address: "", area: "Area A" });
  const { toast } = useToast();

  const load = async () => { const { data } = await api.get("/customers"); setCustomers(data); };
  useEffect(() => { load(); }, []);

  const filtered = customers.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));

  const add = async () => {
    if (!form.name) return;
    const { data } = await api.post("/customers", form);
    toast({ title: "Pelanggan ditambahkan", description: `${data.name} · ${data.barcode}` });
    setForm({ name: "", phone: "", address: "", area: "Area A" });
    setOpen(false); load();
  };

  return (
    <div>
      <PageHeader title="Pelanggan" subtitle={`${customers.length} pelanggan terdaftar`} icon={Users}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-500 hover:bg-emerald-600"><Plus className="w-4 h-4 mr-1" /> Tambah Pelanggan</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Tambah Pelanggan</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5"><Label>Nama</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nama pelanggan" /></div>
                <div className="space-y-1.5"><Label>No. Telepon</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0812-xxxx-xxxx" /></div>
                <div className="space-y-1.5"><Label>Alamat</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Alamat lengkap" /></div>
              </div>
              <DialogFooter><Button onClick={add} className="bg-emerald-500 hover:bg-emerald-600">Simpan</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        } />

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari pelanggan..." className="pl-9 bg-card" />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((c) => (
          <Panel key={c.id} className="animate-fade-up hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">{c.name}</h3>
              {c.galonPinjam > 0 && <Badge tone="amber">{c.galonPinjam} galon pinjam</Badge>}
            </div>
            <p className="text-xs font-mono text-emerald-600 mt-1">{c.barcode}</p>
            <div className="space-y-1.5 mt-3 text-sm text-muted-foreground">
              <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> {c.phone || "-"}</p>
              <p className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /> {c.address || "-"}</p>
              <p className="flex items-center gap-2"><Droplet className="w-3.5 h-3.5" /> {c.area} · Terakhir beli {new Date(c.lastBuy).toLocaleDateString("id-ID")}</p>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
};

export default Customers;
