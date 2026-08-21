import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Download, Pencil, Trash2, X } from "lucide-react";
import api from "@/lib/api";
import { useAuth, formatApiErrorDetail } from "@/context/AuthContext";
import { formatIDR, formatDateTime } from "@/lib/format";
import { downloadCSV } from "@/lib/csv";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field, inputCls } from "@/components/Form";
import { TableState } from "@/components/TableState";
import { ComboSelect } from "@/components/ComboSelect";

const fmtLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const defaultRange = () => {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { date_from: fmtLocal(from), date_to: fmtLocal(to) };
};

export default function Transactions() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const canWrite = ["super_admin", "admin"].includes(user.role);
  const canDelete = user.role === "super_admin";
  const [range, setRange] = useState(defaultRange);
  const [salesFilter, setSalesFilter] = useState("");
  const [modal, setModal] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [customerId, setCustomerId] = useState("");
  const [items, setItems] = useState([]);
  const [bayar, setBayar] = useState("");
  const [pinjam, setPinjam] = useState(0);
  const [kembali, setKembali] = useState(0);

  const params = useMemo(() => {
    const p = { date_from: range.date_from, date_to: range.date_to };
    if (salesFilter && user.role !== "sales") p.sales_id = salesFilter;
    return p;
  }, [range, salesFilter, user.role]);

  const listQuery = useQuery({
    queryKey: ["transactions", params],
    queryFn: async () => (await api.get("/transactions", { params })).data,
  });
  const customersQuery = useQuery({
    queryKey: ["customers-all"],
    queryFn: async () => (await api.get("/customers")).data,
    enabled: canWrite,
  });
  const productsQuery = useQuery({
    queryKey: ["products"],
    queryFn: async () => (await api.get("/products")).data,
    enabled: canWrite,
  });
  const salesQuery = useQuery({
    queryKey: ["sales-users"],
    queryFn: async () => (await api.get("/users", { params: { role: "sales" } })).data,
    enabled: user.role !== "sales",
  });

  const saveMutation = useMutation({
    mutationFn: async ({ mode, id, payload }) =>
      mode === "create" ? api.post("/transactions", payload) : api.patch(`/transactions/${id}`, payload),
    onSuccess: () => {
      toast.success(modal?.mode === "create" ? "Transaksi dicatat" : "Transaksi diperbarui");
      setModal(null);
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["stats-overview"] });
    },
    onError: (e) => toast.error(formatApiErrorDetail(e.response?.data?.detail)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/transactions/${id}`),
    onSuccess: () => {
      toast.success("Transaksi dihapus");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["stats-overview"] });
    },
    onError: (e) => toast.error(formatApiErrorDetail(e.response?.data?.detail)),
  });

  const products = productsQuery.data || [];
  const total = items.reduce((a, i) => a + i.qty * i.price, 0);

  const addItem = () => setItems([...items, { product_id: "", qty: 1 }]);
  const setItem = (idx, patch) => setItems(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));

  const openCreate = () => {
    setCustomerId("");
    setItems([]);
    setBayar("");
    setPinjam(0);
    setKembali(0);
    setModal({ mode: "create" });
  };
  const openEdit = (t) => {
    setItems((t.items || []).map((i) => ({ product_id: i.product_id, qty: i.qty, _name: i.product_name, _unit: i.unit, _price: i.price })));
    setBayar(t.bayar ?? "");
    setPinjam(t.pinjam_galon ?? 0);
    setKembali(t.galon_kembali ?? 0);
    setModal({ mode: "edit", item: t });
  };

  const submit = (e) => {
    e.preventDefault();
    const resolved = items
      .filter((i) => i.product_id && i.qty > 0)
      .map((i) => {
        const p = products.find((x) => x.id === i.product_id);
        const price = p ? p.price : i._price;
        const name = p ? p.name : i._name;
        const unit = p ? p.unit : i._unit;
        return { product_id: i.product_id, product_name: name, unit, qty: Number(i.qty), price, subtotal: Number(i.qty) * price };
      });
    if (!resolved.length) {
      toast.error("Tambahkan minimal satu item produk");
      return;
    }
    const payload = {
      items: resolved,
      bayar: Number(bayar) || 0,
      pinjam_galon: Number(pinjam) || 0,
      galon_kembali: Number(kembali) || 0,
    };
    if (modal.mode === "create") {
      if (!customerId) {
        toast.error("Pilih pelanggan terlebih dahulu");
        return;
      }
      payload.customer_id = customerId;
    }
    saveMutation.mutate({ mode: modal.mode, id: modal.item?.id, payload });
  };

  const rows = (listQuery.data || []).slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  const state = listQuery.isLoading ? "loading" : listQuery.isError ? "error" : rows.length === 0 ? "empty" : null;
  const customerOptions = (customersQuery.data || []).map((c) => ({ id: c.id, label: `${c.name} · ${c.sales_code || "-"}` }));
  const salesOptions = (salesQuery.data || []).map((u) => ({ id: u.id, label: `${u.name || u.username} (${u.sales_code || "-"})` }));
  const colCount = canWrite || canDelete ? 9 : 8;

  return (
    <div data-testid="transactions-page" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-[#0A0A0A] sm:text-4xl">Transaksi</h1>
          <p className="mt-1 text-sm text-gray-500">{rows.length} transaksi pada rentang terpilih.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input data-testid="transaction-filter-from" type="date" value={range.date_from} onChange={(e) => setRange({ ...range, date_from: e.target.value })} className={`${inputCls} w-40`} />
          <span className="text-sm text-gray-400">—</span>
          <input data-testid="transaction-filter-to" type="date" value={range.date_to} onChange={(e) => setRange({ ...range, date_to: e.target.value })} className={`${inputCls} w-40`} />
          {user.role !== "sales" && (
            <div className="w-52">
              <ComboSelect items={salesOptions} value={salesFilter} onChange={setSalesFilter} placeholder="Semua sales" testid="transaction-filter-sales" />
            </div>
          )}
          <button
            data-testid="transaction-export-csv-button"
            onClick={() => {
              downloadCSV(
                "transaksi.csv",
                [
                  { label: "Waktu", value: "date" },
                  { label: "Pelanggan", value: "customer_name" },
                  { label: "Sales", value: "sales_code" },
                  { label: "Item", value: (r) => (r.items || []).reduce((a, i) => a + (i.qty || 0), 0) },
                  { label: "Total", value: "total" },
                  { label: "Bayar", value: "bayar" },
                  { label: "Hutang", value: "new_debt" },
                  { label: "Pinjam Galon", value: "pinjam_galon" },
                  { label: "Galon Kembali", value: "galon_kembali" },
                ],
                rows
              );
              toast.success("CSV transaksi diunduh");
            }}
            disabled={!rows.length}
            className="flex items-center gap-2 rounded-full border border-[#DEE2E6] bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-[#0A0A0A] disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> CSV
          </button>
          {canWrite && (
            <button data-testid="transaction-create-button" onClick={openCreate} className="flex items-center gap-2 rounded-full bg-[#0A0A0A] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2b2b2b]">
              <Plus className="h-4 w-4" /> Catat
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-[#DEE2E6] bg-white">
        <table data-testid="transactions-table" className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#DEE2E6] text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              <th className="px-4 py-2.5">Waktu</th>
              <th className="px-4 py-2.5">Pelanggan</th>
              {user.role !== "sales" && <th className="px-4 py-2.5">Sales</th>}
              <th className="px-4 py-2.5">Item</th>
              <th className="px-4 py-2.5 text-right">Total</th>
              <th className="px-4 py-2.5 text-right">Bayar</th>
              <th className="px-4 py-2.5 text-right">Hutang</th>
              <th className="px-4 py-2.5 text-right">Galon (P/K)</th>
              {(canWrite || canDelete) && <th className="px-4 py-2.5 text-right">Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {state ? (
              <TableState state={state} colSpan={colCount} onRetry={listQuery.refetch} testid="transactions" />
            ) : (
              rows.map((t) => {
                const itemCount = (t.items || []).reduce((a, i) => a + (i.qty || 0), 0);
                const first = t.items?.[0];
                return (
                  <tr key={t.id} data-testid={`transaction-row-${t.id}`} className="border-b border-[#F1F3F5] transition-colors last:border-0 hover:bg-[#F8F9FA]">
                    <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">{formatDateTime(t.date)}</td>
                    <td className="px-4 py-2.5 font-medium text-[#0A0A0A]">{t.customer_name}</td>
                    {user.role !== "sales" && <td className="px-4 py-2.5 text-gray-600">{t.sales_code || "—"}</td>}
                    <td className="px-4 py-2.5 text-gray-600">
                      {first ? `${first.qty}× ${first.product_name}` : "—"}
                      {t.items?.length > 1 && <span className="text-gray-400"> +{t.items.length - 1}</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums text-[#0A0A0A]">{formatIDR(t.total)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-gray-600">{formatIDR(t.bayar)}</td>
                    <td className={`whitespace-nowrap px-4 py-2.5 text-right tabular-nums ${t.new_debt > 0 ? "font-semibold text-[#E03131]" : "text-gray-600"}`}>{formatIDR(t.new_debt)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">
                      {t.pinjam_galon ?? 0}/{t.galon_kembali ?? 0}
                    </td>
                    {(canWrite || canDelete) && (
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end gap-1">
                          {canWrite && (
                            <button data-testid={`transaction-edit-${t.id}`} onClick={() => openEdit(t)} title="Ubah" className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-[#F1F3F5] hover:text-[#0A0A0A]">
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button data-testid={`transaction-delete-${t.id}`} onClick={() => setDeleting(t)} title="Hapus" className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-[#E03131]/10 hover:text-[#E03131]">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal.mode === "create" ? "Catat Transaksi" : "Ubah Transaksi"} onClose={() => setModal(null)} testid="transaction-form-modal">
          <form onSubmit={submit} className="space-y-4">
            {modal.mode === "create" && (
              <Field label="Pelanggan">
                <ComboSelect items={customerOptions} value={customerId} onChange={setCustomerId} placeholder="Pilih pelanggan…" testid="transaction-form-customer" />
              </Field>
            )}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600">Item Produk</label>
                <button type="button" data-testid="transaction-form-add-item" onClick={addItem} className="text-xs font-semibold text-[#0A0A0A] underline underline-offset-2">
                  + Tambah item
                </button>
              </div>
              <div className="space-y-2">
                {items.length === 0 && <p className="rounded-md border border-dashed border-[#DEE2E6] px-3 py-3 text-sm text-gray-400">Belum ada item. Klik &quot;Tambah item&quot;.</p>}
                {items.map((it, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      data-testid={`transaction-form-item-product-${idx}`}
                      value={it.product_id}
                      onChange={(e) => setItem(idx, { product_id: e.target.value })}
                      className={`${inputCls} flex-1`}
                    >
                      <option value="">{it._name || "Pilih produk…"}</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {formatIDR(p.price)}/{p.unit}
                        </option>
                      ))}
                    </select>
                    <input
                      data-testid={`transaction-form-item-qty-${idx}`}
                      type="number"
                      min="1"
                      value={it.qty}
                      onChange={(e) => setItem(idx, { qty: e.target.value })}
                      className={`${inputCls} w-20`}
                    />
                    <button type="button" onClick={() => removeItem(idx)} className="rounded-md p-1.5 text-gray-400 transition-colors hover:text-[#E03131]">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Bayar (Rp)">
                <input data-testid="transaction-form-bayar" type="number" min="0" value={bayar} onChange={(e) => setBayar(e.target.value)} placeholder={String(total)} className={inputCls} />
              </Field>
              <Field label="Pinjam Galon">
                <input data-testid="transaction-form-pinjam" type="number" min="0" value={pinjam} onChange={(e) => setPinjam(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Galon Kembali">
                <input data-testid="transaction-form-kembali" type="number" min="0" value={kembali} onChange={(e) => setKembali(e.target.value)} className={inputCls} />
              </Field>
            </div>
            <div className="flex items-center justify-between rounded-md bg-[#F8F9FA] px-3 py-2.5 text-sm">
              <span className="text-gray-500">Total transaksi</span>
              <span data-testid="transaction-form-total" className="font-display font-bold tabular-nums text-[#0A0A0A]">{formatIDR(total)}</span>
            </div>
            <button data-testid="transaction-form-submit" type="submit" disabled={saveMutation.isPending} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#0A0A0A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2b2b2b] disabled:opacity-60">
              {saveMutation.isPending ? "Menyimpan…" : "Simpan"}
            </button>
          </form>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Hapus Transaksi"
          message={`Hapus transaksi ${deleting.customer_name} senilai ${formatIDR(deleting.total)}? Hutang dan pinjaman galon pelanggan akan disesuaikan. Tindakan ini tidak dapat dibatalkan.`}
          onConfirm={() => deleteMutation.mutate(deleting.id)}
          onClose={() => setDeleting(null)}
          loading={deleteMutation.isPending}
          testid="transaction-delete-dialog"
        />
      )}
    </div>
  );
}
