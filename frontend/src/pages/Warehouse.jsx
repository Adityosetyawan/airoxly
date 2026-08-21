import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, PackagePlus, ArrowRightLeft, ClipboardList } from "lucide-react";
import api from "@/lib/api";
import { useAuth, formatApiErrorDetail } from "@/context/AuthContext";
import { formatDateTime } from "@/lib/format";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field, inputCls } from "@/components/Form";
import { TableState } from "@/components/TableState";
import { ComboSelect } from "@/components/ComboSelect";

const ITEMS = ["Seal", "Mur", "Kran", "Galon Kran", "Galon Polos", "Stiker", "Stoper", "Karet Kran"];
const fmtLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = () => fmtLocal(new Date());
const monthAgo = () => { const d = new Date(); d.setDate(d.getDate() - 29); return fmtLocal(d); };

const DAILY_EMPTY = { date: today(), shift: "pagi", sales_id: "", bawa_pagi: 0, bawa_siang: 0, kosong_pagi: 0, kosong_siang: 0, kosong_kembali_siang: 0, kosong_kembali_sore: 0, sisa_pagi: 0, sisa_siang: 0, note: "", is_draft: false };

const NumField = ({ label, k, form, setForm, testid }) => (
  <Field label={label}>
    <input data-testid={testid} type="number" min="0" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className={inputCls} />
  </Field>
);

