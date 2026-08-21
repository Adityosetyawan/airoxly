import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Ban, CheckCircle2, Search } from "lucide-react";
import api from "@/lib/api";
import { formatApiErrorDetail } from "@/context/AuthContext";
import { ROLE_LABELS } from "@/lib/format";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field, inputCls } from "@/components/Form";
import { TableState } from "@/components/TableState";

const ROLES = ["super_admin", "admin", "sales", "produksi", "gudang"];
const EMPTY_FORM = { username: "", password: "", role: "sales", name: "", sales_code: "", group_letter: "", wa_number: "" };

export default function Users() {
  const qc = useQueryClient();
  const [roleFilter, setRoleFilter] = useState("");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [toggling, setToggling] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const listQuery = useQuery({
    queryKey: ["users", roleFilter],
    queryFn: async () => (await api.get("/users", { params: roleFilter ? { role: roleFilter } : {} })).data,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ mode, id, payload }) =>
      mode === "create" ? api.post("/users", payload) : api.patch(`/users/${id}`, payload),
    onSuccess: () => {
      toast.success(modal?.mode === "create" ? "Pengguna ditambahkan" : "Pengguna diperbarui");
      setModal(null);
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e) => toast.error(formatApiErrorDetail(e.response?.data?.detail)),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, disabled }) => api.patch(`/users/${id}`, { disabled }),
    onSuccess: (_, vars) => {
      toast.success(vars.disabled ? "Pengguna dinonaktifkan" : "Pengguna diaktifkan kembali");
      setToggling(null);
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e) => toast.error(formatApiErrorDetail(e.response?.data?.detail)),
  });

  const submit = (e) => {
    e.preventDefault();
    if (modal.mode === "create") {
      const payload = { username: form.username.trim(), password: form.password, role: form.role };
      for (const k of ["name", "sales_code", "group_letter", "wa_number"]) if (form[k]) payload[k] = form[k];
      saveMutation.mutate({ mode: "create", payload });
    } else {
      const payload = { role: form.role };
      for (const k of ["name", "sales_code", "group_letter", "wa_number"]) payload[k] = form[k] || null;
      if (form.password) payload.password = form.password;
      saveMutation.mutate({ mode: "edit", id: modal.item.id, payload });
    }
  };

  const rows = (listQuery.data || []).filter(
    (u) =>
      !search ||
      (u.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.username || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.sales_code || "").toLowerCase().includes(search.toLowerCase())
  );
  const state = listQuery.isLoading ? "loading" : listQuery.isError ? "error" : rows.length === 0 ? "empty" : null;

  return (
    <div data-testid="users-page" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-[#0A0A0A] sm:text-4xl">Pengguna & Peran</h1>
          <p className="mt-1 text-sm text-gray-500">{rows.length} pengguna · hanya SuperAdmin yang dapat mengelola.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              data-testid="user-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama/username…"
              className={`${inputCls} w-52 pl-9`}
            />
          </div>
          <select
            data-testid="user-filter-role"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-full border border-[#DEE2E6] bg-white px-4 py-2 text-sm font-medium text-gray-700 outline-none transition-colors focus:border-[#0A0A0A]"
          >
            <option value="">Semua peran</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
          <button
            data-testid="user-create-button"
            onClick={() => {
              setForm(EMPTY_FORM);
              setModal({ mode: "create" });
            }}
            className="flex items-center gap-2 rounded-full bg-[#0A0A0A] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2b2b2b]"
          >
            <Plus className="h-4 w-4" /> Tambah
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-[#DEE2E6] bg-white">
        <table data-testid="users-table" className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#DEE2E6] text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              <th className="px-4 py-2.5">Username</th>
              <th className="px-4 py-2.5">Nama</th>
              <th className="px-4 py-2.5">Peran</th>
              <th className="px-4 py-2.5">Kode Sales</th>
              <th className="px-4 py-2.5">Grup</th>
              <th className="px-4 py-2.5">WA</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {state ? (
              <TableState state={state} colSpan={8} onRetry={listQuery.refetch} testid="users" />
            ) : (
              rows.map((u) => (
                <tr key={u.id} data-testid={`user-row-${u.id}`} className={`border-b border-[#F1F3F5] transition-colors last:border-0 hover:bg-[#F8F9FA] ${u.disabled ? "opacity-50" : ""}`}>
                  <td className="px-4 py-2.5 font-medium text-[#0A0A0A]">{u.username}</td>
                  <td className="px-4 py-2.5 text-gray-700">{u.name || "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className="rounded-full border border-[#DEE2E6] px-2.5 py-0.5 text-xs font-semibold text-[#0A0A0A]">
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{u.sales_code || "—"}</td>
                  <td className="px-4 py-2.5 text-gray-600">{u.group_letter || "—"}</td>
                  <td className="px-4 py-2.5 text-gray-600">{u.wa_number || "—"}</td>
                  <td className="px-4 py-2.5">
                    <span data-testid={`user-status-${u.id}`} className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${u.disabled ? "bg-[#E03131]/10 text-[#E03131]" : "bg-[#2F9E44]/10 text-[#2F9E44]"}`}>
                      {u.disabled ? "Nonaktif" : "Aktif"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button
                        data-testid={`user-edit-${u.id}`}
                        onClick={() => {
                          setForm({
                            username: u.username, password: "", role: u.role,
                            name: u.name || "", sales_code: u.sales_code || "",
                            group_letter: u.group_letter || "", wa_number: u.wa_number || "",
                          });
                          setModal({ mode: "edit", item: u });
                        }}
                        title="Ubah"
                        className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-[#F1F3F5] hover:text-[#0A0A0A]"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        data-testid={`user-toggle-${u.id}`}
                        onClick={() => setToggling(u)}
                        title={u.disabled ? "Aktifkan" : "Nonaktifkan"}
                        className={`rounded-md p-1.5 transition-colors ${u.disabled ? "text-[#2F9E44] hover:bg-[#2F9E44]/10" : "text-gray-500 hover:bg-[#E03131]/10 hover:text-[#E03131]"}`}
                      >
                        {u.disabled ? <CheckCircle2 className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal.mode === "create" ? "Tambah Pengguna" : `Ubah Pengguna — ${modal.item.username}`} onClose={() => setModal(null)} testid="user-form-modal">
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Username">
                <input data-testid="user-form-username" required disabled={modal.mode === "edit"} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className={`${inputCls} disabled:bg-[#F1F3F5] disabled:text-gray-400`} />
              </Field>
              <Field label={modal.mode === "create" ? "Password" : "Password Baru (opsional)"}>
                <input data-testid="user-form-password" type="password" required={modal.mode === "create"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputCls} placeholder={modal.mode === "edit" ? "Kosongkan bila tetap" : ""} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nama">
                <input data-testid="user-form-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Peran">
                <select data-testid="user-form-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inputCls}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Kode Sales">
                <input data-testid="user-form-sales-code" value={form.sales_code} onChange={(e) => setForm({ ...form, sales_code: e.target.value })} className={inputCls} placeholder="mis. E1" />
              </Field>
              <Field label="Grup">
                <input data-testid="user-form-group" value={form.group_letter} onChange={(e) => setForm({ ...form, group_letter: e.target.value })} className={inputCls} placeholder="mis. E" />
              </Field>
              <Field label="Nomor WA">
                <input data-testid="user-form-wa" value={form.wa_number} onChange={(e) => setForm({ ...form, wa_number: e.target.value })} className={inputCls} placeholder="08…" />
              </Field>
            </div>
            <button data-testid="user-form-submit" type="submit" disabled={saveMutation.isPending} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#0A0A0A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2b2b2b] disabled:opacity-60">
              {saveMutation.isPending ? "Menyimpan…" : "Simpan"}
            </button>
          </form>
        </Modal>
      )}

      {toggling && (
        <ConfirmDialog
          title={toggling.disabled ? "Aktifkan Pengguna" : "Nonaktifkan Pengguna"}
          message={
            toggling.disabled
              ? `Aktifkan kembali akun "${toggling.username}"? Pengguna akan bisa masuk lagi.`
              : `Nonaktifkan akun "${toggling.username}"? Pengguna tidak akan bisa masuk sampai diaktifkan kembali. Data tidak dihapus.`
          }
          onConfirm={() => toggleMutation.mutate({ id: toggling.id, disabled: !toggling.disabled })}
          onClose={() => setToggling(null)}
          loading={toggleMutation.isPending}
          testid="user-toggle-dialog"
        />
      )}
    </div>
  );
}
