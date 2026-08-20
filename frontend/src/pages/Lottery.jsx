import React, { useEffect, useState } from "react";
import { Gift, Trophy, Ticket, Calendar } from "lucide-react";
import { PageHeader, Panel, StatCard, Badge } from "../components/common";
import api from "../api";

const Lottery = () => {
  const [l, setL] = useState(null);
  useEffect(() => { (async () => { const { data } = await api.get("/lottery"); setL(data); })(); }, []);
  if (!l || !l.title) return <div><PageHeader title="Undian Berhadiah" subtitle="Program loyalitas pelanggan" icon={Gift} /><p className="text-sm text-muted-foreground">Belum ada undian aktif.</p></div>;
  return (
    <div>
      <PageHeader title="Undian Berhadiah" subtitle="Program loyalitas pelanggan" icon={Gift} />

      <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white p-6 mb-4 relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute -right-16 top-10 w-40 h-40 rounded-full bg-white/10" />
        <div className="relative">
          <Badge tone="gray">{l.active ? "Sedang Berlangsung" : "Selesai"}</Badge>
          <h2 className="text-2xl font-extrabold mt-2">{l.title}</h2>
          <p className="text-emerald-50 mt-1 flex items-center gap-2"><Trophy className="w-4 h-4" /> Hadiah utama: {l.prize}</p>
          <p className="text-emerald-50 mt-1 flex items-center gap-2"><Calendar className="w-4 h-4" /> Pengundian: {new Date(l.drawDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <StatCard label="Total Kupon" value={l.totalCoupons.toLocaleString("id-ID")} icon={Ticket} />
        <StatCard label="Pemenang" value={l.winners.length} icon={Trophy} tone="amber" />
      </div>

      <Panel title="Daftar Pemenang">
        <div className="divide-y divide-border">
          {l.winners.map((w, i) => (
            <div key={w.id} className="flex items-center gap-3 py-3">
              <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold">{i + 1}</div>
              <div className="flex-1">
                <p className="font-semibold text-sm">{w.name}</p>
                <p className="text-xs font-mono text-emerald-600">{w.coupon}</p>
              </div>
              <Badge tone="amber">{w.prize}</Badge>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
};

export default Lottery;
