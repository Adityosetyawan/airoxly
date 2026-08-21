import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BarChart3, RefreshCw } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { formatIDR, formatDateTime } from "@/lib/format";
import { KpiCard } from "@/components/KpiCard";
import { TrendChart } from "@/components/TrendChart";

const RANGES = [
  { key: "harian", label: "Harian", desc: "24 jam terakhir" },
  { key: "mingguan", label: "Mingguan", desc: "7 hari terakhir" },
  { key: "bulanan", label: "Bulanan", desc: "30 hari terakhir" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [range, setRange] = useState("mingguan");
  const rangeMeta = RANGES.find((r) => r.key === range);

  const overviewQuery = useQuery({
    queryKey: ["overview", range],
    queryFn: async () => (await api.get("/overview", { params: { range } })).data,
  });
  const trendQuery = useQuery({
    queryKey: ["trend", range],
    queryFn: async () => (await api.get("/reports/trend", { params: { range } })).data,
  });

  const isLoading = overviewQuery.isLoading || trendQuery.isLoading;
  const isError = overviewQuery.isError || trendQuery.isError;
  const metrics = overviewQuery.data?.metrics || [];
  const recent = overviewQuery.data?.recent_transactions || [];
  const metricByKey = Object.fromEntries(metrics.map((m) => [m.key, m]));
  const avgTrx =
    metricByKey.penjualan && metricByKey.transaksi?.value
      ? metricByKey.penjualan.value / metricByKey.transaksi.value
      : null;

  return (
    <div data-testid="dashboard-page" className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-[#0A0A0A] sm:text-4xl">
            Dasbor Overview
          </h1>
          <p data-testid="dashboard-subtitle" className="mt-1 text-sm text-gray-500">
            {user.role === "sales"
              ? "Kinerja Anda — data difilter berdasarkan akun sales di server."
              : "Ringkasan kinerja bisnis Air OXLY"}{" "}
            · {rangeMeta.desc}.
          </p>
        </div>
        <div data-testid="range-tabs" className="flex rounded-full border border-[#DEE2E6] bg-[#F1F3F5] p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              data-testid={`range-tab-${r.key}`}
              onClick={() => setRange(r.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                range === r.key ? "bg-[#0A0A0A] text-white" : "text-gray-600 hover:text-[#0A0A0A]"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div data-testid="dashboard-loading" className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: user.role === "sales" ? 3 : 5 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-md border border-[#DEE2E6] bg-white" />
            ))}
          </div>
          <div className="h-96 animate-pulse rounded-md border border-[#DEE2E6] bg-white" />
        </div>
      )}

      {!isLoading && isError && (
        <div
          data-testid="dashboard-error"
          className="flex flex-col items-start gap-3 rounded-md border border-[#E03131]/40 bg-[#E03131]/5 p-6"
        >
          <div className="flex items-center gap-2 text-[#E03131]">
            <AlertTriangle className="h-5 w-5" />
            <h2 className="font-display text-lg font-bold">Gagal memuat dasbor</h2>
          </div>
          <p className="text-sm text-gray-600">
            Data tidak dapat diambil dari server airoxly. Periksa koneksi backend, lalu coba lagi.
          </p>
          <button
            data-testid="dashboard-retry-button"
            onClick={() => {
              overviewQuery.refetch();
              trendQuery.refetch();
            }}
            className="flex items-center gap-2 rounded-full bg-[#0A0A0A] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2b2b2b]"
          >
            <RefreshCw className="h-4 w-4" />
            Coba Lagi
          </button>
        </div>
      )}

      {!isLoading && !isError && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {metrics.map((m) => (
              <KpiCard key={m.key} metric={m} />
            ))}
          </div>

          <div className="rounded-md border border-[#DEE2E6] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DEE2E6] px-4 py-3">
              <div>
                <h2 className="font-display text-lg font-bold tracking-tight text-[#0A0A0A]">
                  {trendQuery.data?.show_expenses ? "Tren Penjualan vs Pengeluaran" : "Tren Penjualan Anda"}
                </h2>
                <p className="text-xs text-gray-500">
                  {range === "harian" ? "14 hari terakhir" : range === "mingguan" ? "12 minggu terakhir" : "12 bulan terakhir"}
                </p>
              </div>
            </div>
            <div className="p-4">
              <TrendChart
                points={trendQuery.data?.points || []}
                showExpenses={trendQuery.data?.show_expenses}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-md border border-[#DEE2E6] bg-white lg:col-span-2">
              <div className="border-b border-[#DEE2E6] px-4 py-3">
                <h2 className="font-display text-lg font-bold tracking-tight text-[#0A0A0A]">Transaksi Terbaru</h2>
              </div>
              {recent.length === 0 ? (
                <div data-testid="recent-transactions-empty" className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                  <BarChart3 className="h-8 w-8 text-gray-300" />
                  <p className="text-sm text-gray-500">Belum ada transaksi yang tercatat.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table data-testid="recent-transactions-table" className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#DEE2E6] text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        <th className="px-4 py-2.5">Waktu</th>
                        <th className="px-4 py-2.5">Pelanggan</th>
                        {user.role !== "sales" && <th className="px-4 py-2.5">Sales</th>}
                        <th className="px-4 py-2.5 text-right">Item</th>
                        <th className="px-4 py-2.5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((t) => (
                        <tr key={t.id} data-testid={`recent-transaction-row-${t.id}`} className="border-b border-[#F1F3F5] transition-colors last:border-0 hover:bg-[#F8F9FA]">
                          <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">{formatDateTime(t.created_at)}</td>
                          <td className="px-4 py-2.5 font-medium text-[#0A0A0A]">{t.customer_name}</td>
                          {user.role !== "sales" && <td className="px-4 py-2.5 text-gray-600">{t.sales_name}</td>}
                          <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{t.items_count}</td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums text-[#0A0A0A]">
                            {formatIDR(t.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-md border border-[#DEE2E6] bg-white">
              <div className="border-b border-[#DEE2E6] px-4 py-3">
                <h2 className="font-display text-lg font-bold tracking-tight text-[#0A0A0A]">Ringkasan Periode</h2>
              </div>
              <dl data-testid="period-summary" className="divide-y divide-[#F1F3F5]">
                <div className="flex items-center justify-between px-4 py-3">
                  <dt className="text-sm text-gray-500">Periode</dt>
                  <dd className="text-sm font-semibold text-[#0A0A0A]">{rangeMeta.desc}</dd>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <dt className="text-sm text-gray-500">Rata-rata nilai transaksi</dt>
                  <dd data-testid="summary-avg-transaction" className="text-sm font-semibold tabular-nums text-[#0A0A0A]">
                    {avgTrx != null ? formatIDR(Math.round(avgTrx)) : "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <dt className="text-sm text-gray-500">Total transaksi</dt>
                  <dd className="text-sm font-semibold tabular-nums text-[#0A0A0A]">
                    {metricByKey.transaksi ? metricByKey.transaksi.value : "—"}
                  </dd>
                </div>
                {metricByKey.laba_kotor && (
                  <div className="flex items-center justify-between px-4 py-3">
                    <dt className="text-sm text-gray-500">Margin laba kotor</dt>
                    <dd data-testid="summary-gross-margin" className="text-sm font-semibold tabular-nums text-[#0A0A0A]">
                      {metricByKey.penjualan?.value
                        ? `${Math.round((metricByKey.laba_kotor.value / metricByKey.penjualan.value) * 100)}%`
                        : "—"}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
