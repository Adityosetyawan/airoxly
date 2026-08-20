import React, { useEffect, useState } from "react";
import { Package, Plus, Droplet, Trash2 } from "lucide-react";
import { rupiah } from "../mock/mockData";
import { useAuth } from "../context/AuthContext";
import { PageHeader, Panel, Badge } from "../components/common";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "../components/ui/dialog";
import { useToast } from "../hooks/use-toast";
import api from "../api";

const Products = () => {
  const { user } = useAuth();
  const canEdit = ["superadmin", "admin"].includes(user?.role);
  const [products, setProducts] = useState([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    const { data } = await api.get("/products");
    setProducts(data);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!name || !price) return;
    try {
      await api.post("/products", { name, price: +price, stock: +stock || 0, refill: false });
      toast({ title: "Produk ditambahkan", description: name });
      setName(""); setPrice(""); setStock(""); setOpen(false); load();
    } catch (e) { toast({ title: "Gagal", description: e?.response?.data?.detail, variant: "destructive" }); }
  };

  const remove = async (id) => {
    await api.delete(`/products/${id}`);
    toast({ title: "Produk dihapus" });
    load();
  };

  return (
    <div>
      <PageHeader title="Produk" subtitle="Kelola daftar produk air minum" icon={Package}
        action={canEdit &&
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-500 hover:bg-emerald-600"><Plus className="w-4 h-4 mr-1" /> Tambah Produk</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Tambah Produk</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5"><Label>Nama Produk</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Galon Polos 19L" /></div>
                <div className="space-y-1.5"><Label>Harga (Rp)</Label><Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="6000" /></div>
                <div className="space-y-1.5"><Label>Stok Awal</Label><Input type="number" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="100" /></div>
              </div>
              <DialogFooter><Button onClick={add} className="bg-emerald-500 hover:bg-emerald-600">Simpan</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        } />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((p) => (
          <Panel key={p.id} className="hover:shadow-md transition-shadow animate-fade-up">
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <Droplet className="w-6 h-6" />
              </div>
              {canEdit && (
                <button onClick={() => remove(p.id)} className="p-2 rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              )}
            </div>
            <h3 className="font-bold mt-3">{p.name}</h3>
            <p className="text-2xl font-extrabold text-emerald-600 mt-1">{rupiah(p.price)}</p>
            <div className="flex items-center gap-2 mt-3">
              <Badge tone={p.stock > 50 ? "emerald" : "amber"}>Stok: {p.stock}</Badge>
              {p.refill && <Badge tone="blue">Isi Ulang</Badge>}
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
};

export default Products;
