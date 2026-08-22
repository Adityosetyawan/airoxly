import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, Download, MessageCircle, Search } from "lucide-react";
import api from "@/lib/api";
import { formatIDR, formatDateTime } from "@/lib/format";
import { downloadCSV } from "@/lib/csv";
import { TableState } from "@/components/TableState";
import { inputCls } from "@/components/Form";

const DAY_MS = 86400000;
const PRESETS = [3, 7, 14, 30];

const normalizeWA = (raw) => {
  if (!raw) return null;
  let n = String(raw).replace(/\D/g, "");
  if (n.startsWith("0")) n = `62${n.slice(1)}`;
  else if (n.startsWith("8")) n = `62${n}`;
  return n.length >= 9 ? n : null;
};

const waMessage = (c, days) =>
  encodeURIComponent(
    `Halo ${c.name || "Pelanggan"}, kami dari Air OXLY. ` +
      (days == null
        ? "Kami melihat Anda belum pernah melakukan pemesanan. "
        : `Sudah ${days} hari sejak pemesanan terakhir Anda. `) +
      "Apakah stok air minum Anda masih cukup? Silakan balas pesan ini bila ingin memesan kembali. Terima kasih."
  );

export default function Reminders() {
  const [days, setDays] = useState(7);
  const [custom, setCustom] = useState("");
  const [search, setSearch] = useState("");

  const listQuery = useQuery({
    queryKey: ["customers"],
    queryFn: async () => (await api.get("/customers")).data,
  });

  const threshold = custom !== "" && Number(custom) > 0 ? Number(custom) : days;
  const now = Date.now();

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (listQuery.data || [])
      .map((c) => {
        const t = c.last_purchase_date ? new Date(c.last_purchase_date).getTime() : null;
        const d = t ? Math.floor((now - t) / DAY_MS) : null;
        return { ...c, daysSince: d };
      })
      .filter((c) => c.daysSince == null || c.daysSince >= threshold)
      .filter((c) => !q || (c.name || "").toLowerCase().includes(q) || (c.address || "").toLowerCase().includes(q))
      .sort((a, b) => {
        if (a.daysSince == null) return 1;
        if (b.daysSince == null) return -1;
        return b.daysSince - a.daysSince;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listQuery.data, threshold, search]);

  const exportCSV = () => {
    downloadCSV(
      "reminder-pelanggan.csv",
      [
        { label: "No", value: "customer_no" },
        { label: "Nama", value: "name" },
        { label: "WA", value: "wa_number" },
        { label: "Sales", value: "sales_code" },
        { label: "Belanja Terakhir", value: (r) => r.last_purchase_date || "Belum pernah" },
        { label: "Hari Tanpa Order", value: (r) => (r.daysSince == null ? "-" : r.daysSince) },
        { label: "Total Belanja", value: "total_purchases" },
        { label: "Hutang", value: "total_debt" },
      ],
      rows
    );
    toast.success("CSV reminder diunduh");
  };

  const state = listQuery.isLoading ? "loading" : listQuery.isError ? "error" : rows.length === 0 ? "empty" : null;

  return (
    <div data-testid="reminders-page" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-[#0A0A0A] sm:text-4xl">
            Reminder Pelanggan
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {rows.length} pelanggan belum order ≥ {threshold} hari.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              data-testid="reminder-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama/alamat…"
              className={`${inputCls} w-52 pl-9`}
            />
          </div>
          <button
            data-testid="reminder-export-csv-button"
            onClick={exportCSV}
            disabled={!rows.length}
            className="flex items-center gap-2 rounded-full border border-[#DEE2E6] bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-[#0A0A0A] disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> CSV
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Ambang hari:</span>
        {PRESETS.map((p) => (
          <button
            key={p}
            data-testid={`reminder-threshold-${p}`}
            onClick={() => { setDays(p); setCustom(""); }}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              custom === "" && days === p
                ? "border-[#0A0A0A] bg-[#0A0A0A] text-white"
                : "border-[#DEE2E6] bg-white text-gray-700 hover:border-[#0A0A0A]"
            }`}
          >
            {p} hari
          </button>
        ))}
        <input
          data-testid="reminder-threshold-custom"
          type="number"
          min="1"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Kustom…"
          className={`${inputCls} w-28`}
        />
      </div>

      <div className="overflow-x-auto rounded-md border border-[#DEE2E6] bg-white">
        <table data-testid="reminders-table" className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#DEE2E6] text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              <th className="px-4 py-2.5">No</th>
              <th className="px-4 py-2.5">Nama</th>
              <th className="px-4 py-2.5">WA</th>
              <th className="px-4 py-2.5">Sales</th>
              <th className="px-4 py-2.5">Order Terakhir</th>
              <th className="px-4 py-2.5">Tanpa Order</th>
              <th className="px-4 py-2.5 text-right">Total Belanja</th>
              <th className="px-4 py-2.5 text-right">Hutang</th>
              <th className="px-4 py-2.5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {state ? (
              <TableState state={state} colSpan={9} onRetry={listQuery.refetch} testid="reminders" />
            ) : (
              rows.map((c) => {
                const wa = normalizeWA(c.wa_number);
                return (
                  <tr key={c.id} data-testid={`reminder-row-${c.id}`} className="border-b border-[#F1F3F5] transition-colors last:border-0 hover:bg-[#F8F9FA]">
                    <td className="px-4 py-2.5 tabular-nums text-gray-600">{c.customer_no}</td>
                    <td className="px-4 py-2.5 font-medium text-[#0A0A0A]">{c.name}</td>
                    <td className="px-4 py-2.5 text-gray-600">{c.wa_number || "—"}</td>
                    <td className="px-4 py-2.5 text-gray-600">{c.sales_code || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">
                      {c.last_purchase_date ? formatDateTime(c.last_purchase_date) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      {c.daysSince == null ? (
                        <span data-testid={`reminder-badge-${c.id}`} className="rounded-full bg-[#F1F3F5] px-2.5 py-0.5 text-xs font-semibold text-gray-500">
                          Belum pernah order
                        </span>
                      ) : (
                        <span
                          data-testid={`reminder-badge-${c.id}`}
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            c.daysSince >= 30
                              ? "bg-[#E03131]/10 text-[#E03131]"
                              : c.daysSince >= 14
                                ? "bg-[#F08C00]/10 text-[#D9480F]"
                                : "bg-[#F1F3F5] text-gray-600"
                          }`}
                        >
                          {c.daysSince} hari
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{formatIDR(c.total_purchases)}</td>
                    <td className={`px-4 py-2.5 text-right tabular-nums ${c.total_debt > 0 ? "font-semibold text-[#E03131]" : "text-gray-600"}`}>
                      {formatIDR(c.total_debt)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {wa ? (
                        <a
                          data-testid={`reminder-wa-${c.id}`}
                          href={`https://wa.me/${wa}?text=${waMessage(c, c.daysSince)}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Kirim pengingat via WhatsApp"
                          className="inline-flex items-center gap-1.5 rounded-full bg-[#2B8A3E] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#237032]"
                        >
                          <MessageCircle className="h-3.5 w-3.5" /> WA
                        </a>
                      ) : (
                        <span data-testid={`reminder-wa-missing-${c.id}`} className="text-xs text-gray-400">Tanpa WA</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {!state && rows.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-gray-400">
          <Bell className="h-3.5 w-3.5" /> Tombol WA membuka WhatsApp dengan pesan pengingat yang sudah terisi otomatis.
        </p>
      )}
    </div>
  );
}
