import React, { useMemo } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

export type MapMarker = {
  lat: number;
  lng: number;
  label?: string;
  color?: string; // hex without #
  popup?: string;
  /** Visual style — "badge" (default, big pill) or "dot" (small circle for high-density overlays). */
  variant?: "badge" | "dot";
};

export type MapPolyline = {
  points: { lat: number; lng: number }[];
  color?: string; // hex without #
  weight?: number;
};

type Props = {
  markers?: MapMarker[];
  polylines?: MapPolyline[];
  center?: { lat: number; lng: number };
  zoom?: number;
  height?: number;
  style?: any;
};

const DEFAULT_CENTER = { lat: -2.5489, lng: 118.0149 }; // Indonesia center

function buildHtml(
  markers: MapMarker[],
  polylines: MapPolyline[],
  center: { lat: number; lng: number },
  zoom: number,
) {
  const markersJs = JSON.stringify(markers);
  const polylinesJs = JSON.stringify(polylines);
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="initial-scale=1,maximum-scale=1,user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: #eef2f5; }
  .oxly-pin {
    background: #16a34a; color: #fff; padding: 4px 8px; border-radius: 999px;
    font: 600 11px/1 -apple-system, "Segoe UI", Roboto, sans-serif;
    border: 2px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.25);
    white-space: nowrap;
  }
  .oxly-dot {
    width: 12px; height: 12px; border-radius: 50%;
    border: 2px solid #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.35);
    background: #2563eb;
  }
  .oxly-dot-lbl {
    font: 600 9px/1 -apple-system, "Segoe UI", Roboto, sans-serif;
    color: #111; text-shadow: 0 0 3px #fff, 0 0 3px #fff;
    margin-top: 1px; white-space: nowrap; text-align: center;
  }
  .oxly-dot-wrap { display: flex; flex-direction: column; align-items: center; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
<script>
  const markers = ${markersJs};
  const polylines = ${polylinesJs};
  const center = [${center.lat}, ${center.lng}];
  const zoom = ${zoom};

  const map = L.map('map', { zoomControl: true, attributionControl: false }).setView(center, zoom);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
  }).addTo(map);

  const bounds = [];
  const layers = [];

  polylines.forEach(function(pl){
    if (!pl.points || pl.points.length < 2) return;
    const pts = pl.points.map(function(p){ return [p.lat, p.lng]; });
    const line = L.polyline(pts, {
      color: '#' + (pl.color || '16a34a'),
      weight: pl.weight || 4,
      opacity: 0.85,
    }).addTo(map);
    layers.push(line);
    pts.forEach(function(p){ bounds.push(p); });
  });

  markers.forEach(function(m){
    const color = '#' + (m.color || '16a34a');
    let icon;
    if (m.variant === 'dot') {
      // Small circular dot for high-density overlays (e.g. customers)
      const lbl = m.label ? '<div class="oxly-dot-lbl">' + m.label + '</div>' : '';
      icon = L.divIcon({
        className: 'oxly-marker',
        html: '<div class="oxly-dot-wrap"><div class="oxly-dot" style="background:' + color + '"></div>' + lbl + '</div>',
        iconSize: null,
        iconAnchor: [6, 6],
      });
    } else {
      icon = L.divIcon({
        className: 'oxly-marker',
        html: '<div class="oxly-pin" style="background:' + color + '">' + (m.label || '') + '</div>',
        iconSize: null,
        iconAnchor: [16, 12],
      });
    }
    const marker = L.marker([m.lat, m.lng], { icon: icon }).addTo(map);
    if (m.popup) marker.bindPopup(m.popup);
    layers.push(marker);
    bounds.push([m.lat, m.lng]);
  });

  if (bounds.length > 1) {
    try { map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 }); } catch(e){}
  } else if (bounds.length === 1) {
    map.setView(bounds[0], 15);
  }
</script>
</body>
</html>`;
}

export default function LeafletMap({
  markers = [],
  polylines = [],
  center = DEFAULT_CENTER,
  zoom = 5,
  height = 300,
  style,
}: Props) {
  const html = useMemo(
    () => buildHtml(markers, polylines, center, zoom),
    [markers, polylines, center, zoom],
  );

  if (Platform.OS === "web") {
    // On web, react-native-webview renders an <iframe>. Use srcDoc.
    return (
      <View style={[styles.wrap, { height }, style]}>
        {React.createElement("iframe", {
          srcDoc: html,
          style: {
            width: "100%",
            height: "100%",
            border: 0,
            borderRadius: 12,
          },
        })}
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { height }, style]}>
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        style={styles.web}
        javaScriptEnabled
        domStorageEnabled
        scalesPageToFit
        setSupportMultipleWindows={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#eef2f5",
  },
  web: { flex: 1, backgroundColor: "transparent" },
});
