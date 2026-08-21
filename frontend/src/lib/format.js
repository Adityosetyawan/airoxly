const idr = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const num = new Intl.NumberFormat("id-ID");

export const formatIDR = (v) => idr.format(v ?? 0);
export const formatNum = (v) => num.format(v ?? 0);

export const formatCompactIDR = (v) => {
  if (v == null) return "-";
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 0 })} rb`;
  return String(v);
};

export const formatDateTime = (iso) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

export const ROLE_LABELS = {
  superadmin: "SuperAdmin",
  admin: "Admin",
  sales: "Sales",
};
