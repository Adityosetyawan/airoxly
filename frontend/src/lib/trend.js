const MONTHS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

const RANGE_DAYS = { harian: 14, mingguan: 84, bulanan: 366 };

const fmtLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const getDateRange = (rangeKey) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const from = new Date(today);
  from.setDate(from.getDate() - (RANGE_DAYS[rangeKey] - 1));
  return { date_from: fmtLocal(from), date_to: fmtLocal(today) };
};

export function buildTrend(transactions, expenses, rangeKey) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets = [];

  if (rangeKey === "harian") {
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      buckets.push({ start: d, label: `${d.getDate()} ${MONTHS_ID[d.getMonth()]}` });
    }
  } else if (rangeKey === "mingguan") {
    const monday = new Date(today);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    for (let i = 11; i >= 0; i--) {
      const d = new Date(monday);
      d.setDate(d.getDate() - i * 7);
      buckets.push({ start: d, label: `${d.getDate()} ${MONTHS_ID[d.getMonth()]}` });
    }
  } else {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      buckets.push({ start: d, label: `${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}` });
    }
  }

  const points = buckets.map((b) => ({ label: b.label, penjualan: 0, pengeluaran: 0, transaksi: 0 }));
  const origin = buckets[0].start;

  const bucketIndex = (dateStr) => {
    if (!dateStr) return -1;
    const d = new Date(`${dateStr.slice(0, 10)}T00:00:00`);
    if (Number.isNaN(d.getTime())) return -1;
    if (rangeKey === "bulanan") {
      return buckets.findIndex((b) => b.start.getFullYear() === d.getFullYear() && b.start.getMonth() === d.getMonth());
    }
    const diffDays = Math.floor((d - origin) / 86400000);
    return rangeKey === "harian" ? diffDays : Math.floor(diffDays / 7);
  };

  for (const t of transactions) {
    const idx = bucketIndex(t.date_only || t.date);
    if (idx >= 0 && idx < points.length) {
      points[idx].penjualan += t.total || 0;
      points[idx].transaksi += 1;
    }
  }
  for (const e of expenses) {
    const idx = bucketIndex(e.date_only || e.date);
    if (idx >= 0 && idx < points.length) points[idx].pengeluaran += e.amount || 0;
  }
  return points;
}
