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

const EMPTY_FORM = { name: "", unit: "gln", price: "", order: 0 };

export default function Products() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const canWrite = ["super_admin", "admin"].includes(user.role);
  const canDelete = user.role === "super_admin";
  const [modal, setModal] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const listQuery = useQuery({
    queryKey: ["products"],
    queryFn: async () => (await api.get("/products")).data,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ mode, id, payload }) =>
      mode === "create" ? api.post("/products", payload) : api.patch(`/products/${id}`, payload),
    onSuccess: () => {
      toast.success(modal?.mode === "create" ? "Produk ditambahkan" : "Produk diperbarui");
      setModal(null);
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e) => toast.error(formatApiErrorDetail(e.response?.data?.detail)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/products/${id}`),
    onSuccess: () => {
      toast.success("Produk dihapus");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e) => toast.error(formatApiErrorDetail(e.response?.data?.detail)),
  });

  const submit = (e) => {
    e.preventDefault();
    const payload = { name: form.name, unit: form.unit, price: Number(form.price), order: Number(form.order) || 0 };
    saveMutation.mutate({ mode: modal.mode, id: modal.item?.id, payload });
  };

  const rows = (listQuery.data || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const state = listQuery.isLoading ? "loading" : listQuery.isError ? "error" : rows.length === 0 ? "empty" : null;

  return (
    <div data-testid="products-page" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-[#0A0A0A] sm:text-4xl">Produk</h1>
          <p className="mt-1 text-sm text-gray-500">{rows.length} produk aktif.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            data-testid="product-export-csv-button"
            onClick={() => {
              downloadCSV(
                "produk.csv",
                [
                  { label: "Nama", value: "name" },
                  { label: "Unit", value: "unit" },
                  { label: "Harga", value: "price" },
                  { label: "Urutan", value: "order" },
                ],
                rows
              );
              toast.success("CSV produk diunduh");
            }}
            disabled={!rows.length}
            className="flex items-center gap-2 rounded-full border border-[#DEE2E6] bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-[#0A0A0A] disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> CSV
          </button>
          {canWrite && (
            <button
              data-testid="product-create-button"
              onClick={() => {
                setForm(EMPTY_FORM);
                setModal({ mode: "create" });
              }}
              className="flex items-center gap-2 rounded-full bg-[#0A0A0A] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2b2b2b]"
            >
              <Plus className="h-4 w-4" /> Tambah
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-[#DEE2E6] bg-white">
        <table data-testid="products-table" className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#DEE2E6] text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              <th className="px-4 py-2.5">Urutan</th>
              <th className="px-4 py-2.5">Nama</th>
              <th className="px-4 py-2.5">Unit</th>
              <th className="px-4 py-2.5 text-right">Harga</th>
              <th className="px-4 py-2.5">Dibuat</th>
              {(canWrite || canDelete) && <th className="px-4 py-2.5 text-right">Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {state ? (
              <TableState state={state} colSpan={6} onRetry={listQuery.refetch} testid="products" />
            ) : (
              rows.map((p) => (
                <tr key={p.id} data-testid={`product-row-${p.id}`} className="border-b border-[#F1F3F5] transition-colors last:border-0 hover:bg-[#F8F9FA]">
                  <td className="px-4 py-2.5 tabular-nums text-gray-600">{p.order ?? 0}</td>
                  <td className="px-4 py-2.5 font-medium text-[#0A0A0A]">{p.name}</td>
                  <td className="px-4 py-2.5 text-gray-600">{p.unit}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-[#0A0A0A]">{formatIDR(p.price)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">{p.created_at ? formatDateTime(p.created_at) : "—"}</td>
                  {(canWrite || canDelete) && (
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        {canWrite && (
                          <button
                            data-testid={`product-edit-${p.id}`}
                            onClick={() => {
                              setForm({ name: p.name || "", unit: p.unit || "gln", price: p.price ?? "", order: p.order ?? 0 });
                              setModal({ mode: "edit", item: p });
                            }}
                            title="Ubah"
                            className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-[#F1F3F5] hover:text-[#0A0A0A]"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button data-testid={`product-delete-${p.id}`} onClick={() => setDeleting(p)} title="Hapus" className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-[#E03131]/10 hover:text-[#E03131]">
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
        <Modal title={modal.mode === "create" ? "Tambah Produk" : "Ubah Produk"} onClose={() => setModal(null)} testid="product-form-modal">
          <form onSubmit={submit} className="space-y-4">
            <Field label="Nama Produk">
              <input data-testid="product-form-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Unit">
                <select data-testid="product-form-unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={inputCls}>
                  <option value="gln">gln (galon)</option>
                  <option value="btl">btl (botol)</option>
                  <option value="pcs">pcs</option>
                  <option value="pack">pack</option>
                  <option value="karton">karton</option>
                </select>
              </Field>
              <Field label="Harga (Rp)">
                <input data-testid="product-form-price" required type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={inputCls} />
              </Field>
            </div>
            <Field label="Urutan Tampil">
              <input data-testid="product-form-order" type="number" min="0" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} className={inputCls} />
            </Field>
            <button data-testid="product-form-submit" type="submit" disabled={saveMutation.isPending} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#0A0A0A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2b2b2b] disabled:opacity-60">
              {saveMutation.isPending ? "Menyimpan…" : "Simpan"}
            </button>
          </form>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Hapus Produk"
          message={`Hapus produk "${deleting.name}"? Riwayat transaksi lama tidak terpengaruh, tapi tindakan ini tidak dapat dibatalkan.`}
          onConfirm={() => deleteMutation.mutate(deleting.id)}
          onClose={() => setDeleting(null)}
          loading={deleteMutation.isPending}
          testid="product-delete-dialog"
        />
      )}
    </div>
  );
}
