import { createFileRoute } from "@tanstack/react-router";
import {
  Moon, Sun, Globe, Bell, User, Map, Clock, CheckCircle2, Save,
  Activity, Shield, Download, Trash2, Wifi, WifiOff, RefreshCw,
  Volume2, VolumeX, AlertTriangle, Gauge, Eye, EyeOff,
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";

// ─── Persistence helpers ─────────────────────────────────────────────────────
function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}
function save<T>(key: string, value: T) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full */ }
}

// ─── Global settings store (window-level so other pages can read it) ─────────
declare global {
  interface Window {
    TF_SETTINGS?: {
      interval: number;
      mapStyle: string;
      units: string;
      soundEnabled: boolean;
      alertThreshold: number;
    };
  }
}

// ─── Theme hook ──────────────────────────────────────────────────────────────
function useTheme() {
  const [theme, setThemeState] = useState<"dark" | "light">(() =>
    load<"dark" | "light">("tf_theme", "dark")
  );
  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    save("tf_theme", theme);
  }, [theme]);
  return { theme, setTheme: setThemeState };
}

// ─── Toast hook ──────────────────────────────────────────────────────────────
function useToast() {
  const [items, setItems] = useState<{ id: number; msg: string; type: "success" | "info" | "warn" }[]>([]);
  const toast = useCallback((msg: string, type: "success" | "info" | "warn" = "success") => {
    const id = Date.now();
    setItems(p => [...p, { id, msg, type }]);
    setTimeout(() => setItems(p => p.filter(x => x.id !== id)), 3000);
  }, []);
  const ToastEl = (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {items.map(t => (
        <div key={t.id}
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur-md
            ${t.type === "success" ? "border-green-500/40 bg-card/95 text-green-400" :
              t.type === "warn"    ? "border-orange-400/40 bg-card/95 text-orange-400" :
                                    "border-primary/40 bg-card/95 text-primary"}`}>
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {t.msg}
        </div>
      ))}
    </div>
  );
  return { toast, ToastEl };
}

// ─── Route ───────────────────────────────────────────────────────────────────
export const Route = createFileRoute("/dashboard/settings")({
  head: () => ({ meta: [{ title: "Settings · TrafficOps AI" }] }),
  component: SettingsPage,
});

// ─── Constants ───────────────────────────────────────────────────────────────
const LANGUAGES = [
  "English", "தமிழ் (Tamil)", "తెలుగు (Telugu)", "ಕನ್ನಡ (Kannada)",
  "മലയാളം (Malayalam)", "हिन्दी (Hindi)", "मराठी (Marathi)", "বাংলা (Bengali)",
  "ગુજરાતી (Gujarati)", "ਪੰਜਾਬੀ (Punjabi)", "ଓଡ଼ିଆ (Odia)", "اردو (Urdu)",
  "Español", "Français", "Deutsch", "Italiano", "Português",
  "日本語", "한국어", "中文 (简体)", "العربية", "Русский",
];

const MAP_STYLES = ["Dark", "Streets", "Satellite"] as const;
type MapStyle = (typeof MAP_STYLES)[number];

const INTERVALS = [5, 15, 30, 60] as const;
type Interval = (typeof INTERVALS)[number];

const UNITS = ["Metric (km/h, °C)", "Imperial (mph, °F)"] as const;
type Units = (typeof UNITS)[number];

const NOTIF_KEYS = [
  "Critical congestion alerts",
  "Heavy rain warnings",
  "Route detour suggestions",
  "Peak hour reminders",
  "Model accuracy updates",
  "Daily traffic summary",
] as const;
type NotifKey = (typeof NOTIF_KEYS)[number];

const DASHBOARD_FEATURES = [
  { key: "showLiveMap",       label: "Live Map",           desc: "Real-time traffic overlay on map" },
  { key: "showPrediction",    label: "AI Prediction",      desc: "60-min XGBoost congestion forecast" },
  { key: "showWeather",       label: "Weather Panel",      desc: "Live conditions and forecast" },
  { key: "showAlerts",        label: "Traffic Alerts",     desc: "Incident and congestion notifications" },
  { key: "showAnalytics",     label: "Analytics Charts",   desc: "Hourly and weekly trend charts" },
  { key: "showModelMonitor",  label: "MLOps Monitor",      desc: "Model drift and feature importance" },
  { key: "showCityComparison",label: "City Comparison",    desc: "Multi-city congestion comparison" },
  { key: "showRoutePlanner",  label: "AI Route Planner",   desc: "Real-time navigation with OSRM" },
] as const;
type FeatureKey = (typeof DASHBOARD_FEATURES)[number]["key"];

// ─── Section wrapper ─────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children, badge }: {
  title: string; icon: React.ElementType; children: React.ReactNode; badge?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <h3 className="font-display font-semibold">{title}</h3>
        {badge && (
          <span className="ml-auto rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── Toggle switch ───────────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      role="switch"
      aria-checked={checked}
      className={`relative h-6 w-11 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/40 ${
        checked ? "bg-primary" : "bg-secondary"
      }`}
    >
      <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
        checked ? "translate-x-5" : "translate-x-0"
      }`} />
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { toast, ToastEl } = useToast();

  // Language
  const [language, setLanguage] = useState<string>(() => load("tf_language", "English"));

  // Map style
  const [mapStyle, setMapStyle] = useState<MapStyle>(() => load<MapStyle>("tf_map_style", "Dark"));

  // Prediction interval
  const [interval, setIntervalVal] = useState<Interval>(() => load<Interval>("tf_interval", 30));

  // Units
  const [units, setUnits] = useState<Units>(() => load<Units>("tf_units", "Metric (km/h, °C)"));

  // Sound
  const [soundEnabled, setSoundEnabled] = useState(() => load("tf_sound", true));

  // Alert threshold
  const [alertThreshold, setAlertThreshold] = useState(() => load("tf_alert_threshold", 70));

  // Notifications
  const [notifs, setNotifs] = useState<Record<NotifKey, boolean>>(() =>
    load("tf_notifs", Object.fromEntries(NOTIF_KEYS.map(k => [k, true])) as Record<NotifKey, boolean>)
  );

  // Dashboard features visibility
  const [features, setFeatures] = useState<Record<FeatureKey, boolean>>(() =>
    load("tf_features", Object.fromEntries(DASHBOARD_FEATURES.map(f => [f.key, true])) as Record<FeatureKey, boolean>)
  );

  // Profile
  const [profile, setProfile] = useState(() =>
    load("tf_profile", { name: "Operator", email: "operator@trafficops.ai", role: "Traffic Manager" })
  );
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState(profile);

  // Backend status
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");
  const [modelStatus, setModelStatus] = useState<"loaded" | "fallback" | "checking">("checking");

  // Apply global settings to window for other pages to read
  useEffect(() => {
    window.TF_SETTINGS = { interval, mapStyle, units, soundEnabled, alertThreshold };
  }, [interval, mapStyle, units, soundEnabled, alertThreshold]);

  // Check backend health on mount
  const checkBackend = useCallback(async () => {
    setBackendStatus("checking");
    setModelStatus("checking");
    try {
      const [healthRes, trafficRes] = await Promise.all([
        fetch("http://localhost:8000/api/health", { signal: AbortSignal.timeout(3000) }),
        fetch("http://localhost:8000/api/traffic",  { signal: AbortSignal.timeout(5000) }),
      ]);
      if (healthRes.ok) {
        setBackendStatus("online");
        if (trafficRes.ok) {
          const data = await trafficRes.json() as { ml_predictor_status?: string };
          setModelStatus(data.ml_predictor_status === "loaded" ? "loaded" : "fallback");
        }
      } else {
        setBackendStatus("offline");
        setModelStatus("fallback");
      }
    } catch {
      setBackendStatus("offline");
      setModelStatus("fallback");
    }
  }, []);

  useEffect(() => { checkBackend(); }, [checkBackend]);

  // Request browser notification permission when toggled on
  async function requestNotifPermission() {
    if (!("Notification" in window)) { toast("Browser notifications not supported", "warn"); return; }
    if (Notification.permission === "default") {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { toast("Notification permission denied", "warn"); return; }
    }
  }

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleTheme = (t: "dark" | "light") => {
    setTheme(t);
    save("tf_theme", t);
    toast(`Theme switched to ${t} mode`);
  };

  const handleLanguage = (lang: string) => {
    setLanguage(lang);
    save("tf_language", lang);
    document.documentElement.lang = lang.startsWith("English") ? "en" : "ta";
    toast(`Language set to ${lang.split(" ")[0]}`);
  };

  const handleMapStyle = (s: MapStyle) => {
    setMapStyle(s);
    save("tf_map_style", s);
    if (window.TF_SETTINGS) window.TF_SETTINGS.mapStyle = s;
    toast(`Map style: ${s}`);
  };

  const handleInterval = (n: Interval) => {
    setIntervalVal(n);
    save("tf_interval", n);
    if (window.TF_SETTINGS) window.TF_SETTINGS.interval = n;
    toast(`Prediction refresh: every ${n} min`);
  };

  const handleUnits = (u: Units) => {
    setUnits(u);
    save("tf_units", u);
    if (window.TF_SETTINGS) window.TF_SETTINGS.units = u;
    toast(`Units: ${u.split(" ")[0]}`);
  };

  const handleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    save("tf_sound", next);
    if (window.TF_SETTINGS) window.TF_SETTINGS.soundEnabled = next;
    toast(next ? "Sound alerts enabled" : "Sound alerts muted");
  };

  const handleAlertThreshold = (val: number) => {
    setAlertThreshold(val);
    save("tf_alert_threshold", val);
    if (window.TF_SETTINGS) window.TF_SETTINGS.alertThreshold = val;
  };

  const handleNotifToggle = async (key: NotifKey) => {
    if (!notifs[key]) await requestNotifPermission();
    const updated = { ...notifs, [key]: !notifs[key] };
    setNotifs(updated);
    save("tf_notifs", updated);
    toast(`${key}: ${updated[key] ? "on" : "off"}`, "info");
  };

  const handleFeatureToggle = (key: FeatureKey) => {
    const updated = { ...features, [key]: !features[key] };
    setFeatures(updated);
    save("tf_features", updated);
    const f = DASHBOARD_FEATURES.find(d => d.key === key)!;
    toast(`${f.label}: ${updated[key] ? "enabled" : "hidden"}`, "info");
  };

  const handleProfileSave = () => {
    setProfile(profileDraft);
    save("tf_profile", profileDraft);
    setEditingProfile(false);
    toast("Profile saved");
  };

  const handleExportData = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      settings: {
        theme, language, mapStyle, interval, units,
        soundEnabled, alertThreshold, notifs, features, profile,
      },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "trafficops-settings.json"; a.click();
    URL.revokeObjectURL(url);
    toast("Settings exported");
  };

  const handleResetSettings = () => {
    if (!confirm("Reset all settings to defaults?")) return;
    const KEYS = ["tf_theme","tf_language","tf_map_style","tf_interval","tf_units",
                  "tf_sound","tf_alert_threshold","tf_notifs","tf_features","tf_profile"];
    KEYS.forEach(k => localStorage.removeItem(k));
    window.location.reload();
  };

  const handleTestNotification = () => {
    if (Notification.permission === "granted") {
      new Notification("TrafficOps AI", {
        body: "Critical congestion on OMR — speed 22 km/h",
        icon: "/favicon.ico",
      });
    }
    toast("Test notification sent", "info");
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground">All changes save instantly to local storage.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportData}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs hover:bg-accent/50 transition-colors">
            <Download className="h-3.5 w-3.5" /> Export
          </button>
          <button onClick={handleResetSettings}
            className="flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive hover:bg-destructive/20 transition-colors">
            <Trash2 className="h-3.5 w-3.5" /> Reset
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">

        {/* ── Appearance ── */}
        <Section title="Appearance" icon={Sun}>
          <div className="flex gap-2">
            {(["dark", "light"] as const).map(t => (
              <button key={t} onClick={() => handleTheme(t)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border p-3 text-sm transition-colors ${
                  theme === t ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent/50"
                }`}>
                {t === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Active: <strong>{theme}</strong> mode
          </p>
        </Section>

        {/* ── Language ── */}
        <Section title="Language" icon={Globe} badge={`${LANGUAGES.length} languages`}>
          <select value={language} onChange={e => handleLanguage(e.target.value)}
            className="h-10 w-full cursor-pointer rounded-lg border border-input bg-secondary/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <p className="mt-2 text-xs text-muted-foreground">
            Current: <strong>{language}</strong>
          </p>
        </Section>

        {/* ── Map style ── */}
        <Section title="Map Style" icon={Map}>
          <div className="grid grid-cols-3 gap-2">
            {MAP_STYLES.map(s => (
              <button key={s} onClick={() => handleMapStyle(s)}
                className={`rounded-lg border p-3 text-sm transition-colors ${
                  mapStyle === s ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent/50"
                }`}>
                {s}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Active: <strong>{mapStyle}</strong></p>
        </Section>

        {/* ── Units ── */}
        <Section title="Units" icon={Gauge}>
          <div className="flex flex-col gap-2">
            {UNITS.map(u => (
              <button key={u} onClick={() => handleUnits(u)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                  units === u ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent/50"
                }`}>
                <span className={`h-2 w-2 rounded-full ${units === u ? "bg-primary" : "bg-muted-foreground/30"}`} />
                {u}
              </button>
            ))}
          </div>
        </Section>

        {/* ── Prediction interval ── */}
        <Section title="Prediction Refresh" icon={Clock}>
          <div className="flex gap-2">
            {INTERVALS.map(n => (
              <button key={n} onClick={() => handleInterval(n)}
                className={`flex-1 rounded-lg border p-2.5 text-sm transition-colors ${
                  interval === n ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent/50"
                }`}>
                {n}m
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Refreshing every <strong>{interval} min</strong>
          </p>
        </Section>

        {/* ── Alert threshold ── */}
        <Section title="Alert Threshold" icon={AlertTriangle}>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Trigger alerts when congestion ≥</span>
              <span className="font-display text-lg font-bold text-primary">{alertThreshold}%</span>
            </div>
            <input type="range" min={20} max={95} step={5}
              value={alertThreshold}
              onChange={e => handleAlertThreshold(Number(e.target.value))}
              className="w-full accent-[var(--color-primary)] cursor-pointer" />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>20% (sensitive)</span><span>50% (moderate)</span><span>95% (critical only)</span>
            </div>
          </div>
        </Section>

        {/* ── Sound ── */}
        <Section title="Sound Alerts" icon={soundEnabled ? Volume2 : VolumeX}>
          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div>
              <div className="text-sm font-medium">Alert sounds</div>
              <div className="text-xs text-muted-foreground">Play a sound for critical congestion</div>
            </div>
            <Toggle checked={soundEnabled} onChange={handleSound} />
          </div>
        </Section>

        {/* ── Notifications ── */}
        <Section title="Notifications" icon={Bell}>
          <div className="space-y-2">
            {NOTIF_KEYS.map(n => (
              <div key={n}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 transition-colors hover:bg-accent/20">
                <span className="text-sm">{n}</span>
                <Toggle checked={notifs[n]} onChange={() => handleNotifToggle(n)} />
              </div>
            ))}
          </div>
          <button onClick={handleTestNotification}
            className="mt-3 w-full rounded-lg border border-border px-3 py-2 text-xs hover:bg-accent/50 transition-colors flex items-center justify-center gap-1.5">
            <Bell className="h-3.5 w-3.5" /> Send test notification
          </button>
        </Section>

        {/* ── Dashboard features toggle ── */}
        <Section title="Dashboard Features" icon={Eye} badge="all features">
          <div className="space-y-2">
            {DASHBOARD_FEATURES.map(f => (
              <div key={f.key}
                className="flex items-start justify-between rounded-lg border border-border px-3 py-2.5 transition-colors hover:bg-accent/20">
                <div className="mr-3">
                  <div className="text-sm font-medium">{f.label}</div>
                  <div className="text-xs text-muted-foreground">{f.desc}</div>
                </div>
                <Toggle checked={features[f.key as FeatureKey]} onChange={() => handleFeatureToggle(f.key as FeatureKey)} />
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {Object.values(features).filter(Boolean).length} of {DASHBOARD_FEATURES.length} features enabled
          </p>
        </Section>

        {/* ── Backend / Model status ── */}
        <Section title="System Status" icon={Activity}>
          <div className="space-y-3">
            {/* Backend */}
            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <div className="flex items-center gap-2">
                {backendStatus === "online"
                  ? <Wifi className="h-4 w-4 text-green-400" />
                  : backendStatus === "offline"
                  ? <WifiOff className="h-4 w-4 text-red-400" />
                  : <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
                <div>
                  <div className="text-sm font-medium">FastAPI Backend</div>
                  <div className="text-xs text-muted-foreground">localhost:8000</div>
                </div>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                backendStatus === "online"   ? "bg-green-500/15 text-green-400" :
                backendStatus === "offline"  ? "bg-red-500/15 text-red-400" :
                                              "bg-muted/30 text-muted-foreground"}`}>
                {backendStatus}
              </span>
            </div>

            {/* ML Model */}
            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <Shield className={`h-4 w-4 ${modelStatus === "loaded" ? "text-green-400" : "text-orange-400"}`} />
                <div>
                  <div className="text-sm font-medium">XGBoost Model</div>
                  <div className="text-xs text-muted-foreground">xgboost_congestion_model.json</div>
                </div>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                modelStatus === "loaded"   ? "bg-green-500/15 text-green-400" :
                modelStatus === "fallback" ? "bg-orange-400/15 text-orange-400" :
                                            "bg-muted/30 text-muted-foreground"}`}>
                {modelStatus === "loaded" ? "ML active" : modelStatus === "fallback" ? "rule-based" : "checking…"}
              </span>
            </div>

            {/* WebSocket */}
            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <div>
                  <div className="text-sm font-medium">WebSocket</div>
                  <div className="text-xs text-muted-foreground">ws://localhost:8000/ws/live</div>
                </div>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                backendStatus === "online" ? "bg-primary/15 text-primary" : "bg-muted/30 text-muted-foreground"}`}>
                {backendStatus === "online" ? "streaming" : "disconnected"}
              </span>
            </div>

            <button onClick={checkBackend}
              className="w-full rounded-lg border border-border px-3 py-2 text-xs hover:bg-accent/50 transition-colors flex items-center justify-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Re-check status
            </button>
          </div>
        </Section>

        {/* ── Profile ── */}
        <Section title="Profile" icon={User}>
          {!editingProfile ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground text-xl font-bold shadow-lg">
                  {profile.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{profile.name}</div>
                  <div className="text-sm text-muted-foreground">{profile.email}</div>
                  <div className="text-xs text-primary mt-0.5">{profile.role}</div>
                </div>
                <button onClick={() => { setProfileDraft(profile); setEditingProfile(true); }}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-accent/50 transition-colors">
                  Edit
                </button>
              </div>
              <div className="rounded-lg bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
                Logged in as <strong className="text-foreground">{profile.role}</strong> · Session active
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {[
                { label: "Name",  key: "name",  type: "text" },
                { label: "Email", key: "email", type: "email" },
                { label: "Role",  key: "role",  type: "text" },
              ].map(f => (
                <div key={f.key}>
                  <label className="mb-1 block text-xs text-muted-foreground">{f.label}</label>
                  <input type={f.type}
                    value={(profileDraft as Record<string, string>)[f.key]}
                    onChange={e => setProfileDraft({ ...profileDraft, [f.key]: e.target.value })}
                    className="h-9 w-full rounded-lg border border-input bg-secondary/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              ))}
              <div className="flex gap-2">
                <button onClick={handleProfileSave}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity">
                  <Save className="h-3.5 w-3.5" /> Save
                </button>
                <button onClick={() => { setProfileDraft(profile); setEditingProfile(false); }}
                  className="flex-1 rounded-lg border border-border px-3 py-2 text-xs hover:bg-accent/50 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </Section>

        {/* ── Privacy / Data ── */}
        <Section title="Privacy & Data" icon={EyeOff}>
          <div className="space-y-2 text-sm">
            {[
              { l: "Data storage",   v: "Local browser only" },
              { l: "API calls",      v: "Backend at localhost:8000" },
              { l: "External APIs",  v: "TomTom + OpenWeather (optional)" },
              { l: "ML model",       v: "Runs entirely on-device" },
              { l: "No telemetry",   v: "Zero data sent to third parties" },
            ].map(row => (
              <div key={row.l} className="flex justify-between border-b border-border/40 pb-1.5">
                <span className="text-muted-foreground">{row.l}</span>
                <span className="font-medium text-xs">{row.v}</span>
              </div>
            ))}
          </div>
          <button onClick={handleExportData}
            className="mt-3 w-full rounded-lg border border-border px-3 py-2 text-xs hover:bg-accent/50 transition-colors flex items-center justify-center gap-1.5">
            <Download className="h-3.5 w-3.5" /> Export all settings as JSON
          </button>
        </Section>

      </div>

      {ToastEl}
    </>
  );
}
