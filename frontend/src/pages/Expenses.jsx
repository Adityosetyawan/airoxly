import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Download, Pencil, Trash2 } from "lucide-react";
import api from "@/lib/api";
import { useAuth, formatApiErrorDetail } from "@/context/AuthContext";
import { formatIDR, formatDateTime } from "@/lib/format";
import { downloadCSV } from "@/lib/csv";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field, inputCls } from "@/components/Form";
import { TableState } from "@/components/TableState";

const CATEGORIES = ["BBM", "Operasional", "Gaji", "Utilitas", "Perawatan", "Bahan Baku", "Lainnya"];

const fmtLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const defaultRange = () => {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { date_from: fmtLocal(from), date_to: fmtLocal(to) };
};

const EMPTY_FORM = { category: "Operasional", description: "", amount: "", date: fmtLocal(new Date()) };

export default function Expenses() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const canWrite = ["super_admin", "admin"].includes(user.role);
  const canDelete = user.role === "super_admin";
  const [range, setRange] = useState(defaultRange);
  const [modal, setModal] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const listQuery = useQuery({
    queryKey: ["expenses", range],
    queryFn: async () => (await api.get("/expenses", { params: range })).data,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ mode, id, payload }) =>
      mode === "create" ? api.post("/expenses", payload) : api.patch(`/expenses/${id}`, payload),
    onSuccess: () => {
      toast.success(modal?.mode === "create" ? "Pengeluaran dicatat" : "Pengeluaran diperbarui");
      setModal(null);
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["stats-overview"] });
    },
    onError: (e) => toast.error(formatApiErrorDetail(e.response?.data?.detail)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/expenses/${id}`),
    onSuccess: () => {
      toast.success("Pengeluaran dihapus");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["stats-overview"] });
    },
    onError: (e) => toast.error(formatApiErrorDetail(e.response?.data?.detail)),
  });

  const submit = (e) => {
    e.preventDefault();
    const payload = { category: form.category, description: form.description || null, amount: Number(form.amount) };
    if (modal.mode === "create") payload.date = form.date;
    saveMutation.mutate({ mode: modal.mode, id: modal.item?.id, payload });
  };

  const rows = (listQuery.data || []).slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  const state = listQuery.isLoading ? "loading" : listQuery.isError ? "error" : rows.length === 0 ? "empty" : null;
  const totalAmount = rows.reduce((a, r) => a + (r.amount || 0), 0);

  return (
    <div data-testid="expenses-page" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-[#0A0A0A] sm:text-4xl">Pengeluaran</h1>
          <p className="mt-1 text-sm text-gray-500">
            {rows.length} catatan · total <span className="font-semibold text-[#0A0A0A]">{formatIDR(totalAmount)}</span> pada rentang terpilih.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input data-testid="expense-filter-from" type="date" value={range.date_from} onChange={(e) => setRange({ ...range, date_from: e.target.value })} className={`${inputCls} w-40`} />
          <span className="text-sm text-gray-400">—</span>
          <input data-testid="expense-filter-to" type="date" value={range.date_to} onChange={(e) => setRange({ ...range, date_to: e.target.value })} className={`${inputCls} w-40`} />
          <button
            data-testid="expense-export-csv-button"
            onClick={() => {
              downloadCSV(
                "pengeluaran.csv",
                [
                  { label: "Tanggal", value: "date_only" },
                  { label: "Kategori", value: "category" },
                  { label: "Deskripsi", value: "description" },
                  { label: "Sales", value: "sales_code" },
                  { label: "Jumlah", value: "amount" },
                ],
                rows
              );
              toast.success("CSV pengeluaran diunduh");
            }}
            disabled={!rows.length}
            className="flex items-center gap-2 rounded-full border border-[#DEE2E6] bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-[#0A0A0A] disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> CSV
          </button>
          {canWrite && (
            <button
              data-testid="expense-create-button"
              onClick={() => {
                setForm(EMPTY_FORM);
                setModal({ mode: "create" });
              }}
              className="flex items-center gap-2 rounded-full bg-[#0A0A0A] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2b2b2b]"
            >
              <Plus className="h-4 w-4" /> Catat
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-[#DEE2E6] bg-white">
        <table data-testid="expenses-table" className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#DEE2E6] text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              <th className="px-4 py-2.5">Tanggal</th>
              <th className="px-4 py-2.5">Kategori</th>
              <th className="px-4 py-2.5">Deskripsi</th>
              <th className="px-4 py-2.5">Sales</th>
              <th className="px-4 py-2.5 text-right">Jumlah</th>
              {(canWrite || canDelete) && <th className="px-4 py-2.5 text-right">Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {state ? (
              <TableState state={state} colSpan={6} onRetry={listQuery.refetch} testid="expenses" />
            ) : (
              rows.map((x) => (
                <tr key={x.id} data-testid={`expense-row-${x.id}`} className="border-b border-[#F1F3F5] transition-colors last:border-0 hover:bg-[#F8F9FA]">
                  <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">{formatDateTime(x.date)}</td>
                  <td className="px-4 py-2.5">
                    <span className="rounded-full border border-[#DEE2E6] px-2.5 py-0.5 text-xs font-semibold text-[#0A0A0A]">{x.category}</span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{x.description || "—"}</td>
                  <td className="px-4 py-2.5 text-gray-600">{x.sales_code || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums text-[#0A0A0A]">{formatIDR(x.amount)}</td>
                  {(canWrite || canDelete) && (
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        {canWrite && (
                          <button
                            data-testid={`expense-edit-${x.id}`}
                            onClick={() => {
                              setForm({ category: x.category || "Operasional", description: x.description || "", amount: x.amount ?? "", date: (x.date_only || "").slice(0, 10) });
                              setModal({ mode: "edit", item: x });
                            }}
                            title="Ubah"
                            className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-[#F1F3F5] hover:text-[#0A0A0A]"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button data-testid={`expense-delete-${x.id}`} onClick={() => setDeleting(x)} title="Hapus" className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-[#E03131]/10 hover:text-[#E03131]">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal.mode === "create" ? "Catat Pengeluaran" : "Ubah Pengeluaran"} onClose={() => setModal(null)} testid="expense-form-modal">
          <form onSubmit={submit} className="space-y-4">
            <Field label="Kategori">
              <input data-testid="expense-form-category" list="expense-categories" required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls} />
              <datalist id="expense-categories">
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label="Deskripsi">
              <input data-testid="expense-form-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} placeholder="mis. Bensin armada 30 liter" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Jumlah (Rp)">
                <input data-testid="expense-form-amount" required type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputCls} />
              </Field>
              {modal.mode === "create" && (
                <Field label="Tanggal">
                  <input data-testid="expense-form-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} />
                </Field>
              )}
            </div>
            <button data-testid="expense-form-submit" type="submit" disabled={saveMutation.isPending} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#0A0A0A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2b2b2b] disabled:opacity-60">
              {saveMutation.isPending ? "Menyimpan…" : "Simpan"}
            </button>
          </form>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Hapus Pengeluaran"
          message={`Hapus pengeluaran "${deleting.category}" senilai ${formatIDR(deleting.amount)}? Tindakan ini tidak dapat dibatalkan.`}
          onConfirm={() => deleteMutation.mutate(deleting.id)}
          onClose={() => setDeleting(null)}
          loading={deleteMutation.isPending}
          testid="expense-delete-dialog"
        />
      )}
    </div>
  );
}
