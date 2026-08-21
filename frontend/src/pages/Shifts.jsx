import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import api from "@/lib/api";
import { formatApiErrorDetail } from "@/context/AuthContext";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field, inputCls } from "@/components/Form";
import { TableState } from "@/components/TableState";

const EMPTY = { key: "", label: "", order: 0 };

export default function Shifts() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const listQuery = useQuery({
    queryKey: ["shifts"],
    queryFn: async () => (await api.get("/shifts")).data,
  });

  const saveMutation = useMutation({
    mutationFn: async (shifts) => api.put("/shifts", { shifts }),
    onSuccess: () => {
      toast.success("Daftar shift diperbarui");
      setModal(null);
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["shifts"] });
    },
    onError: (e) => toast.error(formatApiErrorDetail(e.response?.data?.detail)),
  });

  const shifts = (listQuery.data?.shifts || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const state = listQuery.isLoading ? "loading" : listQuery.isError ? "error" : shifts.length === 0 ? "empty" : null;

  const submit = (e) => {
    e.preventDefault();
    const entry = { key: form.key.trim().toLowerCase(), label: form.label.trim(), order: Number(form.order) || 0 };
    if (!entry.key || !entry.label) { toast.error("Key dan label wajib diisi"); return; }
    let next;
    if (modal.mode === "create") {
      if (shifts.some((s) => s.key === entry.key)) { toast.error("Key shift sudah dipakai"); return; }
      next = [...shifts, entry];
    } else {
      next = shifts.map((s) => (s.key === modal.item.key ? { ...entry, key: modal.item.key } : s));
    }
    saveMutation.mutate(next);
  };

  return (
    <div data-testid="shifts-page" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-[#0A0A0A] sm:text-4xl">Shift</h1>
          <p className="mt-1 text-sm text-gray-500">{shifts.length} shift aktif — dipakai oleh laporan gudang & produksi.</p>
        </div>
        <button data-testid="shift-create-button" onClick={() => { setForm({ ...EMPTY, order: shifts.length + 1 }); setModal({ mode: "create" }); }} className="flex items-center gap-2 rounded-full bg-[#0A0A0A] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2b2b2b]">
          <Plus className="h-4 w-4" /> Tambah Shift
        </button>
      </div>

      <div className="max-w-2xl overflow-x-auto rounded-md border border-[#DEE2E6] bg-white">
        <table data-testid="shifts-table" className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#DEE2E6] text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              <th className="px-4 py-2.5">Urutan</th><th className="px-4 py-2.5">Key</th><th className="px-4 py-2.5">Label</th><th className="px-4 py-2.5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {state ? (
              <TableState state={state} colSpan={4} onRetry={listQuery.refetch} testid="shifts" />
            ) : (
              shifts.map((s) => (
                <tr key={s.key} data-testid={`shift-row-${s.key}`} className="border-b border-[#F1F3F5] last:border-0 hover:bg-[#F8F9FA]">
                  <td className="px-4 py-2.5 tabular-nums text-gray-600">{s.order ?? 0}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{s.key}</td>
                  <td className="px-4 py-2.5 font-medium text-[#0A0A0A]">{s.label}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button data-testid={`shift-edit-${s.key}`} onClick={() => { setForm({ key: s.key, label: s.label, order: s.order ?? 0 }); setModal({ mode: "edit", item: s }); }} title="Ubah" className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-[#F1F3F5] hover:text-[#0A0A0A]"><Pencil className="h-4 w-4" /></button>
                      <button data-testid={`shift-delete-${s.key}`} onClick={() => setDeleting(s)} title="Hapus" className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-[#E03131]/10 hover:text-[#E03131]"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal.mode === "create" ? "Tambah Shift" : `Ubah Shift — ${modal.item.label}`} onClose={() => setModal(null)} testid="shift-form-modal">
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Key (unik, huruf kecil)">
                <input data-testid="shift-form-key" required disabled={modal.mode === "edit"} value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} className={`${inputCls} font-mono disabled:bg-[#F1F3F5] disabled:text-gray-400`} placeholder="mis. pagi" />
              </Field>
              <Field label="Label">
                <input data-testid="shift-form-label" required value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className={inputCls} placeholder="mis. Pagi" />
              </Field>
            </div>
            <Field label="Urutan">
              <input data-testid="shift-form-order" type="number" min="0" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} className={inputCls} />
            </Field>
            <button data-testid="shift-form-submit" type="submit" disabled={saveMutation.isPending} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#0A0A0A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2b2b2b] disabled:opacity-60">
              {saveMutation.isPending ? "Menyimpan…" : "Simpan"}
            </button>
          </form>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog title="Hapus Shift" message={`Hapus shift "${deleting.label}"? Laporan lama yang memakai shift ini tetap tersimpan.`} onConfirm={() => saveMutation.mutate(shifts.filter((s) => s.key !== deleting.key))} onClose={() => setDeleting(null)} loading={saveMutation.isPending} testid="shift-delete-dialog" />
      )}
    </div>
  );
}
