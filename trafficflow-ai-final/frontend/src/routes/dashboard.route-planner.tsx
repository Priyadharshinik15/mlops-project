import { createFileRoute } from "@tanstack/react-router";
import {
  Route as RouteIcon, Mic, Home, Building2, GraduationCap,
  Zap, Leaf, Ban, Trophy, Loader2, Clock, Fuel, Wind,
  Navigation, ArrowRight, MapPin, CheckCircle2, Info,
  Play, Square,
} from "lucide-react";
import { useState, useRef, useEffect, useCallback, lazy, Suspense } from "react";
import { FALLBACK_COORDS } from "@/hooks/useGeoLocation";

// ── Lazy-load MapLibre map so it NEVER runs in SSR ───────────────────────────
const NavigationMap = lazy(() =>
  import("@/components/map/NavigationMap").then(m => ({ default: m.NavigationMap }))
);

// ── Types ─────────────────────────────────────────────────────────────────────
type RouteVariant = {
  travel_min: number;
  distance_km: number;
  traffic_delay_min: number;
  fuel_l: number;
  co2_kg: number;
  confidence: number;
};

type RouteResult = {
  recommended_type: string;
  travel_min: number;
  distance_km: number;
  traffic_delay_min: number;
  fuel_l: number;
  co2_kg: number;
  confidence: number;
  origin:      { name: string; lat: number; lon: number };
  destination: { name: string; lat: number; lon: number };
  all_routes:  Record<string, RouteVariant>;
  steps:       string[];
};

