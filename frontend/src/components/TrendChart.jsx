import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { formatIDR, formatCompactIDR } from "@/lib/format";

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-[#DEE2E6] bg-white px-3 py-2 shadow-sm">
      <p className="mb-1 text-xs font-semibold text-[#0A0A0A]">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="text-xs text-gray-600">
          <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          {p.name}:{" "}
          <span className="font-semibold tabular-nums text-[#0A0A0A]">
            {p.dataKey === "transaksi" ? p.value : formatIDR(p.value)}
          </span>
        </p>
      ))}
    </div>
  );
};

export const TrendChart = ({ points, showExpenses }) => {
  const isEmpty = !points.length || points.every((p) => !p.penjualan && !p.pengeluaran && !p.transaksi);

  if (isEmpty) {
    return (
      <div data-testid="trend-chart-empty" className="flex h-80 flex-col items-center justify-center gap-2 text-center">
        <BarChart3 className="h-8 w-8 text-gray-300" />
        <p className="text-sm text-gray-500">Belum ada data pada rentang waktu ini.</p>
      </div>
    );
  }

  return (
    <div data-testid="trend-chart" className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 720, height: 320 }}>
        <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#F1F3F5" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#6c757d" }}
            tickLine={false}
            axisLine={{ stroke: "#DEE2E6" }}
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#6c757d" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatCompactIDR}
            width={56}
          />
          <Tooltip content={<ChartTooltip />} />
          <Area
            type="monotone"
            dataKey="penjualan"
            name="Penjualan"
            stroke="#0A0A0A"
            strokeWidth={2}
            fill="#0A0A0A"
            fillOpacity={0.08}
          />
          {showExpenses && (
            <Area
              type="monotone"
              dataKey="pengeluaran"
              name="Pengeluaran"
              stroke="#E03131"
              strokeWidth={2}
              fill="#E03131"
              fillOpacity={0.06}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
