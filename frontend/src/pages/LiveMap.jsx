import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { AlertTriangle, RefreshCw, Users, Navigation } from "lucide-react";
import api from "@/lib/api";
import { formatDateTime } from "@/lib/format";

const dotIcon = (bg) =>
  L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${bg};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.45)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

const salesIcon = dotIcon("#0A0A0A");
const customerIcon = dotIcon("#ADB5BD");

const FitBounds = ({ points }) => {
  const map = useMap();
  useEffect(() => {
    if (points.length) map.fitBounds(points, { padding: [40, 40], maxZoom: 14 });
  }, [points, map]);
  return null;
};

const timeAgo = (ts) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 60000));
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins} mnt lalu`;
  return `${Math.floor(mins / 60)} jam ${mins % 60} mnt lalu`;
};

export default function LiveMap() {
  const [showSales, setShowSales] = useState(true);
  const [showCustomers, setShowCustomers] = useState(false);
  const [group, setGroup] = useState("");

  const liveQuery = useQuery({
    queryKey: ["location-live"],
    queryFn: async () => (await api.get("/location/live")).data,
    refetchInterval: 30000,
  });
  const customersQuery = useQuery({
    queryKey: ["customers-geo"],
    queryFn: async () => (await api.get("/customers")).data,
    enabled: showCustomers,
  });

  const sales = useMemo(
    () => (liveQuery.data || []).filter((s) => s.last_location && (!group || s.group_letter === group)),
    [liveQuery.data, group]
  );
  const customers = useMemo(
    () => (showCustomers ? (customersQuery.data || []).filter((c) => c.lat && c.lng) : []),
    [showCustomers, customersQuery.data]
  );
  const groups = [...new Set((liveQuery.data || []).map((s) => s.group_letter).filter(Boolean))].sort();

  const fitPoints = useMemo(() => {
    const pts = [];
    if (showSales) sales.forEach((s) => pts.push([s.last_location.lat, s.last_location.lng]));
    if (showCustomers) customers.slice(0, 400).forEach((c) => pts.push([c.lat, c.lng]));
    return pts;
  }, [sales, customers, showSales, showCustomers]);

  const isLoading = liveQuery.isLoading || (showCustomers && customersQuery.isLoading);
  const isError = liveQuery.isError || (showCustomers && customersQuery.isError);

  return (
    <div data-testid="map-page" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-[#0A0A0A] sm:text-4xl">Peta Live</h1>
          <p className="mt-1 text-sm text-gray-500">
            Posisi sales diperbarui otomatis tiap 30 detik · {sales.length} sales aktif
            {showCustomers ? ` · ${customers.length} pelanggan` : ""}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            data-testid="map-toggle-sales"
            onClick={() => setShowSales(!showSales)}
            className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              showSales ? "border-[#0A0A0A] bg-[#0A0A0A] text-white" : "border-[#DEE2E6] bg-white text-gray-600 hover:border-[#0A0A0A]"
            }`}
          >
            <Navigation className="h-4 w-4" /> Sales Live
          </button>
          <button
            data-testid="map-toggle-customers"
            onClick={() => setShowCustomers(!showCustomers)}
            className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              showCustomers ? "border-[#0A0A0A] bg-[#0A0A0A] text-white" : "border-[#DEE2E6] bg-white text-gray-600 hover:border-[#0A0A0A]"
            }`}
          >
            <Users className="h-4 w-4" /> Pelanggan
          </button>
          <select
            data-testid="map-group-filter"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            className="rounded-full border border-[#DEE2E6] bg-white px-4 py-2 text-sm font-medium text-gray-700 outline-none transition-colors focus:border-[#0A0A0A]"
          >
            <option value="">Semua grup</option>
            {groups.map((g) => (
              <option key={g} value={g}>Grup {g}</option>
            ))}
          </select>
        </div>
      </div>

      {isError && (
        <div data-testid="map-error" className="flex items-center gap-3 rounded-md border border-[#E03131]/40 bg-[#E03131]/5 p-4">
          <AlertTriangle className="h-5 w-5 text-[#E03131]" />
          <p className="flex-1 text-sm text-gray-600">Gagal memuat data peta dari server.</p>
          <button
            data-testid="map-retry-button"
            onClick={() => { liveQuery.refetch(); if (showCustomers) customersQuery.refetch(); }}
            className="flex items-center gap-2 rounded-full bg-[#0A0A0A] px-4 py-2 text-sm font-semibold text-white"
          >
            <RefreshCw className="h-4 w-4" /> Coba Lagi
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="overflow-hidden rounded-md border border-[#DEE2E6] bg-white lg:col-span-3">
          <div data-testid="map-canvas" className="h-[68vh] w-full">
            <MapContainer center={[-7.67, 110.52]} zoom={13} className="h-full w-full" scrollWheelZoom>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitBounds points={fitPoints} />
              {showSales &&
                sales.map((s) => (
                  <Marker key={s.id} position={[s.last_location.lat, s.last_location.lng]} icon={salesIcon}>
                    <Popup>
                      <div className="text-sm">
                        <p className="font-bold">{s.name}</p>
                        <p className="text-gray-600">Kode {s.sales_code} · Grup {s.group_letter}</p>
                        <p className="mt-1 text-xs text-gray-500">Update: {timeAgo(s.last_location.ts)}</p>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              {showCustomers &&
                customers.map((c) => (
                  <Marker key={c.id} position={[c.lat, c.lng]} icon={customerIcon}>
                    <Popup>
                      <div className="text-sm">
                        <p className="font-bold">{c.name}</p>
                        <p className="text-gray-600">{c.address || "—"}</p>
                        <p className="mt-1 text-xs text-gray-500">Sales {c.sales_code || "—"}</p>
                      </div>
                    </Popup>
                  </Marker>
                ))}
            </MapContainer>
          </div>
        </div>

        <div className="rounded-md border border-[#DEE2E6] bg-white">
          <div className="flex items-center justify-between border-b border-[#DEE2E6] px-4 py-3">
            <h2 className="font-display text-base font-bold tracking-tight text-[#0A0A0A]">Sales Aktif</h2>
            {liveQuery.isFetching && <RefreshCw className="h-3.5 w-3.5 animate-spin text-gray-400" />}
          </div>
          {isLoading ? (
            <div data-testid="map-sales-loading" className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-md bg-[#F1F3F5]" />
              ))}
            </div>
          ) : sales.length === 0 ? (
            <p data-testid="map-sales-empty" className="px-4 py-8 text-center text-sm text-gray-500">
              Belum ada posisi sales yang masuk.
            </p>
          ) : (
            <ul data-testid="map-sales-list" className="max-h-[62vh] divide-y divide-[#F1F3F5] overflow-y-auto">
              {sales
                .slice()
                .sort((a, b) => new Date(b.last_location.ts) - new Date(a.last_location.ts))
                .map((s) => (
                  <li key={s.id} data-testid={`map-sales-item-${s.id}`} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <p className="text-sm font-semibold text-[#0A0A0A]">{s.name}</p>
                      <p className="text-xs text-gray-500">{s.sales_code} · Grup {s.group_letter}</p>
                    </div>
                    <span className="text-xs tabular-nums text-gray-400">{timeAgo(s.last_location.ts)}</span>
                  </li>
                ))}
            </ul>
          )}
          <div className="flex items-center gap-4 border-t border-[#DEE2E6] px-4 py-2.5 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#0A0A0A]" /> Sales</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#ADB5BD]" /> Pelanggan</span>
          </div>
        </div>
      </div>
    </div>
  );
}
