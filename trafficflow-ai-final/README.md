# TrafficOps AI

> Real-time AI-powered traffic monitoring, congestion prediction, and smart route planning for Chennai.

![Tech Stack](https://img.shields.io/badge/Stack-FastAPI%20%7C%20React%2019%20%7C%20XGBoost%20%7C%20MapLibre-blue)
![Python](https://img.shields.io/badge/Python-3.12-green)
![Node](https://img.shields.io/badge/Node.js-22-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

## What It Does

TrafficOps AI is a full-stack web application that monitors city traffic in real time, predicts congestion using a trained XGBoost machine learning model, and helps users plan optimal routes with live map navigation.

| Feature | Description |
|---|---|
| 🗺 **Live Traffic Map** | Real-time road-level congestion heatmap centered on your GPS location |
| 🤖 **AI Congestion Prediction** | XGBoost model predicts congestion scores using 15 features (speed, weather, time, holidays) |
| 🧭 **AI Route Planner** | Multi-route planning with real road geometry from OSRM — AI, Fastest, Eco, Avoid-Traffic, Avoid-Toll |
| 🌦 **Live Weather Integration** | Current conditions and 18-hour forecast via OpenWeather API |
| 🔔 **Smart Alerts** | Automatic alerts derived from live traffic + weather data |
| 📊 **Analytics Dashboard** | Hourly and weekly congestion trends, weather impact analysis |
| 🏙 **City Comparison** | Compare traffic across Chennai, Bangalore, Hyderabad, Mumbai, Delhi |
| 📡 **WebSocket Live Updates** | Backend pushes updates to all connected browsers every 5 seconds |
| 📍 **Real GPS Location** | All maps, weather, and routing use your actual device GPS |

---

## Tech Stack

### Backend
| Technology | Version | Purpose |
|---|---|---|
| **FastAPI** | 0.115.6 | REST API + WebSocket server |
| **Uvicorn** | 0.34.0 | ASGI server |
| **XGBoost** | latest | Congestion prediction ML model |
| **scikit-learn** | latest | Model pipeline |
| **pandas / numpy** | latest | Feature engineering |
| **httpx** | 0.28.1 | Async HTTP client for TomTom & OpenWeather |
| **python-dotenv** | 1.0.1 | Environment variable management |

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| **React** | 19.2 | UI framework |
| **TanStack Router** | 1.170 | File-based routing |
| **TanStack Query** | 5.101 | Server state management |
| **MapLibre GL** | 5.24 | Interactive maps (no API key needed) |
| **Recharts** | 2.15 | Analytics charts |
| **Tailwind CSS** | 4.2 | Styling |
| **Vite** | latest | Build tool |

### ML Pipeline
| Component | Details |
|---|---|
| **Model** | XGBoost multi-class classifier (Low / Medium / High / VeryHigh congestion) |
| **Features** | 15 features: speed, free-flow speed, road class, probe count, hour, day, peak-hour flag, weekend flag, temperature, wind, pressure, rainfall, holiday flag |
| **Training data** | Chennai road segments with simulated + real traffic observations |
| **Model file** | `mlops-model-pipeline/models/xgboost_congestion_model.json` |

---

## Project Structure

```
trafficflow-ai-final/
├── backend/
│   ├── app/
│   │   ├── api/              # FastAPI route handlers
│   │   │   ├── traffic.py    # GET /api/traffic
│   │   │   ├── weather.py    # GET /api/weather
│   │   │   ├── prediction.py # GET /api/prediction
│   │   │   ├── route.py      # POST /api/route
│   │   │   ├── alerts.py     # GET /api/alerts
│   │   │   ├── analytics.py  # GET /api/analytics
│   │   │   ├── cities.py     # GET /api/cities
│   │   │   └── model.py      # GET /api/model (ML metrics)
│   │   ├── services/         # Business logic layer
│   │   │   ├── traffic_service.py     # TomTom Flow API + XGBoost inference
│   │   │   ├── weather_service.py     # OpenWeather API
│   │   │   ├── prediction_service.py  # 60-min trend forecast
│   │   │   ├── route_service.py       # TomTom Routing API
│   │   │   ├── alerts_service.py      # Alert generation
│   │   │   ├── analytics_service.py   # Historical trend math
│   │   │   ├── city_service.py        # Multi-city comparison
│   │   │   └── model_service.py       # XGBoost metrics
│   │   ├── websocket/
│   │   │   └── live.py       # WebSocket broadcaster (5s interval)
│   │   ├── core/
│   │   │   └── config.py     # App settings from .env
│   │   └── main.py           # FastAPI app entry point
│   ├── .env                  # Your API keys (not committed)
│   ├── .env.example          # Template
│   └── requirements.txt
│
├── frontend/
│   └── src/
│       ├── routes/           # File-based pages
│       │   ├── dashboard.index.tsx         # Home dashboard
│       │   ├── dashboard.map.tsx           # Full traffic map
│       │   ├── dashboard.route-planner.tsx # AI route planner
│       │   ├── dashboard.weather.tsx       # Weather page
│       │   ├── dashboard.analytics.tsx     # Analytics charts
│       │   ├── dashboard.alerts.tsx        # Alerts feed
│       │   └── dashboard.cities.tsx        # City comparison
│       ├── components/
│       │   ├── map/
│       │   │   ├── LiveMap.tsx             # MapLibre traffic heatmap
│       │   │   └── NavigationMap.tsx       # Route navigation map
│       │   └── ui/                         # shadcn/ui components
│       ├── hooks/
│       │   ├── useLiveData.ts              # WebSocket + REST data hook
│       │   └── useGeoLocation.ts           # Real GPS hook
│       └── services/
│           └── api.ts                      # All backend API calls
│
└── mlops-model-pipeline/
    └── models/
        └── xgboost_congestion_model.json   # Trained XGBoost model
```

---

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 22+
- npm 11+

---

### Step 1 — Clone the repo

```bash
git clone <your-repo-url>
cd trafficflow-ai-final
```

---

### Step 2 — Backend setup

```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

---

### Step 3 — Configure API keys (optional but recommended)

Copy the example env file and fill in your keys:

```powershell
copy .env.example .env
```

Edit `backend/.env`:

```env
OPENWEATHER_API_KEY="your_openweather_key_here"
TOMTOM_API_KEY="your_tomtom_key_here"
```

> **Free keys available at:**
> - OpenWeather → https://openweathermap.org/api (60 calls/min free)
> - TomTom → https://developer.tomtom.com (2500 calls/day free)
>
> **Without keys:** The app fully works in simulation mode — realistic Chennai traffic and weather data is generated automatically. Route planning requires a TomTom key.

---

### Step 4 — Start the backend

```powershell
uvicorn app.main:app --reload --port 8000
```

Backend is running at → `http://localhost:8000`
API docs → `http://localhost:8000/docs`

---

### Step 5 — Frontend setup (new terminal)

```powershell
cd frontend
npm install
npm run dev
```

Frontend is running at → `http://localhost:8080`

---

### Step 6 — Open in browser

```
http://localhost:8080
```

When the app loads, your browser will ask for **location permission** — click **Allow** so maps, weather, and routing use your real GPS coordinates.

---

## API Reference

All endpoints are available at `http://localhost:8000`. Interactive docs at `/docs`.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/traffic` | Live road speeds and congestion scores for 4 Chennai roads |
| `GET` | `/api/weather?lat=&lon=` | Current weather + 18-hour forecast for given coordinates |
| `GET` | `/api/prediction` | 60-minute congestion trend forecast using XGBoost |
| `POST` | `/api/route` | Calculate optimal route between two coordinates |
| `GET` | `/api/alerts` | Active traffic and weather alerts |
| `GET` | `/api/analytics` | Hourly and weekly congestion analytics |
| `GET` | `/api/cities` | Traffic summary for 5 Indian cities |
| `GET` | `/api/model` | XGBoost model performance metrics |
| `GET` | `/api/health` | Health check |
| `WS` | `/ws/live` | WebSocket — pushes traffic + weather + alerts every 5 seconds |

---

## Real vs Simulated Data

| Feature | With API Keys | Without API Keys |
|---|---|---|
| Traffic speeds | ✅ Live from TomTom Flow API | 🔄 Simulated with peak-hour math |
| Weather | ✅ Live from OpenWeather API | 🔄 Simulated with sinusoidal temperature model |
| ML congestion score | ✅ Real XGBoost inference (model on disk) | ✅ Real XGBoost inference (model on disk) |
| Route planning | ✅ Real TomTom routing | ❌ Requires TomTom key |
| Route geometry | ✅ Real road lines via OSRM (free) | ✅ Real road lines via OSRM (free) |
| Map tiles | ✅ OpenStreetMap (always free) | ✅ OpenStreetMap (always free) |
| Geocoding | ✅ Nominatim OSM (free) | ✅ Nominatim OSM (free) |
| GPS location | ✅ Browser GPS API | ✅ Browser GPS API |
| City comparison | ✅ Live TomTom + OpenWeather | 🔄 Simulated per-city baselines |

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `OPENWEATHER_API_KEY` | `""` | OpenWeather free tier API key |
| `TOMTOM_API_KEY` | `""` | TomTom developer API key |
| `DEFAULT_LAT` | `13.0827` | Fallback latitude (Chennai) |
| `DEFAULT_LON` | `80.2707` | Fallback longitude (Chennai) |
| `WEATHER_REFRESH_SECONDS` | `300` | How often to call OpenWeather (5 min) |
| `TRAFFIC_REFRESH_SECONDS` | `60` | How often to call TomTom (1 min) |
| `BROADCAST_INTERVAL_SECONDS` | `5` | WebSocket push interval |

---

## Troubleshooting

**`Fatal error in launcher` when running uvicorn**
> Your virtual environment has a broken path (moved/renamed). Delete it and recreate:
> ```powershell
> Remove-Item -Recurse -Force venv
> python -m venv venv
> .\venv\Scripts\activate
> pip install -r requirements.txt
> ```

**`npm install` fails with EBUSY**
> OneDrive is locking files. Pause OneDrive sync (right-click tray icon → Pause 2 hours), then retry. Consider moving the project outside of OneDrive.

**`Cannot find module vite/bin/vite.js`**
> `node_modules` is corrupt. Delete it and reinstall:
> ```powershell
> cmd /c "rd /s /q node_modules"
> npm install
> ```

**Maps show a blank/grey screen**
> MapLibre GL requires WebGL. Make sure your browser supports WebGL (Chrome, Edge, Firefox all do). Check `chrome://gpu` for WebGL status.

**Route planner shows "Set TOMTOM_API_KEY"**
> Route planning needs a TomTom API key. Get one free at https://developer.tomtom.com and add it to `backend/.env`.

**GPS shows "⚠ GPS denied"**
> Click the 🔒 lock icon in your browser's address bar → Location → Allow → Refresh.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "Add your feature"`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a pull request

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

*Built with FastAPI, React 19, XGBoost, and MapLibre GL.*
