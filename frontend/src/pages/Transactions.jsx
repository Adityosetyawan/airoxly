import React, { useState, useEffect, useMemo } from "react";
import { ShoppingCart, Plus, Minus, Check, Receipt } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { rupiah } from "../mock/mockData";
import { PageHeader, Panel, Badge } from "../components/common";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "../components/ui/dialog";
import { useToast } from "../hooks/use-toast";
import api from "../api";

const Transactions = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isSales = user?.role === "sales";
  const [txList, setTxList] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [open, setOpen] = useState(false);

  const [customerId, setCustomerId] = useState("");
  const [qtys, setQtys] = useState({});
  const [bayar, setBayar] = useState("");
  const [pinjam, setPinjam] = useState(0);
  const [kembali, setKembali] = useState(0);

  const load = async () => {
    const [tx, pr, cu] = await Promise.all([
      api.get("/transactions"), api.get("/products"), api.get("/customers"),
    ]);
    setTxList(tx.data); setProducts(pr.data); setCustomers(cu.data);
  };
  useEffect(() => { load(); }, []);

  const resetForm = () => { setCustomerId(""); setQtys({}); setBayar(""); setPinjam(0); setKembali(0); };

  const items = useMemo(() => products.filter((p) => (qtys[p.id] || 0) > 0)
    .map((p) => ({ productId: p.id, name: p.name, qty: qtys[p.id], price: p.price })), [qtys, products]);
  const total = items.reduce((s, i) => s + i.qty * i.price, 0);

  const setQty = (id, delta) => setQtys((q) => ({ ...q, [id]: Math.max(0, (q[id] || 0) + delta) }));

  const submit = async () => {
    if (!customerId || items.length === 0) {
      toast({ title: "Lengkapi transaksi", description: "Pilih pelanggan dan minimal 1 produk", variant: "destructive" });
      return;
    }
    try {
      const { data } = await api.post("/transactions", {
        customerId, items, bayar: +bayar || 0, galonPinjam: +pinjam, galonKembali: +kembali,
      });
      toast({ title: "Transaksi tersimpan", description: `${data.customer} · ${rupiah(data.total)} · ${data.status}` });
      resetForm(); setOpen(false); load();
    } catch (e) { toast({ title: "Gagal", description: e?.response?.data?.detail, variant: "destructive" }); }
  };

  return (
    <div>
      <PageHeader title="Transaksi" subtitle={isSales ? "Buat & lihat transaksi Anda" : "Semua transaksi penjualan"} icon={ShoppingCart}
        action={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-500 hover:bg-emerald-600"><Plus className="w-4 h-4 mr-1" /> Transaksi Baru</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Transaksi Baru</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Pelanggan</Label>
                  <Select value={customerId} onValueChange={setCustomerId}>
                    <SelectTrigger><SelectValue placeholder="Pilih pelanggan" /></SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Produk</Label>
                  {products.map((p) => (
                    <div key={p.id} className="flex items-center justify-between bg-secondary/50 rounded-xl px-3 py-2">
                      <div>
                        <p className="text-sm font-semibold">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{rupiah(p.price)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setQty(p.id, -1)} className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center hover:bg-secondary"><Minus className="w-4 h-4" /></button>
                        <span className="w-7 text-center font-bold">{qtys[p.id] || 0}</span>
                        <button onClick={() => setQty(p.id, 1)} className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600"><Plus className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Galon Dipinjam</Label><Input type="number" value={pinjam} onChange={(e) => setPinjam(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Galon Dikembalikan</Label><Input type="number" value={kembali} onChange={(e) => setKembali(e.target.value)} /></div>
                </div>

                <div className="bg-emerald-50 rounded-xl p-3">
                  <div className="flex justify-between font-bold text-lg"><span>Total</span><span className="text-emerald-600">{rupiah(total)}</span></div>
                  {total > 0 && <p className="text-xs text-emerald-700 mt-1">Wajib bayar sesuai belanja: {rupiah(total)}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label>Bayar</Label>
                  <Input type="number" value={bayar} onChange={(e) => setBayar(e.target.value)} placeholder="0" />
                  {total > 0 && (
                    <Button variant="outline" size="sm" className="mt-1" onClick={() => setBayar(String(total))}>Bayar lunas {rupiah(total)}</Button>
                  )}
                </div>

                <Button onClick={submit} className="w-full h-11 bg-emerald-500 hover:bg-emerald-600 font-semibold"><Check className="w-4 h-4 mr-1" /> Simpan Transaksi</Button>
              </div>
            </DialogContent>
          </Dialog>
        } />

      <div className="space-y-3">
        {txList.map((t) => (
          <Panel key={t.id} className="animate-fade-up">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center"><Receipt className="w-5 h-5" /></div>
                <div>
                  <p className="font-bold">{t.customer}</p>
                  <p className="text-xs text-muted-foreground">{t.sales} · {new Date(t.date).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-extrabold text-lg">{rupiah(t.total)}</p>
                <Badge tone={t.status === "lunas" ? "emerald" : "amber"}>{t.status}</Badge>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-2">
              {t.items.map((i) => <Badge key={i.productId} tone="gray">{i.qty}× {i.name}</Badge>)}
              {t.galonPinjam > 0 && <Badge tone="amber">Pinjam {t.galonPinjam} galon</Badge>}
              {t.galonKembali > 0 && <Badge tone="blue">Kembali {t.galonKembali} galon</Badge>}
            </div>
          </Panel>
        ))}
        {txList.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">Belum ada transaksi. Buat transaksi baru.</p>}
      </div>
    </div>
  );
};

export default Transactions;