export default function Warehouse() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const canWrite = ["super_admin", "admin", "gudang"].includes(user.role);
  const canDelete = user.role === "super_admin";
  const [tab, setTab] = useState("masuk");
  const [range, setRange] = useState({ date_from: monthAgo(), date_to: today() });
  const [modal, setModal] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [dailyForm, setDailyForm] = useState(DAILY_EMPTY);
  const [simpleForm, setSimpleForm] = useState({ date: today(), item: ITEMS[0], qty: 1, note: "" });

  const stockQuery = useQuery({ queryKey: ["warehouse-stock"], queryFn: async () => (await api.get("/warehouse/stock")).data });
  const incomingQuery = useQuery({ queryKey: ["warehouse-incoming", range], queryFn: async () => (await api.get("/warehouse/incoming", { params: range })).data });
  const dailyQuery = useQuery({ queryKey: ["warehouse-daily", range], queryFn: async () => (await api.get("/warehouse/daily", { params: range })).data });
  const salesQuery = useQuery({ queryKey: ["sales-users"], queryFn: async () => (await api.get("/users", { params: { role: "sales" } })).data, enabled: canWrite });
  const shiftsQuery = useQuery({ queryKey: ["shifts"], queryFn: async () => (await api.get("/shifts")).data, enabled: canWrite });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["warehouse-stock"] });
    qc.invalidateQueries({ queryKey: ["warehouse-incoming"] });
    qc.invalidateQueries({ queryKey: ["warehouse-daily"] });
  };

  const dailyMutation = useMutation({
    mutationFn: async ({ mode, id, payload }) => mode === "create" ? api.post("/warehouse/daily", payload) : api.patch(`/warehouse/daily/${id}`, payload),
    onSuccess: () => { toast.success(modal?.mode === "create" ? "Laporan gudang dicatat" : "Laporan gudang diperbarui"); setModal(null); invalidate(); },
    onError: (e) => toast.error(formatApiErrorDetail(e.response?.data?.detail)),
  });
  const simpleMutation = useMutation({
    mutationFn: async ({ kind, payload }) => api.post(kind === "masuk" ? "/warehouse/incoming" : "/warehouse/transfer", payload),
    onSuccess: () => { toast.success("Catatan tersimpan"); setModal(null); invalidate(); },
    onError: (e) => toast.error(formatApiErrorDetail(e.response?.data?.detail)),
  });
  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/warehouse/daily/${id}`),
    onSuccess: () => { toast.success("Laporan gudang dihapus"); setDeleting(null); invalidate(); },
    onError: (e) => toast.error(formatApiErrorDetail(e.response?.data?.detail)),
  });

  const stock = stockQuery.data || {};
  const incoming = incomingQuery.data || [];
  const daily = dailyQuery.data || [];
  const salesOptions = (salesQuery.data || []).map((u) => ({ id: u.id, label: `${u.name || u.username} (${u.sales_code || "-"})` }));
  const shifts = shiftsQuery.data?.shifts || [];

  const submitDaily = async (e) => {
    e.preventDefault();
    if (!dailyForm.sales_id) { toast.error("Pilih sales terlebih dahulu"); return; }
    if (modal.mode === "create") {
      let existing = [];
      try {
        const res = await api.get("/warehouse/daily", { params: { date_from: dailyForm.date, date_to: dailyForm.date, sales_id: dailyForm.sales_id } });
        existing = res.data || [];
      } catch { /* pre-check gagal — lanjut tanpa guard */ }
      if (existing.some((x) => x.shift === dailyForm.shift)) {
        toast.error("Laporan untuk kombinasi tanggal/shift/sales ini sudah ada. Gunakan tombol ubah pada baris tersebut.");
        return;
      }
    }
    const payload = { ...dailyForm, note: dailyForm.note || null };
    for (const k of Object.keys(payload)) if (typeof payload[k] === "string" && !isNaN(payload[k]) && !["date", "shift", "sales_id", "note"].includes(k)) payload[k] = Number(payload[k]);
    if (modal.mode === "edit") { delete payload.date; delete payload.is_draft; }
    dailyMutation.mutate({ mode: modal.mode, id: modal.item?.id, payload });
  };

  const submitSimple = (e) => {
    e.preventDefault();
    const payload = { date: simpleForm.date, qty: Number(simpleForm.qty) };
    if (modal.kind === "masuk") {
      payload.item = simpleForm.item;
      payload.note = simpleForm.note || null;
    } else {
      payload.part_name = simpleForm.item;
      payload.notes = simpleForm.note || null;
    }
    simpleMutation.mutate({ kind: modal.kind, payload });
  };

  const TABS = [
    { key: "masuk", label: "Barang Masuk", icon: PackagePlus },
    { key: "harian", label: "Laporan Harian", icon: ClipboardList },
  ];

  return (
    <div data-testid="warehouse-page" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-[#0A0A0A] sm:text-4xl">Gudang</h1>
          <p className="mt-1 text-sm text-gray-500">Stok bahan, barang masuk, dan laporan harian gudang.</p>
        </div>
        {canWrite && (
          <div className="flex flex-wrap items-center gap-2">
            <button data-testid="warehouse-add-incoming" onClick={() => { setSimpleForm({ date: today(), item: ITEMS[0], qty: 1, note: "" }); setModal({ kind: "masuk" }); }} className="flex items-center gap-2 rounded-full border border-[#DEE2E6] bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-[#0A0A0A]">
              <PackagePlus className="h-4 w-4" /> Barang Masuk
            </button>
            <button data-testid="warehouse-add-transfer" onClick={() => { setSimpleForm({ date: today(), item: ITEMS[0], qty: 1, note: "" }); setModal({ kind: "transfer" }); }} className="flex items-center gap-2 rounded-full border border-[#DEE2E6] bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-[#0A0A0A]">
              <ArrowRightLeft className="h-4 w-4" /> Transfer Sparepart
            </button>
            <button data-testid="warehouse-add-daily" onClick={() => { setDailyForm(DAILY_EMPTY); setModal({ kind: "daily", mode: "create" }); }} className="flex items-center gap-2 rounded-full bg-[#0A0A0A] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2b2b2b]">
              <Plus className="h-4 w-4" /> Laporan Harian
            </button>
          </div>
        )}
      </div>

      <div data-testid="warehouse-stock-grid" className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {stockQuery.isLoading
          ? Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-md border border-[#DEE2E6] bg-white" />)
          : Object.entries(stock).map(([name, qty]) => (
              <div key={name} data-testid={`stock-card-${name.replace(/\s+/g, "-").toLowerCase()}`} className="rounded-md border border-[#DEE2E6] bg-white p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{name}</p>
                <p className="mt-1 font-display text-xl font-extrabold tabular-nums text-[#0A0A0A]">{Number(qty).toLocaleString("id-ID")}</p>
              </div>
            ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-full border border-[#DEE2E6] bg-[#F1F3F5] p-1">
          {TABS.map((t) => (
            <button key={t.key} data-testid={`warehouse-tab-${t.key}`} onClick={() => setTab(t.key)} className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${tab === t.key ? "bg-[#0A0A0A] text-white" : "text-gray-600 hover:text-[#0A0A0A]"}`}>
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input data-testid="warehouse-filter-from" type="date" value={range.date_from} onChange={(e) => setRange({ ...range, date_from: e.target.value })} className={`${inputCls} w-40`} />
          <span className="text-sm text-gray-400">—</span>
          <input data-testid="warehouse-filter-to" type="date" value={range.date_to} onChange={(e) => setRange({ ...range, date_to: e.target.value })} className={`${inputCls} w-40`} />
        </div>
      </div>

      {tab === "masuk" && (
        <div className="overflow-x-auto rounded-md border border-[#DEE2E6] bg-white">
          <table data-testid="warehouse-incoming-table" className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#DEE2E6] text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-2.5">Tanggal</th><th className="px-4 py-2.5">Item</th><th className="px-4 py-2.5 text-right">Qty</th><th className="px-4 py-2.5">Kelompok</th><th className="px-4 py-2.5">Dicatat oleh</th>
              </tr>
            </thead>
            <tbody>
              {incomingQuery.isLoading || incomingQuery.isError || incoming.length === 0 ? (
                <TableState state={incomingQuery.isLoading ? "loading" : incomingQuery.isError ? "error" : "empty"} colSpan={5} onRetry={incomingQuery.refetch} testid="warehouse-incoming" emptyText="Belum ada barang masuk pada rentang ini." />
              ) : (
                incoming.map((x) => (
                  <tr key={x.id} data-testid={`incoming-row-${x.id}`} className="border-b border-[#F1F3F5] last:border-0 hover:bg-[#F8F9FA]">
                    <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">{x.date}</td>
                    <td className="px-4 py-2.5 font-medium text-[#0A0A0A]">{x.item}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{Number(x.qty).toLocaleString("id-ID")}</td>
                    <td className="px-4 py-2.5 text-gray-600">{x.kelompok || "—"}</td>
                    <td className="px-4 py-2.5 text-gray-600">{x.created_by_name || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "harian" && (
        <div className="overflow-x-auto rounded-md border border-[#DEE2E6] bg-white">
          <table data-testid="warehouse-daily-table" className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#DEE2E6] text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-2.5">Tanggal</th><th className="px-4 py-2.5">Shift</th><th className="px-4 py-2.5">Sales</th><th className="px-4 py-2.5 text-right">Bawa P/S</th><th className="px-4 py-2.5 text-right">Kembali</th><th className="px-4 py-2.5 text-right">Sisa P/S</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5">Oleh</th>
                {(canWrite || canDelete) && <th className="px-4 py-2.5 text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {dailyQuery.isLoading || dailyQuery.isError || daily.length === 0 ? (
                <TableState state={dailyQuery.isLoading ? "loading" : dailyQuery.isError ? "error" : "empty"} colSpan={9} onRetry={dailyQuery.refetch} testid="warehouse-daily" emptyText="Belum ada laporan pada rentang ini." />
              ) : (
                daily.map((x) => (
                  <tr key={x.id} data-testid={`daily-row-${x.id}`} className="border-b border-[#F1F3F5] last:border-0 hover:bg-[#F8F9FA]">
                    <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">{x.date}</td>
                    <td className="px-4 py-2.5 capitalize text-gray-700">{x.shift}</td>
                    <td className="px-4 py-2.5 font-medium text-[#0A0A0A]">{x.sales_code || "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{x.bawa_pagi ?? 0}/{x.bawa_siang ?? 0}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{(x.kosong_kembali_siang ?? 0) + (x.kosong_kembali_sore ?? 0)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{x.sisa_pagi ?? 0}/{x.sisa_siang ?? 0}</td>
                    <td className="px-4 py-2.5"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${x.is_draft ? "bg-[#F59F00]/15 text-[#8a5a00]" : "bg-[#2F9E44]/10 text-[#2F9E44]"}`}>{x.is_draft ? "Draft" : "Final"}</span></td>
                    <td className="px-4 py-2.5 text-gray-600">{x.created_by_name || "—"}</td>
                    {(canWrite || canDelete) && (
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end gap-1">
                          {canWrite && (
                            <button data-testid={`daily-edit-${x.id}`} onClick={() => { const { id, sales_code, group_letter, kelompok, created_by, created_by_name, created_at, part_qtys, ...rest } = x; setDailyForm({ ...DAILY_EMPTY, ...rest, sales_id: x.sales_id, note: x.note || "" }); setModal({ kind: "daily", mode: "edit", item: x }); }} title="Ubah" className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-[#F1F3F5] hover:text-[#0A0A0A]"><Pencil className="h-4 w-4" /></button>
                          )}
                          {canDelete && (
                            <button data-testid={`daily-delete-${x.id}`} onClick={() => setDeleting(x)} title="Hapus" className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-[#E03131]/10 hover:text-[#E03131]"><Trash2 className="h-4 w-4" /></button>
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
      )}

      {modal?.kind === "daily" && (
        <Modal title={modal.mode === "create" ? "Laporan Harian Gudang" : "Ubah Laporan Gudang"} onClose={() => setModal(null)} testid="warehouse-daily-modal">
          <form onSubmit={submitDaily} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tanggal"><input data-testid="daily-form-date" type="date" required disabled={modal.mode === "edit"} value={dailyForm.date} onChange={(e) => setDailyForm({ ...dailyForm, date: e.target.value })} className={`${inputCls} disabled:bg-[#F1F3F5]`} /></Field>
              <Field label="Shift">
                <select data-testid="daily-form-shift" value={dailyForm.shift} onChange={(e) => setDailyForm({ ...dailyForm, shift: e.target.value })} className={inputCls}>
                  {shifts.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  {!shifts.length && <option value="pagi">Pagi</option>}
                </select>
              </Field>
            </div>
            <Field label="Sales"><ComboSelect items={salesOptions} value={dailyForm.sales_id} onChange={(v) => setDailyForm({ ...dailyForm, sales_id: v })} placeholder="Pilih sales…" testid="daily-form-sales" /></Field>
            <div className="grid grid-cols-3 gap-4">
              <NumField label="Bawa Pagi" k="bawa_pagi" form={dailyForm} setForm={setDailyForm} testid="daily-form-bawa-pagi" />
              <NumField label="Bawa Siang" k="bawa_siang" form={dailyForm} setForm={setDailyForm} testid="daily-form-bawa-siang" />
              <NumField label="Kosong Pagi" k="kosong_pagi" form={dailyForm} setForm={setDailyForm} testid="daily-form-kosong-pagi" />
              <NumField label="Kosong Siang" k="kosong_siang" form={dailyForm} setForm={setDailyForm} testid="daily-form-kosong-siang" />
              <NumField label="Kembali Siang" k="kosong_kembali_siang" form={dailyForm} setForm={setDailyForm} testid="daily-form-kembali-siang" />
              <NumField label="Kembali Sore" k="kosong_kembali_sore" form={dailyForm} setForm={setDailyForm} testid="daily-form-kembali-sore" />
              <NumField label="Sisa Pagi" k="sisa_pagi" form={dailyForm} setForm={setDailyForm} testid="daily-form-sisa-pagi" />
              <NumField label="Sisa Siang" k="sisa_siang" form={dailyForm} setForm={setDailyForm} testid="daily-form-sisa-siang" />
            </div>
            <Field label="Catatan"><input data-testid="daily-form-note" value={dailyForm.note} onChange={(e) => setDailyForm({ ...dailyForm, note: e.target.value })} className={inputCls} /></Field>
            {modal.mode === "create" && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input data-testid="daily-form-draft" type="checkbox" checked={dailyForm.is_draft} onChange={(e) => setDailyForm({ ...dailyForm, is_draft: e.target.checked })} className="h-4 w-4 accent-[#0A0A0A]" />
                Simpan sebagai draft
              </label>
            )}
            <button data-testid="daily-form-submit" type="submit" disabled={dailyMutation.isPending} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#0A0A0A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2b2b2b] disabled:opacity-60">
              {dailyMutation.isPending ? "Menyimpan…" : "Simpan"}
            </button>
          </form>
        </Modal>
      )}

      {(modal?.kind === "masuk" || modal?.kind === "transfer") && (
        <Modal title={modal.kind === "masuk" ? "Catat Barang Masuk" : "Catat Transfer Sparepart"} onClose={() => setModal(null)} testid="warehouse-simple-modal">
          <form onSubmit={submitSimple} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tanggal"><input data-testid="simple-form-date" type="date" required value={simpleForm.date} onChange={(e) => setSimpleForm({ ...simpleForm, date: e.target.value })} className={inputCls} /></Field>
              <Field label={modal.kind === "masuk" ? "Item" : "Part"}>
                <select data-testid="simple-form-item" value={simpleForm.item} onChange={(e) => setSimpleForm({ ...simpleForm, item: e.target.value })} className={inputCls}>
                  {ITEMS.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Qty"><input data-testid="simple-form-qty" type="number" min="1" required value={simpleForm.qty} onChange={(e) => setSimpleForm({ ...simpleForm, qty: e.target.value })} className={inputCls} /></Field>
            <Field label="Catatan"><input data-testid="simple-form-note" value={simpleForm.note} onChange={(e) => setSimpleForm({ ...simpleForm, note: e.target.value })} className={inputCls} /></Field>
            <button data-testid="simple-form-submit" type="submit" disabled={simpleMutation.isPending} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#0A0A0A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2b2b2b] disabled:opacity-60">
              {simpleMutation.isPending ? "Menyimpan…" : "Simpan"}
            </button>
          </form>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog title="Hapus Laporan Gudang" message={`Hapus laporan ${deleting.date} shift ${deleting.shift} (${deleting.sales_code || "-"})? Tindakan ini tidak dapat dibatalkan.`} onConfirm={() => deleteMutation.mutate(deleting.id)} onClose={() => setDeleting(null)} loading={deleteMutation.isPending} testid="warehouse-delete-dialog" />
      )}
    </div>
  );
}
