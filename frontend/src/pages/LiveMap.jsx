import React, { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Navigation, Clock, RefreshCw } from "lucide-react";
import { PageHeader, Panel, Badge } from "../components/common";
import { Button } from "../components/ui/button";
import api from "../api";

const salesIcon = (name) =>
  L.divIcon({
    className: "aox-marker",
    html: `<div style="position:relative;transform:translate(-50%,-100%)">
      <div style="width:38px;height:38px;border-radius:50%;background:#10B981;border:4px solid #fff;box-shadow:0 4px 10px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center">
        <svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='#fff' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polygon points='3 11 22 2 13 21 11 13 3 11'/></svg>
      </div>
      <div style="position:absolute;top:40px;left:50%;transform:translateX(-50%);white-space:nowrap;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:1px 7px;font-size:11px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,.1)">${name}</div>
    </div>`,
    iconSize: [38, 38],
    iconAnchor: [0, 0],
  });

const FitBounds = ({ points }) => {
  const map = useMap();
  useEffect(() => {
    if (points.length > 0) {
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds.pad(0.4), { maxZoom: 14 });
    }
  }, [points, map]);
  return null;
};

const LiveMap = () => {
  const [points, setPoints] = useState([]);
  const [updatedAt, setUpdatedAt] = useState(null);
  const timer = useRef(null);

  const load = async () => {
    try {
      const { data } = await api.get("/locations");
      setPoints(data);
      setUpdatedAt(new Date());
    } catch (e) { /* ignore */ }
  };

  useEffect(() => {
    load();
    timer.current = setInterval(load, 15000); // auto-refresh 15 detik
    return () => clearInterval(timer.current);
  }, []);

  const center = points[0] ? [points[0].lat, points[0].lng] : [-6.2088, 106.8456];

  const sinceMin = (iso) => {
    try {
      const diff = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
      return diff <= 0 ? "baru saja" : `${diff} menit lalu`;
    } catch { return "-"; }
  };

  return (
    <div>
      <PageHeader title="Peta Live" subtitle="Lokasi sales real-time (auto-refresh 15 detik)" icon={MapPin}
        action={<Button variant="outline" onClick={load}><RefreshCw className="w-4 h-4 mr-1" /> Segarkan</Button>} />
      <div className="grid lg:grid-cols-3 gap-4">
        <Panel className="lg:col-span-2 p-0 overflow-hidden">
          <MapContainer center={center} zoom={12} style={{ height: 480, width: "100%", borderRadius: 16 }} scrollWheelZoom>
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {points.map((p) => (
              <Marker key={p.id} position={[p.lat, p.lng]} icon={salesIcon(p.name)}>
                <Popup>
                  <b>{p.name}</b><br />Ping: {sinceMin(p.lastPing)}<br />
                  {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                </Popup>
              </Marker>
            ))}
            <FitBounds points={points} />
          </MapContainer>
        </Panel>
        <Panel title="Sales Aktif">
          <div className="space-y-3">
            {points.map((g) => (
              <div key={g.id} className="flex items-center gap-3 bg-secondary/50 rounded-xl p-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center"><Navigation className="w-5 h-5" /></div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{g.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> {sinceMin(g.lastPing)}</p>
                </div>
                <Badge tone="emerald">{g.status}</Badge>
              </div>
            ))}
            {points.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Belum ada sales yang mengirim lokasi.</p>}
          </div>
          {updatedAt && <p className="text-xs text-muted-foreground mt-4">Diperbarui: {updatedAt.toLocaleTimeString("id-ID")}</p>}
        </Panel>
      </div>
    </div>
  );
};

export default LiveMap;
