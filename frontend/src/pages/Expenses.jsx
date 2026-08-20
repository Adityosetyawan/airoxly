import React, { useEffect, useState } from "react";
import { Wallet, Plus } from "lucide-react";
import { rupiah } from "../mock/mockData";
import { PageHeader, Panel, StatCard, Badge } from "../components/common";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "../components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { useToast } from "../hooks/use-toast";
import api from "../api";

const CATS = ["Transport", "Perawatan", "Bahan", "Gaji", "Lain-lain"];

const Expenses = () => {
  const { toast } = useToast();
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", amount: "", category: "Transport" });
  const total = list.reduce((s, e) => s + e.amount, 0);

  const load = async () => { const { data } = await api.get("/expenses"); setList(data); };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.title || !form.amount) return;
    await api.post("/expenses", { title: form.title, amount: +form.amount, category: form.category });
    toast({ title: "Pengeluaran dicatat", description: `${form.title} · ${rupiah(+form.amount)}` });
    setForm({ title: "", amount: "", category: "Transport" }); setOpen(false); load();
  };

  return (
    <div>
      <PageHeader title="Pengeluaran" subtitle="Catat biaya operasional" icon={Wallet}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-emerald-500 hover:bg-emerald-600"><Plus className="w-4 h-4 mr-1" /> Tambah</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Tambah Pengeluaran</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5"><Label>Keterangan</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="mis. Bensin motor" /></div>
                <div className="space-y-1.5"><Label>Jumlah (Rp)</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="50000" /></div>
                <div className="space-y-1.5"><Label>Kategori</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter><Button onClick={add} className="bg-emerald-500 hover:bg-emerald-600">Simpan</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        } />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <StatCard label="Total Pengeluaran" value={rupiah(total)} sub={`${list.length} catatan`} icon={Wallet} tone="rose" />
      </div>

      <Panel title="Riwayat Pengeluaran">
        <div className="divide-y divide-border">
          {list.map((e) => (
            <div key={e.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-semibold text-sm">{e.title}</p>
                <p className="text-xs text-muted-foreground">{e.by} · {new Date(e.date).toLocaleDateString("id-ID")}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone="gray">{e.category}</Badge>
                <p className="font-bold text-rose-600">- {rupiah(e.amount)}</p>
              </div>
            </div>
          ))}
          {list.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Belum ada pengeluaran.</p>}
        </div>
      </Panel>
    </div>
  );
};

export default Expenses;
