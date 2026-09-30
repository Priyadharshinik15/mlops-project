// Client-only — loaded via React.lazy(). Never import at SSR top level.
import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";
import { useEffect, useRef } from "react";
import { Route as RouteIcon } from "lucide-react";

const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

export type NavMapResult = {
  origin:      { name: string; lat: number; lon: number };
  destination: { name: string; lat: number; lon: number };
};

type Props = {
  result:      NavMapResult | null;
  routeCoords: [number, number][];  // [lon, lat] from OSRM
  progress:    number;              // 0–1
  navigating:  boolean;
  userLat?:    number;              // real GPS lat — falls back to Chennai centre
  userLon?:    number;              // real GPS lon
};

export function NavigationMap({ result, routeCoords, progress, navigating, userLat, userLon }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<maplibregl.Map | null>(null);
  const originMkr    = useRef<maplibregl.Marker | null>(null);
  const destMkr      = useRef<maplibregl.Marker | null>(null);
  const carMkr       = useRef<maplibregl.Marker | null>(null);

  // Resolved centre: use real GPS if provided, otherwise Chennai city centre
  const centerLon = userLon ?? 80.2707;
  const centerLat = userLat ?? 13.0827;

  // ── Init map once on mount ───────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const map = new maplibregl.Map({
      container: el,
      style: OSM_STYLE,
      center: [centerLon, centerLat],
      zoom: 11,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    mapRef.current = map;
    map.once("load", () => map.resize());

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Draw route + markers when result / coords change ─────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    originMkr.current?.remove();
    destMkr.current?.remove();
    carMkr.current?.remove();
    originMkr.current = destMkr.current = carMkr.current = null;

    const rm = (id: string) => {
      if (map.getLayer(id))  map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
    };

    const draw = () => {
      rm("route-shadow"); rm("route-ahead"); rm("route-done");

      if (!result || routeCoords.length < 2) {
        map.flyTo({ center: [centerLon, centerLat], zoom: 11, duration: 800 });
        return;
      }

      const { origin: o, destination: d } = result;

      // Shadow casing
      map.addSource("route-shadow", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: routeCoords } },
      });
      map.addLayer({
        id: "route-shadow", type: "line", source: "route-shadow",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#000", "line-width": 10, "line-opacity": 0.18 },
      });

      // Green route ahead
      map.addSource("route-ahead", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: routeCoords } },
      });
      map.addLayer({
        id: "route-ahead", type: "line", source: "route-ahead",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#4ade80", "line-width": 6, "line-opacity": 0.95 },
      });

      // Blue already-done portion
      const cut       = Math.floor(progress * (routeCoords.length - 1));
      const traversed = routeCoords.slice(0, cut + 1);
      if (traversed.length >= 2) {
        map.addSource("route-done", {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: traversed } },
        });
        map.addLayer({
          id: "route-done", type: "line", source: "route-done",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#60a5fa", "line-width": 6, "line-opacity": 0.95 },
        });
      }

      // Origin pin (green)
      const oEl = document.createElement("div");
      oEl.innerHTML = `<div style="width:20px;height:20px;border-radius:50%;background:#22c55e;border:3px solid #fff;box-shadow:0 0 14px #22c55eaa"></div>`;
      originMkr.current = new maplibregl.Marker({ element: oEl, anchor: "center" })
        .setLngLat([o.lon, o.lat])
        .setPopup(new maplibregl.Popup({ offset: 16 }).setHTML(`<strong>📍 Start</strong><br/><span style="font-size:12px">${o.name}</span>`))
        .addTo(map);

      // Destination pin (red flag)
      const dEl = document.createElement("div");
      dEl.innerHTML = `<div style="width:26px;height:26px;border-radius:50%;background:#ef4444;border:3px solid #fff;box-shadow:0 0 18px #ef4444aa;display:flex;align-items:center;justify-content:center;font-size:13px">🏁</div>`;
      destMkr.current = new maplibregl.Marker({ element: dEl, anchor: "center" })
        .setLngLat([d.lon, d.lat])
        .setPopup(new maplibregl.Popup({ offset: 16 }).setHTML(`<strong>🏁 Destination</strong><br/><span style="font-size:12px">${d.name}</span>`))
        .addTo(map);

      // Car marker at current position
      const carIdx         = Math.min(cut, routeCoords.length - 1);
      const [cLon, cLat]   = routeCoords[carIdx];
      const carEl = document.createElement("div");
      carEl.innerHTML = `<div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#86efac,#4ade80);border:3px solid #fff;box-shadow:0 0 22px #4ade8099,0 2px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:15px">🚗</div>`;
      carMkr.current = new maplibregl.Marker({ element: carEl, anchor: "center" })
        .setLngLat([cLon, cLat])
        .addTo(map);

      // Fit bounds
      const lons = routeCoords.map(c => c[0]);
      const lats = routeCoords.map(c => c[1]);
      map.fitBounds(
        [[Math.min(...lons) - 0.015, Math.min(...lats) - 0.015],
         [Math.max(...lons) + 0.015, Math.max(...lats) + 0.015]],
        { padding: { top: 70, bottom: 90, left: 50, right: 50 }, duration: 1400, maxZoom: 15 },
      );
    };

    if (map.isStyleLoaded()) draw();
    else map.once("load", draw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, routeCoords, progress]);

  // ── Move car live during navigation ──────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !carMkr.current || routeCoords.length < 2) return;

    const idx        = Math.min(Math.floor(progress * (routeCoords.length - 1)), routeCoords.length - 1);
    const [lon, lat] = routeCoords[idx];
    carMkr.current.setLngLat([lon, lat]);

    // Update blue done-line
    const rm = (id: string) => {
      if (map.getLayer(id))  map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
    };
    rm("route-done");
    const traversed = routeCoords.slice(0, idx + 1);
    if (traversed.length >= 2 && map.isStyleLoaded()) {
      map.addSource("route-done", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: traversed } },
      });
      map.addLayer({
        id: "route-done", type: "line", source: "route-done",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#60a5fa", "line-width": 6, "line-opacity": 0.95 },
      });
    }

    // Follow car in navigation mode
    if (navigating) map.easeTo({ center: [lon, lat], zoom: 14, duration: 700 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, navigating]);

  // ── Render — container div is ALWAYS present so map can init ─────────────
  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0 h-full w-full rounded-xl" />

      {/* Empty-state overlay — transparent so OSM tiles show behind */}
      {!result && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none">
          <div className="rounded-2xl border border-primary/20 bg-black/55 px-8 py-6 text-center backdrop-blur-md">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 ring-2 ring-primary/30">
              <RouteIcon className="h-8 w-8 text-primary" />
            </div>
            <div className="font-display text-base font-semibold text-white">AI Route Navigator</div>
            <div className="mt-1 text-sm text-white/70">Enter destination → Find Route → Start Navigation</div>
            <div className="mt-2 text-xs text-white/40">Real road geometry · OSRM · MapLibre GL</div>
          </div>
        </div>
      )}
    </div>
  );
}
