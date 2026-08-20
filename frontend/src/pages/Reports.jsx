import React, { useEffect, useMemo, useState } from "react";
import { BarChart3, Download, ShoppingCart, TrendingUp, Wallet, FileText, FileSpreadsheet } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { rupiah } from "../mock/mockData";
import { PageHeader, Panel, StatCard, Badge } from "../components/common";
import { Button } from "../components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { useToast } from "../hooks/use-toast";
import api from "../api";

const RANGE_SCOPE = { "Hari Ini": "today", "Minggu Ini": "week", "Semua": "all" };

const Reports = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [range, setRange] = useState("Semua");
  const [tx, setTx] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const isSales = user?.role === "sales";

  useEffect(() => {
    (async () => {
      const [t, e] = await Promise.all([api.get("/transactions"), api.get("/expenses")]);
      setTx(t.data); setExpenses(e.data);
    })();
  }, []);

  const inScope = (dateStr) => {
    if (range === "Semua") return true;
    const d = new Date(dateStr);
    const now = new Date();
    if (range === "Hari Ini") return d.toDateString() === now.toDateString();
    return (now - d) <= 7 * 24 * 60 * 60 * 1000;
  };

  const filteredTx = useMemo(() => tx.filter((t) => inScope(t.date)), [tx, range]);
  const filteredExp = useMemo(() => expenses.filter((e) => inScope(e.date)), [expenses, range]);

  const totalSales = filteredTx.reduce((s, t) => s + t.total, 0);
  const totalExpense = filteredExp.reduce((s, e) => s + e.amount, 0);
  const totalUtang = filteredTx.filter((t) => t.status === "utang").reduce((s, t) => s + (t.total - t.bayar), 0);

  const download = async (fmt) => {
    try {
      const scope = RANGE_SCOPE[range];
      const res = await api.get(`/reports/export`, { params: { fmt, scope }, responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `Laporan-AirOXLY-${range.replace(/\s/g, "-")}.${fmt === "pdf" ? "pdf" : "csv"}`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
      toast({ title: "Ekspor berhasil", description: `Laporan ${range} (${fmt.toUpperCase()}) diunduh` });
    } catch (e) {
      toast({ title: "Gagal ekspor", description: "Coba lagi", variant: "destructive" });
    }
  };

  return (
    <div>
      <PageHeader title={isSales ? "Laporan Saya" : "Laporan"} subtitle="Ringkasan penjualan & keuangan" icon={BarChart3}
        action={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-emerald-500 hover:bg-emerald-600"><Download className="w-4 h-4 mr-1" /> Ekspor</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => download("csv")}><FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-600" /> Unduh Excel/CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => download("pdf")}><FileText className="w-4 h-4 mr-2 text-rose-600" /> Unduh PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        } />

      <div className="flex gap-2 mb-4 flex-wrap">
        {Object.keys(RANGE_SCOPE).map((r) => (
          <button key={r} onClick={() => setRange(r)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${range === r ? "bg-emerald-500 text-white" : "bg-card border border-border hover:bg-secondary"}`}>{r}</button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Penjualan" value={rupiah(totalSales)} sub={`${filteredTx.length} transaksi`} icon={TrendingUp} />
        <StatCard label="Total Pengeluaran" value={rupiah(totalExpense)} icon={Wallet} tone="rose" />
        <StatCard label="Laba Kotor" value={rupiah(totalSales - totalExpense)} icon={ShoppingCart} tone="blue" />
        <StatCard label="Piutang / Utang" value={rupiah(totalUtang)} icon={Wallet} tone="amber" />
      </div>

      <Panel title="Rincian Transaksi" className="mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-2 font-semibold">Pelanggan</th>
                <th className="py-2 font-semibold">Sales</th>
                <th className="py-2 font-semibold">Tanggal</th>
                <th className="py-2 font-semibold text-right">Total</th>
                <th className="py-2 font-semibold text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredTx.map((t) => (
                <tr key={t.id}>
                  <td className="py-3 font-medium">{t.customer}</td>
                  <td className="py-3 text-muted-foreground">{t.sales}</td>
                  <td className="py-3 text-muted-foreground">{new Date(t.date).toLocaleDateString("id-ID")}</td>
                  <td className="py-3 text-right font-bold">{rupiah(t.total)}</td>
                  <td className="py-3 text-right"><Badge tone={t.status === "lunas" ? "emerald" : "amber"}>{t.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredTx.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Belum ada data untuk periode ini.</p>}
        </div>
      </Panel>
    </div>
  );
};

export default Reports;
