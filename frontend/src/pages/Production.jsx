import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import api from "@/lib/api";
import { useAuth, formatApiErrorDetail } from "@/context/AuthContext";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field, inputCls } from "@/components/Form";
import { TableState } from "@/components/TableState";
import { ComboSelect } from "@/components/ComboSelect";

const fmtLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = () => fmtLocal(new Date());
const monthAgo = () => { const d = new Date(); d.setDate(d.getDate() - 29); return fmtLocal(d); };

const NUM_KEYS = ["produksi_galon", "stok_galon_baru", "galon_ganti", "galon_kran", "galon_polos", "sil_ganti", "mur_ganti", "kran_ganti", "stiker_ganti", "stoper_ganti", "karet_kran_ganti", "sisa_pagi", "sisa_siang"];
const EMPTY = { date: today(), shift: "pagi", sales_id: "", destination: "gudang", note: "", is_draft: false, ...Object.fromEntries(NUM_KEYS.map((k) => [k, 0])) };

const NumField = ({ label, k, form, setForm }) => (
  <Field label={label}>
    <input data-testid={`prod-form-${k.replace(/_/g, "-")}`} type="number" min="0" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className={inputCls} />
  </Field>
);

export default function Production() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const canWrite = ["super_admin", "admin", "produksi"].includes(user.role);
  const canDelete = user.role === "super_admin";
  const [range, setRange] = useState({ date_from: monthAgo(), date_to: today() });
  const [shiftFilter, setShiftFilter] = useState("");
  const [modal, setModal] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const listQuery = useQuery({
    queryKey: ["production-daily", range],
    queryFn: async () => (await api.get("/production/daily", { params: range })).data,
  });
  const salesQuery = useQuery({ queryKey: ["sales-users"], queryFn: async () => (await api.get("/users", { params: { role: "sales" } })).data, enabled: canWrite });
  const shiftsQuery = useQuery({ queryKey: ["shifts"], queryFn: async () => (await api.get("/shifts")).data });

  const saveMutation = useMutation({
    mutationFn: async ({ mode, id, payload }) => mode === "create" ? api.post("/production/daily", payload) : api.patch(`/production/daily/${id}`, payload),
    onSuccess: () => { toast.success(modal?.mode === "create" ? "Laporan produksi dicatat" : "Laporan produksi diperbarui"); setModal(null); qc.invalidateQueries({ queryKey: ["production-daily"] }); },
    onError: (e) => toast.error(formatApiErrorDetail(e.response?.data?.detail)),
  });
  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/production/daily/${id}`),
    onSuccess: () => { toast.success("Laporan produksi dihapus"); setDeleting(null); qc.invalidateQueries({ queryKey: ["production-daily"] }); },
    onError: (e) => toast.error(formatApiErrorDetail(e.response?.data?.detail)),
  });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.sales_id) { toast.error("Pilih sales terlebih dahulu"); return; }
    if (modal.mode === "create") {
      let existing = [];
      try {
        const res = await api.get("/production/daily", { params: { date_from: form.date, date_to: form.date, sales_id: form.sales_id } });
        existing = res.data || [];
      } catch { /* pre-check gagal — lanjut tanpa guard */ }
      if (existing.some((x) => x.shift === form.shift)) {
        toast.error("Laporan produksi untuk kombinasi tanggal/shift/sales ini sudah ada. Gunakan tombol ubah pada baris tersebut.");
        return;
      }
    }
    const payload = { ...form, note: form.note || null };
    for (const k of NUM_KEYS) payload[k] = Number(payload[k]) || 0;
    if (modal.mode === "edit") { delete payload.date; delete payload.is_draft; delete payload.destination === undefined; }
    saveMutation.mutate({ mode: modal.mode, id: modal.item?.id, payload });
  };

  const rows = (listQuery.data || []).filter((x) => !shiftFilter || x.shift === shiftFilter);
  const state = listQuery.isLoading ? "loading" : listQuery.isError ? "error" : rows.length === 0 ? "empty" : null;
  const salesOptions = (salesQuery.data || []).map((u) => ({ id: u.id, label: `${u.name || u.username} (${u.sales_code || "-"})` }));
  const shifts = shiftsQuery.data?.shifts || [];
  const totalGalon = rows.reduce((a, x) => a + (x.produksi_galon || 0), 0);

  return (
    <div data-testid="production-page" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-[#0A0A0A] sm:text-4xl">Produksi</h1>
          <p className="mt-1 text-sm text-gray-500">{rows.length} laporan · total <span className="font-semibold text-[#0A0A0A]">{totalGalon.toLocaleString("id-ID")} galon</span> diproduksi pada rentang terpilih.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input data-testid="production-filter-from" type="date" value={range.date_from} onChange={(e) => setRange({ ...range, date_from: e.target.value })} className={`${inputCls} w-40`} />
          <span className="text-sm text-gray-400">—</span>
          <input data-testid="production-filter-to" type="date" value={range.date_to} onChange={(e) => setRange({ ...range, date_to: e.target.value })} className={`${inputCls} w-40`} />
          <select data-testid="production-filter-shift" value={shiftFilter} onChange={(e) => setShiftFilter(e.target.value)} className="rounded-full border border-[#DEE2E6] bg-white px-4 py-2 text-sm font-medium text-gray-700 outline-none focus:border-[#0A0A0A]">
            <option value="">Semua shift</option>
            {shifts.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          {canWrite && (
            <button data-testid="production-create-button" onClick={() => { setForm(EMPTY); setModal({ mode: "create" }); }} className="flex items-center gap-2 rounded-full bg-[#0A0A0A] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2b2b2b]">
              <Plus className="h-4 w-4" /> Catat Produksi
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-[#DEE2E6] bg-white">
        <table data-testid="production-table" className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#DEE2E6] text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              <th className="px-4 py-2.5">Tanggal</th><th className="px-4 py-2.5">Shift</th><th className="px-4 py-2.5">Sales</th><th className="px-4 py-2.5">Kelompok</th><th className="px-4 py-2.5 text-right">Produksi Galon</th><th className="px-4 py-2.5">Tujuan</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5">Oleh</th>
              {(canWrite || canDelete) && <th className="px-4 py-2.5 text-right">Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {state ? (
              <TableState state={state} colSpan={9} onRetry={listQuery.refetch} testid="production" emptyText="Belum ada laporan produksi pada rentang ini." />
            ) : (
              rows.map((x) => (
                <tr key={x.id} data-testid={`production-row-${x.id}`} className="border-b border-[#F1F3F5] last:border-0 hover:bg-[#F8F9FA]">
                  <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">{x.date}</td>
                  <td className="px-4 py-2.5 capitalize text-gray-700">{x.shift}</td>
                  <td className="px-4 py-2.5 font-medium text-[#0A0A0A]">{x.sales_code || "—"}</td>
                  <td className="px-4 py-2.5 text-gray-600">{x.kelompok || "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-[#0A0A0A]">{x.produksi_galon ?? 0}</td>
                  <td className="px-4 py-2.5 capitalize text-gray-600">{x.destination || "—"}</td>
                  <td className="px-4 py-2.5"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${x.is_draft ? "bg-[#F59F00]/15 text-[#8a5a00]" : "bg-[#2F9E44]/10 text-[#2F9E44]"}`}>{x.is_draft ? "Draft" : "Final"}</span></td>
                  <td className="px-4 py-2.5 text-gray-600">{x.created_by_name || "—"}</td>
                  {(canWrite || canDelete) && (
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        {canWrite && (
                          <button data-testid={`production-edit-${x.id}`} onClick={() => { const { id, sales_code, group_letter, kelompok, created_by, created_by_name, created_at, part_qtys, ai_count_before, ai_count_after, ai_confidence, manual_adjust, manual_adjust_before, photo_before, photo_after, ...rest } = x; setForm({ ...EMPTY, ...rest, sales_id: x.sales_id, note: x.note || "" }); setModal({ mode: "edit", item: x }); }} title="Ubah" className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-[#F1F3F5] hover:text-[#0A0A0A]"><Pencil className="h-4 w-4" /></button>
                        )}
                        {canDelete && (
                          <button data-testid={`production-delete-${x.id}`} onClick={() => setDeleting(x)} title="Hapus" className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-[#E03131]/10 hover:text-[#E03131]"><Trash2 className="h-4 w-4" /></button>
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
        <Modal title={modal.mode === "create" ? "Catat Laporan Produksi" : "Ubah Laporan Produksi"} onClose={() => setModal(null)} testid="production-form-modal">
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tanggal"><input data-testid="prod-form-date" type="date" required disabled={modal.mode === "edit"} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={`${inputCls} disabled:bg-[#F1F3F5]`} /></Field>
              <Field label="Shift">
                <select data-testid="prod-form-shift" value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })} className={inputCls}>
                  {shifts.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  {!shifts.length && <option value="pagi">Pagi</option>}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Sales"><ComboSelect items={salesOptions} value={form.sales_id} onChange={(v) => setForm({ ...form, sales_id: v })} placeholder="Pilih sales…" testid="prod-form-sales" /></Field>
              <Field label="Tujuan">
                <select data-testid="prod-form-destination" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} className={inputCls}>
                  <option value="gudang">Gudang</option>
                  <option value="sales">Sales</option>
                </select>
              </Field>
            </div>
            <p className="border-t border-[#F1F3F5] pt-3 text-xs font-semibold uppercase tracking-widest text-gray-500">Hasil Produksi</p>
            <div className="grid grid-cols-3 gap-4">
              <NumField label="Produksi Galon" k="produksi_galon" form={form} setForm={setForm} />
              <NumField label="Stok Galon Baru" k="stok_galon_baru" form={form} setForm={setForm} />
              <NumField label="Galon Ganti" k="galon_ganti" form={form} setForm={setForm} />
              <NumField label="Galon Kran" k="galon_kran" form={form} setForm={setForm} />
              <NumField label="Galon Polos" k="galon_polos" form={form} setForm={setForm} />
            </div>
            <p className="border-t border-[#F1F3F5] pt-3 text-xs font-semibold uppercase tracking-widest text-gray-500">Part Diganti</p>
            <div className="grid grid-cols-3 gap-4">
              <NumField label="Sil" k="sil_ganti" form={form} setForm={setForm} />
              <NumField label="Mur" k="mur_ganti" form={form} setForm={setForm} />
              <NumField label="Kran" k="kran_ganti" form={form} setForm={setForm} />
              <NumField label="Stiker" k="stiker_ganti" form={form} setForm={setForm} />
              <NumField label="Stoper" k="stoper_ganti" form={form} setForm={setForm} />
              <NumField label="Karet Kran" k="karet_kran_ganti" form={form} setForm={setForm} />
            </div>
            <p className="border-t border-[#F1F3F5] pt-3 text-xs font-semibold uppercase tracking-widest text-gray-500">Sisa & Catatan</p>
            <div className="grid grid-cols-2 gap-4">
              <NumField label="Sisa Pagi" k="sisa_pagi" form={form} setForm={setForm} />
              <NumField label="Sisa Siang" k="sisa_siang" form={form} setForm={setForm} />
            </div>
            <Field label="Catatan"><input data-testid="prod-form-note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className={inputCls} /></Field>
            {modal.mode === "create" && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input data-testid="prod-form-draft" type="checkbox" checked={form.is_draft} onChange={(e) => setForm({ ...form, is_draft: e.target.checked })} className="h-4 w-4 accent-[#0A0A0A]" />
                Simpan sebagai draft
              </label>
            )}
            <button data-testid="prod-form-submit" type="submit" disabled={saveMutation.isPending} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#0A0A0A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2b2b2b] disabled:opacity-60">
              {saveMutation.isPending ? "Menyimpan…" : "Simpan"}
            </button>
          </form>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog title="Hapus Laporan Produksi" message={`Hapus laporan produksi ${deleting.date} shift ${deleting.shift} (${deleting.sales_code || "-"})? Tindakan ini tidak dapat dibatalkan.`} onConfirm={() => deleteMutation.mutate(deleting.id)} onClose={() => setDeleting(null)} loading={deleteMutation.isPending} testid="production-delete-dialog" />
      )}
    </div>
  );
}