// ── Chennai known places (offline cache) ─────────────────────────────────────
// NOTE: "current location" and "home" are intentionally absent here —
// they are resolved from real GPS (userCoordsRef) inside findRoute().
const KNOWN_PLACES: Record<string, { lat: number; lon: number }> = {
  "current location":    { lat: 13.0827, lon: 80.2707 },  // overridden by GPS in findRoute
  "home":                { lat: 13.0827, lon: 80.2707 },  // overridden by GPS in findRoute
  "anna salai":          { lat: 13.0418, lon: 80.2417 },
  "anna salai, chennai": { lat: 13.0418, lon: 80.2417 },
  "office":              { lat: 13.0418, lon: 80.2417 },
  "iit madras":          { lat: 13.0117, lon: 80.2337 },
  "iit madras, chennai": { lat: 13.0117, lon: 80.2337 },
  "college":             { lat: 13.0117, lon: 80.2337 },
  "chennai airport":     { lat: 12.9941, lon: 80.1707 },
  "airport":             { lat: 12.9941, lon: 80.1707 },
  "marina beach":        { lat: 13.0500, lon: 80.2824 },
  "beach":               { lat: 13.0500, lon: 80.2824 },
  "central station":     { lat: 13.0827, lon: 80.2750 },
  "chennai central":     { lat: 13.0827, lon: 80.2750 },
  "t nagar":             { lat: 13.0392, lon: 80.2329 },
  "tambaram":            { lat: 12.9249, lon: 80.1000 },
  "omr":                 { lat: 12.9010, lon: 80.2279 },
  "sholinganallur":      { lat: 12.9010, lon: 80.2279 },
  "ecr":                 { lat: 12.9500, lon: 80.2580 },
  "velachery":           { lat: 12.9815, lon: 80.2209 },
  "adyar":               { lat: 13.0012, lon: 80.2565 },
  "guindy":              { lat: 13.0067, lon: 80.2206 },
  "perambur":            { lat: 13.1143, lon: 80.2329 },
  "egmore":              { lat: 13.0732, lon: 80.2609 },
  "porur":               { lat: 13.0367, lon: 80.1571 },
  "chrompet":            { lat: 12.9516, lon: 80.1462 },
  "madhavaram":          { lat: 13.1489, lon: 80.2309 },
  "avadi":               { lat: 13.1147, lon: 80.0969 },
  "poonamallee":         { lat: 13.0469, lon: 80.1163 },
  "maduravoyal":         { lat: 13.0695, lon: 80.1712 },
  "koyambedu":           { lat: 13.0694, lon: 80.1948 },
  "vadapalani":          { lat: 13.0520, lon: 80.2121 },
  "ashok nagar":         { lat: 13.0369, lon: 80.2146 },
  "k k nagar":           { lat: 13.0453, lon: 80.2042 },
  "kodambakkam":         { lat: 13.0513, lon: 80.2275 },
  "nungambakkam":        { lat: 13.0599, lon: 80.2430 },
  "kilpauk":             { lat: 13.0848, lon: 80.2499 },
  "aminjikarai":         { lat: 13.0770, lon: 80.2290 },
  "arumbakkam":          { lat: 13.0712, lon: 80.2127 },
  "virugambakkam":       { lat: 13.0547, lon: 80.1941 },
  "valasaravakkam":      { lat: 13.0492, lon: 80.1768 },
  "mogappair":           { lat: 13.0904, lon: 80.1742 },
  "ambattur":            { lat: 13.0984, lon: 80.1689 },
  "thiruvottiyur":       { lat: 13.1637, lon: 80.3023 },
  "manali":              { lat: 13.1654, lon: 80.2573 },
  "kolathur":            { lat: 13.1196, lon: 80.2276 },
  "vyasarpadi":          { lat: 13.1201, lon: 80.2536 },
  "tondiarpet":          { lat: 13.1179, lon: 80.2858 },
  "royapuram":           { lat: 13.1118, lon: 80.2985 },
  "george town":         { lat: 13.0924, lon: 80.2876 },
  "park town":           { lat: 13.0770, lon: 80.2747 },
  "triplicane":          { lat: 13.0584, lon: 80.2762 },
  "mylapore":            { lat: 13.0368, lon: 80.2676 },
  "royapettah":          { lat: 13.0525, lon: 80.2601 },
  "chepauk":             { lat: 13.0651, lon: 80.2793 },
  "besant nagar":        { lat: 12.9990, lon: 80.2669 },
  "thiruvanmiyur":       { lat: 12.9837, lon: 80.2575 },
  "perungudi":           { lat: 12.9610, lon: 80.2410 },
  "thoraipakkam":        { lat: 12.9392, lon: 80.2336 },
  "pallikaranai":        { lat: 12.9320, lon: 80.2117 },
  "medavakkam":          { lat: 12.9244, lon: 80.1919 },
  "selaiyur":            { lat: 12.9172, lon: 80.1596 },
  "chitlapakkam":        { lat: 12.9448, lon: 80.1444 },
  "pallavaram":          { lat: 12.9707, lon: 80.1492 },
  "pammal":              { lat: 12.9769, lon: 80.1388 },
  "anakaputhur":         { lat: 13.0107, lon: 80.1356 },
  "nesapakkam":          { lat: 13.0215, lon: 80.1815 },
  "saidapet":            { lat: 13.0219, lon: 80.2316 },
  "kotturpuram":         { lat: 13.0190, lon: 80.2461 },
  "thiruvalleswaranagar":{ lat: 13.0290, lon: 80.2170 },
  "mount road":          { lat: 13.0627, lon: 80.2585 },
  "express avenue":      { lat: 13.0638, lon: 80.2633 },
  "spencer plaza":       { lat: 13.0641, lon: 80.2783 },
  "cmbt":                { lat: 13.0694, lon: 80.1948 },
  "central bus stand":   { lat: 13.0823, lon: 80.2767 },
};

