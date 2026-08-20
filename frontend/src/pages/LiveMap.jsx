import React from "react";
import { MapPin, Navigation, Clock } from "lucide-react";
import { GPS_POINTS } from "../mock/mockData";
import { PageHeader, Panel, Badge } from "../components/common";

const LiveMap = () => {
  return (
    <div>
      <PageHeader title="Peta Live" subtitle="Lokasi sales real-time (ping tiap 120 detik)" icon={MapPin} />
      <div className="grid lg:grid-cols-3 gap-4">
        <Panel className="lg:col-span-2 p-0 overflow-hidden">
          <div className="relative w-full h-[460px] bg-emerald-50"
            style={{ backgroundImage: "linear-gradient(rgba(16,185,129,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.08) 1px, transparent 1px)", backgroundSize: "40px 40px" }}>
            {/* fake roads */}
            <div className="absolute left-0 right-0 top-1/2 h-3 bg-white/70 -translate-y-1/2" />
            <div className="absolute top-0 bottom-0 left-1/3 w-3 bg-white/70" />
            <div className="absolute top-0 bottom-0 left-2/3 w-3 bg-white/70" />
            {GPS_POINTS.map((g) => (
              <div key={g.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ top: `${g.top}%`, left: `${g.left}%` }}>
                <span className="absolute inset-0 rounded-full bg-emerald-400/40 animate-ping" style={{ width: 40, height: 40, left: -20, top: -20 }} />
                <div className="relative w-10 h-10 rounded-full bg-emerald-500 border-4 border-white shadow-lg flex items-center justify-center">
                  <Navigation className="w-4 h-4 text-white" />
                </div>
                <div className="absolute top-11 left-1/2 -translate-x-1/2 whitespace-nowrap bg-card border border-border rounded-lg px-2 py-0.5 text-xs font-semibold shadow-sm">{g.name}</div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Sales Aktif">
          <div className="space-y-3">
            {GPS_POINTS.map((g) => (
              <div key={g.id} className="flex items-center gap-3 bg-secondary/50 rounded-xl p-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center"><Navigation className="w-5 h-5" /></div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{g.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> {g.lastPing}</p>
                </div>
                <Badge tone="emerald">{g.status}</Badge>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4">Catatan: peta ini adalah visual mock. Integrasi peta asli (Leaflet/Google Maps) dapat ditambahkan.</p>
        </Panel>
      </div>
    </div>
  );
};

export default LiveMap;
