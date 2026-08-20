import React, { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Navigation, Clock, RefreshCw, Route } from "lucide-react";
import { PageHeader, Panel, Badge } from "../components/common";
import { Button } from "../components/ui/button";
import { useAuth } from "../context/AuthContext";
import api from "../api";

const PALETTE = ["#10B981", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444"];

const salesIcon = (name, color) =>
  L.divIcon({
    className: "aox-marker",
    html: `<div style="position:relative;transform:translate(-50%,-100%)">
      <div style="width:36px;height:36px;border-radius:50%;background:${color};border:4px solid #fff;box-shadow:0 4px 10px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center">
        <svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='#fff' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polygon points='3 11 22 2 13 21 11 13 3 11'/></svg>
      </div>
      <div style="position:absolute;top:38px;left:50%;transform:translateX(-50%);white-space:nowrap;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:1px 7px;font-size:11px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,.1)">${name}</div>
    </div>`,
    iconSize: [36, 36],
    iconAnchor: [0, 0],
  });

const FitBounds = ({ coords }) => {
  const map = useMap();
  useEffect(() => {
    if (coords.length > 0) {
      map.fitBounds(L.latLngBounds(coords).pad(0.25), { maxZoom: 15 });
    }
  }, [coords, map]);
  return null;
};

const hhmm = (iso) => {
  try { return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }); }
  catch { return "-"; }
};

const LiveMap = () => {
  const { user } = useAuth();
  const [points, setPoints] = useState([]);
  const [trails, setTrails] = useState([]);
  const [showTrail, setShowTrail] = useState(true);
  const [selected, setSelected] = useState("all");
  const [updatedAt, setUpdatedAt] = useState(null);
  const timer = useRef(null);

  const load = async () => {
    try {
      const [loc, hist] = await Promise.all([api.get("/locations"), api.get("/locations/history")]);
      setPoints(loc.data);
      setTrails(hist.data);
      setUpdatedAt(new Date());
    } catch (e) { /* ignore */ }
  };

  useEffect(() => {
    load();
    timer.current = setInterval(load, 15000);
    return () => clearInterval(timer.current);
  }, []);

  const colorOf = (salesId) => {
    const idx = trails.findIndex((t) => t.salesId === salesId);
    return PALETTE[(idx >= 0 ? idx : points.findIndex((p) => p.id === salesId)) % PALETTE.length];
  };

  const shownPoints = selected === "all" ? points : points.filter((p) => p.id === selected);
  const shownTrails = selected === "all" ? trails : trails.filter((t) => t.salesId === selected);

  const allCoords = useMemo(() => {
    const c = [];
    if (showTrail) shownTrails.forEach((t) => t.points.forEach((p) => c.push([p.lat, p.lng])));
    shownPoints.forEach((p) => c.push([p.lat, p.lng]));
    return c;
  }, [shownTrails, shownPoints, showTrail]);

  const center = points[0] ? [points[0].lat, points[0].lng] : [-6.2088, 106.8456];

  const sinceMin = (iso) => {
    try {
      const diff = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
      return diff <= 0 ? "baru saja" : `${diff} menit lalu`;
    } catch { return "-"; }
  };

  return (
    <div>
      <PageHeader title="Peta Live" subtitle="Lokasi & jejak rute sales (ping tiap 120 detik, 08:00–17:00)" icon={MapPin}
        action={<Button variant="outline" onClick={load}><RefreshCw className="w-4 h-4 mr-1" /> Segarkan</Button>} />

      {/* Kontrol filter */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button onClick={() => setSelected("all")}
          className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${selected === "all" ? "bg-emerald-500 text-white" : "bg-card border border-border hover:bg-secondary"}`}>Semua Sales</button>
        {trails.map((t) => (
          <button key={t.salesId} onClick={() => setSelected(t.salesId)}
            className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors flex items-center gap-1.5 ${selected === t.salesId ? "text-white" : "bg-card border border-border hover:bg-secondary"}`}
            style={selected === t.salesId ? { background: colorOf(t.salesId) } : {}}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: colorOf(t.salesId) }} /> {t.name}
          </button>
        ))}
        <button onClick={() => setShowTrail((s) => !s)}
          className={`ml-auto px-3 py-1.5 rounded-full text-sm font-semibold flex items-center gap-1.5 transition-colors ${showTrail ? "bg-emerald-100 text-emerald-700" : "bg-card border border-border text-muted-foreground"}`}>
          <Route className="w-4 h-4" /> {showTrail ? "Jejak Aktif" : "Jejak Nonaktif"}
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Panel className="lg:col-span-2 p-0 overflow-hidden">
          <MapContainer center={center} zoom={13} style={{ height: 520, width: "100%", borderRadius: 16 }} scrollWheelZoom>
            <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

            {showTrail && shownTrails.map((t) => {
              const color = colorOf(t.salesId);
              const line = t.points.map((p) => [p.lat, p.lng]);
              const start = t.points[0];
              return (
                <React.Fragment key={`trail-${t.salesId}`}>
                  <Polyline positions={line} pathOptions={{ color, weight: 4, opacity: 0.75 }} />
                  {start && (
                    <CircleMarker center={[start.lat, start.lng]} radius={6}
                      pathOptions={{ color: "#fff", weight: 2, fillColor: color, fillOpacity: 1 }}>
                      <Popup><b>{t.name}</b><br />Mulai: {hhmm(start.ts)}</Popup>
                    </CircleMarker>
                  )}
                </React.Fragment>
              );
            })}

            {shownPoints.map((p) => (
              <Marker key={p.id} position={[p.lat, p.lng]} icon={salesIcon(p.name, colorOf(p.id))}>
                <Popup><b>{p.name}</b><br />Ping: {sinceMin(p.lastPing)}<br />{p.lat.toFixed(4)}, {p.lng.toFixed(4)}</Popup>
              </Marker>
            ))}

            <FitBounds coords={allCoords} />
          </MapContainer>
        </Panel>

        <Panel title="Sales & Jejak Hari Ini">
          <div className="space-y-3">
            {trails.map((t) => {
              const color = colorOf(t.salesId);
              const first = t.points[0]; const last = t.points[t.points.length - 1];
              return (
                <div key={t.salesId} className="bg-secondary/50 rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ background: color }} />
                    <p className="font-semibold text-sm flex-1">{t.name}</p>
                    <Badge tone="emerald">aktif</Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Route className="w-3 h-3" /> {t.points.length} titik</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {first ? hhmm(first.ts) : "-"}–{last ? hhmm(last.ts) : "-"}</span>
                  </div>
                </div>
              );
            })}
            {trails.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Belum ada jejak lokasi hari ini.</p>}
          </div>
          {updatedAt && <p className="text-xs text-muted-foreground mt-4">Diperbarui: {updatedAt.toLocaleTimeString("id-ID")}</p>}
        </Panel>
      </div>
    </div>
  );
};

export default LiveMap;