// ── Nominatim geocoder (OSM, free, no API key) ────────────────────────────────
// Returns null if not found or network fails
async function geocodeNominatim(query: string): Promise<{ lat: number; lon: number } | null> {
  try {
    // Bias results to Chennai area with countrycodes + viewbox
    const params = new URLSearchParams({
      q:            query + ", Chennai, India",
      format:       "json",
      limit:        "1",
      countrycodes: "in",
      viewbox:      "79.8,12.7,80.5,13.3",   // Chennai bounding box
      bounded:      "0",                       // allow results slightly outside
    });
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      {
        headers: { "Accept-Language": "en", "User-Agent": "TrafficOpsAI/1.0" },
        signal: AbortSignal.timeout(2000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json() as { lat: string; lon: string }[];
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

// ── Place resolver: local dict first, then Nominatim geocoder ────────────────
async function resolvePlace(query: string): Promise<{ lat: number; lon: number } | null> {
  const key = query.trim().toLowerCase();

  // 1. Exact match
  if (KNOWN_PLACES[key]) return KNOWN_PLACES[key];

  // 2. Partial match in local cache
  for (const [k, v] of Object.entries(KNOWN_PLACES))
    if (k.includes(key) || key.includes(k)) return v;

  // 3. Live geocoding via Nominatim (free OSM geocoder)
  return geocodeNominatim(query);
}

const IS_PEAK = (() => { const h = new Date().getHours(); return (h >= 8 && h <= 10) || (h >= 17 && h <= 20); })();

// ── Simulation helpers ────────────────────────────────────────────────────────
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function simulateRoute(
  from: { lat: number; lon: number },
  to:   { lat: number; lon: number },
  type: string,
): RouteVariant {
  const dist    = haversine(from.lat, from.lon, to.lat, to.lon);
  const road    = Math.round(dist * 1.35 * 10) / 10;
  const penalty = IS_PEAK ? 0.6 : 1.0;
  const spd: Record<string, number> = {
    ai: 32 * penalty, fastest: 38 * penalty, eco: 28 * penalty,
    "avoid-traffic": 33 * penalty, "avoid-toll": 30 * penalty,
  };
  const speed   = spd[type] ?? 30 * penalty;
  const t       = Math.round((road / speed) * 60);
  const delay   = IS_PEAK ? Math.round(t * 0.25) : Math.round(t * 0.05);
  const ff      = type === "eco" ? 0.85 : type === "avoid-traffic" ? 1.05 : 1.0;
  const fuel    = Math.round(road * 0.07 * ff * 10) / 10;
  const co2     = Math.round(fuel * 2.31 * 10) / 10;
  const base    = type === "ai" ? 93 : type === "fastest" ? 88 : 82;
  const conf    = Math.min(99, Math.max(60, base - (IS_PEAK ? 8 : 0) + Math.round(Math.random() * 4)));
  return { travel_min: t + delay, distance_km: road, traffic_delay_min: delay, fuel_l: fuel, co2_kg: co2, confidence: conf };
}

function buildSteps(from: string, to: string, dist: number): string[] {
  const all = [
    `Start from ${from}`,
    dist > 8  ? "Head towards the main arterial road" : "Head south on the local road",
    dist > 5  ? "Continue on inner ring road / NH" : "Turn right at the traffic signal",
    dist > 10 ? "Merge onto the outer ring road"   : "Continue straight for 2 km",
    dist > 15 ? "Take the flyover and continue"    : "Turn left near the landmark",
    `Arrive at ${to}`,
  ];
  return all.slice(0, dist > 10 ? 6 : 4);
}

// ── Pure local bezier fallback line (zero network, instant) ─────────────────
function buildBezierLine(
  from: { lat: number; lon: number },
  to:   { lat: number; lon: number },
): [number, number][] {
  const midLat = (from.lat + to.lat) / 2 + 0.008;
  const midLon = (from.lon + to.lon) / 2 - 0.004;
  const pts: [number, number][] = [];
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    const lon = (1 - t) ** 2 * from.lon + 2 * (1 - t) * t * midLon + t ** 2 * to.lon;
    const lat = (1 - t) ** 2 * from.lat + 2 * (1 - t) * t * midLat + t ** 2 * to.lat;
    pts.push([lon, lat]);
  }
  return pts;
}

// Fetch real route geometry from OSRM (free, no key needed)
async function fetchOSRMRoute(
  from: { lat: number; lon: number },
  to:   { lat: number; lon: number },
): Promise<[number, number][]> {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${from.lon},${from.lat};${to.lon},${to.lat}` +
      `?overview=full&geometries=geojson`;
    const res  = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const json = await res.json() as { routes?: { geometry?: { coordinates?: [number, number][] } }[] };
    const coords = json.routes?.[0]?.geometry?.coordinates ?? [];
    if (coords.length >= 2) return coords;
  } catch { /* fall through */ }
  return [];  // caller handles fallback
}

// ── UI constants ──────────────────────────────────────────────────────────────
const ROUTE_TYPES = [
  { key: "ai",            icon: Trophy, label: "AI Route",      desc: "Best overall" },
  { key: "fastest",       icon: Zap,    label: "Fastest",       desc: "Min ETA" },
  { key: "eco",           icon: Leaf,   label: "Eco",           desc: "Low fuel/CO₂" },
  { key: "avoid-traffic", icon: Ban,    label: "Avoid Traffic", desc: "Skip jams" },
  { key: "avoid-toll",    icon: Ban,    label: "Avoid Toll",    desc: "No tolls" },
];

const QUICK_DEST = [
  { icon: Home,          label: "Home",    value: "Home" },
  { icon: Building2,     label: "Office",  value: "Anna Salai" },
  { icon: GraduationCap, label: "College", value: "IIT Madras" },
  { icon: Navigation,    label: "Airport", value: "Chennai Airport" },
];

const TYPE_LABEL: Record<string, string> = {
  ai: "AI Optimised", fastest: "Speed Optimised",
  eco: "Eco Optimised", "avoid-traffic": "Traffic Avoided", "avoid-toll": "Toll-Free",
};

const delayColor = (m: number) => m < 5 ? "text-green-400" : m < 15 ? "text-yellow-400" : "text-red-400";

// ── Main page ─────────────────────────────────────────────────────────────────
function RoutePlanner() {
  const [origin, setOrigin]             = useState("Current location");
  const [destination, setDestination]   = useState("");
  const [selectedType, setSelectedType] = useState("ai");
  const [loading, setLoading]           = useState(false);
  const [result, setResult]             = useState<RouteResult | null>(null);
  const [error, setError]               = useState<string | null>(null);
  const [activeStep, setActiveStep]     = useState(0);
  const [gpsStatus, setGpsStatus]       = useState<"detecting" | "found" | "denied" | "unsupported">("detecting");

  // Stores real GPS coords once obtained — used when origin === "current location"
  const userCoordsRef = useRef<{ lat: number; lon: number } | null>(null);

  // Navigation / live tracking
  const [routeCoords, setRouteCoords]   = useState<[number, number][]>([]);
  const [navigating, setNavigating]     = useState(false);
  const [progress, setProgress]         = useState(0);           // 0–1
  const navTimer  = useRef<ReturnType<typeof setInterval> | null>(null);
  const destRef   = useRef<HTMLInputElement>(null);

  // Request real GPS on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsStatus("unsupported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userCoordsRef.current = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setGpsStatus("found");
      },
      () => {
        setGpsStatus("denied");   // user blocked or timed out — fallback coords used
      },
      { timeout: 8000, maximumAge: 60000, enableHighAccuracy: false },
    );
  }, []);

  // Auto-advance turn-by-turn steps
  useEffect(() => {
    if (!result) return;
    const id = setInterval(() =>
      setActiveStep(s => s < result.steps.length - 1 ? s + 1 : s), 3500);
    return () => clearInterval(id);
  }, [result]);

  // Cleanup timer on unmount
  useEffect(() => () => { if (navTimer.current) clearInterval(navTimer.current); }, []);

  const startNav = useCallback(() => {
    if (routeCoords.length < 2) return;
    setNavigating(true);
    setProgress(0);
    let step = 0;
    const total = routeCoords.length;
    navTimer.current = setInterval(() => {
      step += 1;
      setProgress(step / (total - 1));
      if (step >= total - 1) {
        clearInterval(navTimer.current!);
        setNavigating(false);
      }
    }, 100); // 100ms per step → smooth animation
  }, [routeCoords]);

  const stopNav = useCallback(() => {
    if (navTimer.current) clearInterval(navTimer.current);
    setNavigating(false);
    setProgress(0);
  }, []);

  const findRoute = useCallback(async () => {
    if (!destination.trim()) { destRef.current?.focus(); return; }

    // Use real GPS coords if origin is "current location" and we have them
    let fromC: { lat: number; lon: number } | null = null;
    const originKey = origin.trim().toLowerCase();
    if ((originKey === "current location" || originKey === "home") && userCoordsRef.current) {
      fromC = userCoordsRef.current;
    } else {
      fromC = await resolvePlace(origin);
    }
    // Last resort: fall back to GPS ref or FALLBACK_COORDS so routing never blocks
    if (!fromC) fromC = userCoordsRef.current ?? FALLBACK_COORDS;

    const toC = await resolvePlace(destination);

    if (!fromC) { setError(`Unknown: "${origin}". Try: Current location, Anna Salai…`); return; }
    if (!toC)   { setError(`Unknown: "${destination}". Try: Chennai Airport, T Nagar, Marina Beach…`); return; }

    setLoading(true);
    setError(null);
    setResult(null);
    setRouteCoords([]);
    setProgress(0);
    stopNav();
    setActiveStep(0);

    // ── Phase 1: show result INSTANTLY using local bezier fallback ──────────
    // Build the smooth fallback coords right now (pure math, zero network)
    const fallbackCoords = buildBezierLine(fromC, toC);
    const main = simulateRoute(fromC, toC, selectedType);
    const all: Record<string, RouteVariant> = {};
    for (const t of ["fastest", "eco", "avoid-traffic", "avoid-toll"])
      all[t] = simulateRoute(fromC, toC, t);

    const fromName = Object.entries(KNOWN_PLACES)
      .find(([, v]) => v.lat === fromC.lat && v.lon === fromC.lon)?.[0] ?? origin;
    const toName   = Object.entries(KNOWN_PLACES)
      .find(([, v]) => v.lat === toC.lat   && v.lon === toC.lon  )?.[0] ?? destination;

    // Show result immediately — no waiting for network
    setRouteCoords(fallbackCoords);
    setResult({
      ...main,
      recommended_type: selectedType,
      origin:      { name: origin,      lat: fromC.lat, lon: fromC.lon },
      destination: { name: destination, lat: toC.lat,   lon: toC.lon   },
      all_routes: all,
      steps: buildSteps(fromName, toName, main.distance_km),
    });
    setLoading(false);

    // ── Phase 2: silently upgrade to real OSRM road geometry ────────────────
    // This runs in the background — if it succeeds, the map line snaps to real roads
    fetchOSRMRoute(fromC, toC).then(realCoords => {
      if (realCoords.length >= 2) setRouteCoords(realCoords);
    });
  }, [origin, destination, selectedType, stopNav]);

  function handleVoice() {
    const SR = (window as unknown as Record<string, unknown>)["SpeechRecognition"] as typeof SpeechRecognition |
      undefined || (window as unknown as Record<string, unknown>)["webkitSpeechRecognition"] as typeof SpeechRecognition | undefined;
    if (!SR) { alert("Voice not supported in this browser."); return; }
    const rec = new SR(); rec.lang = "en-IN";
    rec.onresult = (e: SpeechRecognitionEvent) => setDestination(e.results[0][0].transcript);
    rec.start();
  }

  const remaining = result
    ? { km: Math.round(result.distance_km * (1 - progress) * 10) / 10,
        min: Math.round(result.travel_min * (1 - progress)) }
    : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[400px_1fr]">

      {/* ── Left panel ── */}
      <aside className="space-y-4 overflow-y-auto max-h-[calc(100vh-7rem)]">

        {/* From / To inputs */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">From</label>
            <div className="relative mt-1">
              <input value={origin} onChange={e => setOrigin(e.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-secondary/50 px-3 pr-24 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              <span className={`absolute right-2 top-2 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                gpsStatus === "found"       ? "bg-green-500/20 text-green-400" :
                gpsStatus === "detecting"   ? "bg-yellow-500/20 text-yellow-400" :
                gpsStatus === "denied"      ? "bg-red-500/20 text-red-400" :
                                              "bg-secondary text-muted-foreground"}`}>
                {gpsStatus === "found"      ? "📍 GPS live" :
                 gpsStatus === "detecting"  ? "⏳ locating…" :
                 gpsStatus === "denied"     ? "⚠ GPS denied" :
                                              "📍 manual"}
              </span>
            </div>
            {gpsStatus === "denied" && (
              <p className="mt-1 text-[11px] text-yellow-500">
                Location access blocked. Using Chennai default. Allow location in browser settings for real GPS.
              </p>
            )}
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Destination</label>
            <div className="relative mt-1">
              <input ref={destRef} value={destination}
                onChange={e => { setDestination(e.target.value); setError(null); }}
                onKeyDown={e => e.key === "Enter" && findRoute()}
                placeholder="e.g. Chennai Airport, T Nagar, OMR…"
                className="h-10 w-full rounded-lg border border-input bg-secondary/50 px-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              <button onClick={handleVoice} title="Voice input"
                className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-md text-primary hover:bg-primary/10">
                <Mic className="h-4 w-4" />
              </button>
            </div>
          </div>
          {/* Quick-select buttons */}
          <div className="flex flex-wrap gap-2">
            {QUICK_DEST.map(f => (
              <button key={f.label} onClick={() => { setDestination(f.value); setError(null); }}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs hover:border-primary/50 transition">
                <f.icon className="h-3 w-3 text-primary" /> {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Route type */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Route type</div>
          <div className="grid grid-cols-2 gap-2">
            {ROUTE_TYPES.map(r => {
              const active = selectedType === r.key;
              return (
                <button key={r.key} onClick={() => setSelectedType(r.key)}
                  className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left text-sm transition ${
                    active ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}>
                  <r.icon className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="font-medium">{r.label}</span>
                  <span className="text-xs text-muted-foreground">{r.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Find Route CTA */}
        <button onClick={findRoute} disabled={loading}
          className="w-full rounded-xl bg-gradient-to-r from-primary to-primary-glow px-4 py-3 text-sm font-bold text-primary-foreground surface-glow hover:opacity-95 disabled:opacity-60 flex items-center justify-center gap-2">
          {loading
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Calculating route…</>
            : <><RouteIcon className="h-4 w-4" /> Find Route</>}
        </button>

        {/* Hint */}
        <div className="rounded-xl border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground flex items-start gap-2">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
          Try: "Chennai Airport", "T Nagar", "Marina Beach", "Tambaram", "Guindy", "Velachery", "Porur"
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <span className="shrink-0 font-bold">!</span> {error}
          </div>
        )}

        {/* ── Result section ── */}
        {result && (
          <div className="space-y-3">

            {/* Main stats card */}
            <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-primary mb-3">
                <Trophy className="h-3.5 w-3.5" />
                {TYPE_LABEL[result.recommended_type] ?? "Route"}
                <span className="ml-auto text-green-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> {result.confidence}%
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="font-display text-2xl font-bold">
                    {navigating ? remaining?.min : result.travel_min}
                  </div>
                  <div className="text-[10px] uppercase text-muted-foreground">
                    min {navigating ? "left" : "ETA"}
                  </div>
                </div>
                <div>
                  <div className="font-display text-2xl font-bold">
                    {navigating ? remaining?.km : result.distance_km}
                  </div>
                  <div className="text-[10px] uppercase text-muted-foreground">km</div>
                </div>
                <div>
                  <div className={`font-display text-2xl font-bold ${delayColor(result.traffic_delay_min)}`}>
                    +{result.traffic_delay_min}
                  </div>
                  <div className="text-[10px] uppercase text-muted-foreground">min delay</div>
                </div>
              </div>

              {/* Progress bar during navigation */}
              {navigating && (
                <div className="mt-3">
                  <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary-glow transition-all duration-200"
                      style={{ width: `${Math.round(progress * 100)}%` }} />
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                    <span>🚗 Navigating…</span>
                    <span>{Math.round(progress * 100)}% complete</span>
                  </div>
                </div>
              )}

              <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Fuel className="h-3 w-3" /> {result.fuel_l} L</span>
                <span className="flex items-center gap-1"><Wind className="h-3 w-3" /> {result.co2_kg} kg CO₂</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />
                  {new Date(Date.now() + result.travel_min * 60000)
                    .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} arrival
                </span>
              </div>

              {/* Route path summary */}
              <div className="mt-3 border-t border-border/60 pt-3 space-y-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 text-green-400 shrink-0" />
                  <span className="truncate capitalize">{result.origin.name}</span>
                </div>
                <div className="pl-1.5"><ArrowRight className="h-3 w-3" /></div>
                <div className="flex items-center gap-1.5">
                  <Navigation className="h-3 w-3 text-primary shrink-0" />
                  <span className="truncate capitalize">{result.destination.name}</span>
                </div>
              </div>

              {/* Start / Stop navigation button */}
              <div className="mt-3">
                {!navigating ? (
                  <button onClick={startNav} disabled={routeCoords.length < 2}
                    className="w-full rounded-xl bg-gradient-to-r from-primary to-primary-glow py-2.5 text-xs font-bold text-primary-foreground surface-glow hover:opacity-95 disabled:opacity-50 flex items-center justify-center gap-1.5">
                    <Play className="h-3.5 w-3.5" /> Start Navigation
                  </button>
                ) : (
                  <button onClick={stopNav}
                    className="w-full rounded-xl border border-destructive/40 bg-destructive/10 py-2.5 text-xs font-bold text-destructive hover:bg-destructive/20 flex items-center justify-center gap-1.5">
                    <Square className="h-3.5 w-3.5" /> Stop Navigation
                  </button>
                )}
              </div>
            </div>

            {/* Turn-by-turn */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Turn-by-turn directions</div>
              <ol className="space-y-2">
                {result.steps.map((step, i) => (
                  <li key={i} className={`flex items-start gap-2.5 text-sm transition ${
                    i === activeStep ? "text-primary font-medium" :
                    i < activeStep  ? "text-muted-foreground line-through opacity-50" : ""}`}>
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold border ${
                      i === activeStep ? "border-primary bg-primary/20 text-primary" :
                      i < activeStep  ? "border-border bg-secondary/40 text-muted-foreground" :
                      "border-border text-muted-foreground"}`}>
                      {i < activeStep ? "✓" : i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            {/* Alternatives */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Route alternatives</div>
              <div className="space-y-1.5">
                {Object.entries(result.all_routes).map(([key, r]) => (
                  <div key={key}
                    onClick={() => setSelectedType(key)}
                    className={`flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs transition hover:bg-primary/5 ${
                      key === result.recommended_type ? "bg-primary/10 border border-primary/30" : "bg-secondary/40"}`}>
                    <span className="font-medium capitalize">{key.replace("-", " ")}</span>
                    <div className="flex gap-3 text-muted-foreground">
                      <span className="font-mono">{r.travel_min} min</span>
                      <span>{r.distance_km} km</span>
                      <span className={delayColor(r.traffic_delay_min)}>+{r.traffic_delay_min}m</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </aside>

      {/* ── Map panel ── */}
      <div className="relative min-h-[calc(100vh-8rem)] overflow-hidden rounded-xl border border-border bg-secondary/40">
        <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />

        {/* Lazy MapLibre — never runs on SSR */}
        <Suspense fallback={
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        }>
          <NavigationMap
            result={result}
            routeCoords={routeCoords}
            progress={progress}
            navigating={navigating}
            userLat={userCoordsRef.current?.lat}
            userLon={userCoordsRef.current?.lon}
          />
        </Suspense>

        {/* Live status badge */}
        {result && (
          <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full border border-primary/30 bg-black/70 px-3 py-1.5 text-xs font-medium text-white backdrop-blur pointer-events-none">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" style={{ animation: "pulse-dot 1.5s infinite" }} />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            {navigating ? "Navigating live…" : "Route ready"} · {result.distance_km} km
          </div>
        )}

        {/* Map legend */}
        {result && (
          <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-1.5 rounded-xl border border-border/60 bg-black/70 px-3 py-2.5 text-[11px] text-white backdrop-blur pointer-events-none">
            <div className="flex items-center gap-2"><span className="h-2 w-5 rounded-full bg-[#22c55e] inline-block" /> Your location</div>
            <div className="flex items-center gap-2"><span className="h-2 w-5 rounded-full bg-[#4ade80] inline-block" /> Route ahead</div>
            <div className="flex items-center gap-2"><span className="h-2 w-5 rounded-full bg-[#60a5fa] inline-block" /> Travelled</div>
            <div className="flex items-center gap-2"><span className="h-2 w-5 rounded-full bg-[#ef4444] inline-block" /> Destination</div>
          </div>
        )}
      </div>

    </div>
  );
}

// Route export MUST be at the bottom — after RoutePlanner is defined
export const Route = createFileRoute("/dashboard/route-planner")({
  head: () => ({ meta: [{ title: "AI Route Planner · TrafficOps AI" }] }),
  component: RoutePlanner,
});
