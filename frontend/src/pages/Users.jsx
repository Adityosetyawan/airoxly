import React, { useState } from "react";
import { UserCog, Plus, ArrowRightLeft } from "lucide-react";
import { DEMO_USERS, ROLE_LABELS } from "../mock/mockData";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { PageHeader, Panel, Badge } from "../components/common";
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

const roleTone = { superadmin: "violet", admin: "blue", sales: "emerald", gudang: "amber", produksi: "gray" };

const Users = () => {
  const { user, impersonate } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState(DEMO_USERS);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", username: "", role: "sales", area: "Area A" });

  const add = () => {
    if (!form.name || !form.username) return;
    setUsers([...users, { id: `u${Date.now()}`, ...form, password: "123456" }]);
    toast({ title: "User dibuat", description: `${form.name} (${ROLE_LABELS[form.role]})` });
    setForm({ name: "", username: "", role: "sales", area: "Area A" }); setOpen(false);
  };

  const doImpersonate = (u) => {
    impersonate(u);
    toast({ title: "Impersonation aktif", description: `Melihat sebagai ${u.name}` });
    navigate("/");
  };

  return (
    <div>
      <PageHeader title="Kelola User" subtitle="Akun karyawan & hak akses" icon={UserCog}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-emerald-500 hover:bg-emerald-600"><Plus className="w-4 h-4 mr-1" /> Tambah User</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Tambah User</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5"><Label>Nama</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Username</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Peran</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.keys(ROLE_LABELS).map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter><Button onClick={add} className="bg-emerald-500 hover:bg-emerald-600">Simpan</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        } />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map((u) => (
          <Panel key={u.id} className="animate-fade-up">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                {u.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
              </div>
              <div className="flex-1">
                <p className="font-bold">{u.name}</p>
                <p className="text-xs text-muted-foreground">@{u.username} · {u.area}</p>
              </div>
              <Badge tone={roleTone[u.role]}>{ROLE_LABELS[u.role]}</Badge>
            </div>
            {user?.role === "superadmin" && u.id !== user?.id && (
              <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => doImpersonate(u)}>
                <ArrowRightLeft className="w-3.5 h-3.5 mr-1" /> Lihat sebagai user ini
              </Button>
            )}
          </Panel>
        ))}
      </div>
    </div>
  );
};

export default Users;
