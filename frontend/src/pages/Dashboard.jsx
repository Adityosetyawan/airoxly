import React from "react";
import {
  TrendingUp, ShoppingCart, Users, Package, Wallet, Droplet, Factory, Warehouse, Target,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { OVERVIEW, TRANSACTIONS, SPAREPARTS, rupiah, ROLE_LABELS } from "../mock/mockData";
import { PageHeader, StatCard, Panel, Badge } from "../components/common";

const TrendChart = ({ data }) => {
  const max = Math.max(...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-2 h-44">
      {data.map((d) => (
        <div key={d.day} className="flex-1 flex flex-col items-center gap-2 h-full">
          <div className="w-full flex-1 flex items-end">
            <div className="w-full bg-gradient-to-t from-emerald-500 to-emerald-300 rounded-t-lg transition-all hover:from-emerald-600"
              style={{ height: `${Math.max(6, (d.value / max) * 100)}%` }} title={rupiah(d.value)} />
          </div>
          <span className="text-xs text-muted-foreground font-medium">{d.day}</span>
        </div>
      ))}
    </div>
  );
};

const Dashboard = () => {
  const { user } = useAuth();
  const o = OVERVIEW;
  const hour = new Date().getHours();
  const greet = hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 19 ? "Selamat sore" : "Selamat malam";

  const myTx = TRANSACTIONS.filter((t) => t.salesId === user?.id);
  const mySales = myTx.reduce((s, t) => s + t.total, 0);

  return (
    <div>
      <PageHeader title={`${greet}, ${user?.name?.split(" ")[0]}!`}
        subtitle={`Anda masuk sebagai ${ROLE_LABELS[user?.role]} · ${user?.area}`} icon={Droplet} />

      {(user?.role === "superadmin" || user?.role === "admin") && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Penjualan Hari Ini" value={rupiah(o.todaySales)} sub={`${o.todayTransactions} transaksi`} icon={TrendingUp} />
            <StatCard label="Penjualan Bulan Ini" value={rupiah(o.monthSales)} sub={`${o.monthTransactions} transaksi`} icon={ShoppingCart} tone="blue" />
            <StatCard label="Total Pelanggan" value={o.totalCustomers} sub={`${o.activeSales} sales aktif`} icon={Users} tone="violet" />
            <StatCard label="Total Produk" value={o.totalProducts} sub="jenis produk" icon={Package} tone="amber" />
          </div>

          <div className="grid lg:grid-cols-3 gap-4 mt-4">
            <Panel title="Tren Penjualan Mingguan" className="lg:col-span-2">
              <TrendChart data={o.weeklyTrend} />
            </Panel>
            <Panel title="Produk Terlaris">
              <div className="space-y-4">
                {o.topProducts.map((p) => (
                  <div key={p.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-muted-foreground">{p.sold}</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${p.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </>
      )}

      {user?.role === "sales" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Penjualan Saya" value={rupiah(mySales)} sub={`${myTx.length} transaksi`} icon={TrendingUp} />
            <StatCard label="Target Harian" value={rupiah(user?.target || 0)} sub={`${Math.round((mySales / (user?.target || 1)) * 100)}% tercapai`} icon={Target} tone="blue" />
            <StatCard label="Pelanggan Dilayani" value={new Set(myTx.map((t) => t.customerId)).size} icon={Users} tone="violet" />
            <StatCard label="GPS" value="Aktif" sub="Ping tiap 120 detik" icon={Droplet} tone="emerald" />
          </div>
          <Panel title="Progress Target" className="mt-4">
            <div className="h-4 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full flex items-center justify-end pr-2"
                style={{ width: `${Math.min(100, Math.round((mySales / (user?.target || 1)) * 100))}%` }}>
                <span className="text-[10px] text-white font-bold">{rupiah(mySales)}</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">Target: {rupiah(user?.target || 0)}</p>
          </Panel>
        </>
      )}

      {user?.role === "gudang" && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {SPAREPARTS.map((s) => (
            <StatCard key={s.id} label={s.name} value={s.gudang} sub="stok gudang" icon={Warehouse} tone="blue" />
          ))}
        </div>
      )}

      {user?.role === "produksi" && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {SPAREPARTS.map((s) => (
            <StatCard key={s.id} label={s.name} value={s.produksi} sub="stok produksi" icon={Factory} tone="violet" />
          ))}
        </div>
      )}

      <Panel title="Transaksi Terbaru" className="mt-4">
        <div className="divide-y divide-border">
          {TRANSACTIONS.slice(0, 5).map((t) => (
            <div key={t.id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <ShoppingCart className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{t.customer}</p>
                  <p className="text-xs text-muted-foreground">{t.sales} · {new Date(t.date).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-sm">{rupiah(t.total)}</p>
                <Badge tone={t.status === "lunas" ? "emerald" : "amber"}>{t.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
};

export default Dashboard;
