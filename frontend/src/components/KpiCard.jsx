import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { formatIDR, formatNum } from "@/lib/format";

export const KpiCard = ({ metric }) => {
  const { key, label, value, delta_pct, format, invert } = metric;
  const formatted = format === "currency" ? formatIDR(value) : formatNum(value);
  const hasDelta = delta_pct !== null && delta_pct !== undefined;
  const rising = hasDelta && delta_pct >= 0;
  const good = hasDelta ? (invert ? !rising : rising) : null;

  return (
    <div
      data-testid={`kpi-card-${key}`}
      className="rounded-md border border-[#DEE2E6] bg-white p-4 transition-transform duration-150 hover:-translate-y-0.5"
    >
      <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">{label}</p>
      <p
        data-testid={`kpi-value-${key}`}
        className="mt-2 font-display text-2xl font-extrabold tabular-nums tracking-tight text-[#0A0A0A]"
      >
        {formatted}
      </p>
      <div data-testid={`kpi-delta-${key}`} className="mt-2 flex items-center gap-1.5 text-xs">
        {hasDelta ? (
          <>
            <span
              className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 font-semibold ${
                good ? "bg-[#2F9E44]/10 text-[#2F9E44]" : "bg-[#E03131]/10 text-[#E03131]"
              }`}
            >
              {rising ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {rising ? "+" : ""}
              {delta_pct.toLocaleString("id-ID")}%
            </span>
            <span className="text-gray-400">vs periode lalu</span>
          </>
        ) : (
          <span className="flex items-center gap-1 text-gray-400">
            <Minus className="h-3 w-3" />
            belum ada pembanding
          </span>
        )}
      </div>
    </div>
  );
};
