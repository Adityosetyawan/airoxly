import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FileText, Pencil, Trash2, Search } from "lucide-react";
import api from "@/lib/api";
import { useAuth, formatApiErrorDetail } from "@/context/AuthContext";
import { formatIDR, formatDateTime } from "@/lib/format";
import { downloadCSV, downloadBlob } from "@/lib/csv";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field, inputCls } from "@/components/Form";
import { TableState } from "@/components/TableState";
import { ComboSelect } from "@/components/ComboSelect";

export default function Customers() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const canWrite = ["super_admin", "admin"].includes(user.role);
  const canDelete = user.role === "super_admin";
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfSales, setPdfSales] = useState("");
  const [form, setForm] = useState({ name: "", address: "", wa_number: "" });

  const listQuery = useQuery({
    queryKey: ["customers", q],
    queryFn: async () => (await api.get("/customers", { params: q ? { q } : {} })).data,
  });
  const salesQuery = useQuery({
    queryKey: ["sales-users"],
    queryFn: async () => (await api.get("/users", { params: { role: "sales" } })).data,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, payload }) => api.patch(`/customers/${id}`, payload),
    onSuccess: () => {
      toast.success("Pelanggan diperbarui");
      setModal(null);
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e) => toast.error(formatApiErrorDetail(e.response?.data?.detail)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/customers/${id}`),
    onSuccess: () => {
      toast.success("Pelanggan dihapus");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e) => toast.error(formatApiErrorDetail(e.response?.data?.detail)),
  });

  const openEdit = (c) => {
    setForm({ name: c.name || "", address: c.address || "", wa_number: c.wa_number || "", barcode_id: c.barcode_id || "" });
    setModal({ mode: "edit", item: c });
  };
  const submit = (e) => {
    e.preventDefault();
    const payload = { name: form.name || null, address: form.address || null, wa_number: form.wa_number || null };
    saveMutation.mutate({ id: modal.item.id, payload });
  };

  const exportCSV = () => {
    downloadCSV(
      "pelanggan.csv",
      [
        { label: "No", value: "customer_no" },
        { label: "Nama", value: "name" },
        { label: "Alamat", value: "address" },
        { label: "WA", value: "wa_number" },
        { label: "Sales", value: "sales_code" },
        { label: "Galon Dipinjam", value: "gallon_loans" },
        { label: "Hutang", value: "total_debt" },
        { label: "Total Belanja", value: "total_purchases" },
        { label: "Jumlah Transaksi", value: "purchase_count" },
        { label: "Belanja Terakhir", value: (r) => r.last_purchase_date || "" },
      ],
      listQuery.data || []
    );
    toast.success("CSV pelanggan diunduh");
  };

  const exportPDF = async () => {
    const salesId = user.role === "sales" ? user.id : pdfSales;
    if (!salesId) {
      toast.error("Pilih sales terlebih dahulu");
      return;
    }
    try {
      const res = await api.get("/exports/customers.pdf", { params: { sales_id: salesId }, responseType: "blob" });
      downloadBlob(res.data, "pelanggan.pdf");
      toast.success("PDF pelanggan diunduh");
      setPdfOpen(false);
    } catch (e) {
      toast.error("Gagal mengunduh PDF dari server");
    }
  };

  const rows = listQuery.data || [];
  const state = listQuery.isLoading ? "loading" : listQuery.isError ? "error" : rows.length === 0 ? "empty" : null;
  const salesOptions = (salesQuery.data || []).map((u) => ({ id: u.id, label: `${u.name || u.username} (${u.sales_code || "-"})` }));

  return (
    <div data-testid="customers-page" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-[#0A0A0A] sm:text-4xl">Pelanggan</h1>
          <p className="mt-1 text-sm text-gray-500">{rows.length} pelanggan terdaftar.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              data-testid="customer-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setQ(search)}
              placeholder="Cari nama/alamat…"
              className={`${inputCls} w-56 pl-9`}
            />
          </div>
          <button
            data-testid="customer-export-csv-button"
            onClick={exportCSV}
            disabled={!rows.length}
            className="flex items-center gap-2 rounded-full border border-[#DEE2E6] bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-[#0A0A0A] disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> CSV
          </button>
          <button
            data-testid="customer-export-pdf-button"
            onClick={() => setPdfOpen(true)}
            className="flex items-center gap-2 rounded-full border border-[#DEE2E6] bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-[#0A0A0A]"
          >
            <FileText className="h-4 w-4" /> PDF
          </button>
          {canWrite && (
            <span data-testid="customer-create-hint" className="self-center text-xs text-gray-400">
              Pelanggan baru ditambahkan sales via aplikasi lapangan
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-[#DEE2E6] bg-white">
        <table data-testid="customers-table" className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#DEE2E6] text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              <th className="px-4 py-2.5">No</th>
              <th className="px-4 py-2.5">Nama</th>
              <th className="px-4 py-2.5">Alamat</th>
              <th className="px-4 py-2.5">WA</th>
              <th className="px-4 py-2.5">Sales</th>
              <th className="px-4 py-2.5 text-right">Galon Dipinjam</th>
              <th className="px-4 py-2.5 text-right">Hutang</th>
              <th className="px-4 py-2.5 text-right">Total Belanja</th>
              <th className="px-4 py-2.5">Belanja Terakhir</th>
              {(canWrite || canDelete) && <th className="px-4 py-2.5 text-right">Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {state ? (
              <TableState state={state} colSpan={10} onRetry={listQuery.refetch} testid="customers" />
            ) : (
              rows.map((c) => (
                <tr key={c.id} data-testid={`customer-row-${c.id}`} className="border-b border-[#F1F3F5] transition-colors last:border-0 hover:bg-[#F8F9FA]">
                  <td className="px-4 py-2.5 tabular-nums text-gray-600">{c.customer_no}</td>
                  <td className="px-4 py-2.5 font-medium text-[#0A0A0A]">{c.name}</td>
                  <td className="px-4 py-2.5 text-gray-600">{c.address || "—"}</td>
                  <td className="px-4 py-2.5 text-gray-600">{c.wa_number || "—"}</td>
                  <td className="px-4 py-2.5 text-gray-600">{c.sales_code || "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{c.gallon_loans ?? 0}</td>
                  <td className={`px-4 py-2.5 text-right tabular-nums ${c.total_debt > 0 ? "font-semibold text-[#E03131]" : "text-gray-600"}`}>
                    {formatIDR(c.total_debt)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{formatIDR(c.total_purchases)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">
                    {c.last_purchase_date ? formatDateTime(c.last_purchase_date) : "—"}
                  </td>
                  {(canWrite || canDelete) && (
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        {canWrite && (
                          <button data-testid={`customer-edit-${c.id}`} onClick={() => openEdit(c)} title="Ubah" className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-[#F1F3F5] hover:text-[#0A0A0A]">
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button data-testid={`customer-delete-${c.id}`} onClick={() => setDeleting(c)} title="Hapus" className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-[#E03131]/10 hover:text-[#E03131]">
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
        <Modal title="Ubah Pelanggan" onClose={() => setModal(null)} testid="customer-form-modal">
          <form onSubmit={submit} className="space-y-4">
            <Field label="Nama" testid="customer-form-field-name">
              <input data-testid="customer-form-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Alamat">
              <input data-testid="customer-form-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Nomor WA">
              <input data-testid="customer-form-wa" value={form.wa_number} onChange={(e) => setForm({ ...form, wa_number: e.target.value })} className={inputCls} placeholder="08…" />
            </Field>
            <button data-testid="customer-form-submit" type="submit" disabled={saveMutation.isPending} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#0A0A0A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2b2b2b] disabled:opacity-60">
              {saveMutation.isPending ? "Menyimpan…" : "Simpan"}
            </button>
          </form>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Hapus Pelanggan"
          message={`Hapus pelanggan "${deleting.name}"? Riwayat transaksinya tetap tersimpan, tapi tindakan ini tidak dapat dibatalkan.`}
          onConfirm={() => deleteMutation.mutate(deleting.id)}
          onClose={() => setDeleting(null)}
          loading={deleteMutation.isPending}
          testid="customer-delete-dialog"
        />
      )}

      {pdfOpen && (
        <Modal title="Export PDF Pelanggan" onClose={() => setPdfOpen(false)} testid="customer-pdf-modal">
          <div className="space-y-4">
            {user.role === "sales" ? (
              <p className="text-sm text-gray-600">PDF akan berisi daftar pelanggan milik Anda.</p>
            ) : (
              <Field label="Sales (wajib)">
                <ComboSelect items={salesOptions} value={pdfSales} onChange={setPdfSales} placeholder="Pilih sales…" testid="customer-pdf-sales" />
              </Field>
            )}
            <button data-testid="customer-pdf-download-button" onClick={exportPDF} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#0A0A0A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2b2b2b]">
              <FileText className="h-4 w-4" /> Unduh PDF
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
