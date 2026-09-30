"""
City comparison: fetches real TomTom traffic + OpenWeather data for multiple
cities in parallel. Falls back gracefully to simulation if API keys are missing or invalid.
"""
import asyncio
import time
import random
import math
import datetime
import httpx

from app.core.config import settings

# Cities to compare — Chennai is first (our "home" city with live data)
CITIES = [
    {"name": "Chennai",    "lat": 13.0827, "lon": 80.2707},
    {"name": "Bangalore",  "lat": 12.9716, "lon": 77.5946},
    {"name": "Hyderabad",  "lat": 17.3850, "lon": 78.4867},
    {"name": "Mumbai",     "lat": 19.0760, "lon": 72.8777},
    {"name": "Delhi",      "lat": 28.7041, "lon": 77.1025},
]

# Sample central road point per city for TomTom flow segment
CITY_ROAD_POINTS = {
    "Chennai":   {"lat": 13.0418, "lon": 80.2417},   # Anna Salai
    "Bangalore": {"lat": 12.9352, "lon": 77.6245},   # Outer Ring Road
    "Hyderabad": {"lat": 17.4400, "lon": 78.3489},   # HITEC City
    "Mumbai":    {"lat": 19.0220, "lon": 72.8562},   # Western Express Hwy
    "Delhi":     {"lat": 28.6315, "lon": 77.2167},   # NH-44
}

_cache: dict = {}
_cache_time: float = 0.0
_CACHE_TTL = 120  # 2 minutes


def _is_key_valid(key: str) -> bool:
    return bool(key and key.strip() and "YOUR_REAL_KEY" not in key and "api_key" not in key)


def _simulate_city(name: str, now_time: float) -> dict:
    dt = datetime.datetime.fromtimestamp(now_time)
    hour = dt.hour
    
    # Base congestion multiplier based on hour (peaks at 9 AM and 6 PM)
    peak_factor = 0.4 if (8 <= hour <= 10 or 17 <= hour <= 20) else 0.85
    
    # Distinct baselines per city (Bangalore has the worst traffic!)
    city_baselines = {
        "Chennai":   {"free_flow": 50.0, "factor": 1.0,  "temp": 31.0, "cond": "Clear", "rain": 0.0},
        "Bangalore": {"free_flow": 45.0, "factor": 0.75, "temp": 24.5, "cond": "Clouds", "rain": 0.0},
        "Hyderabad": {"free_flow": 55.0, "factor": 0.95, "temp": 30.0, "cond": "Clear", "rain": 0.0},
        "Mumbai":    {"free_flow": 50.0, "factor": 0.80, "temp": 28.0, "cond": "Rain",   "rain": 2.5},
        "Delhi":     {"free_flow": 60.0, "factor": 0.85, "temp": 33.0, "cond": "Clear", "rain": 0.0},
    }
    
    base = city_baselines.get(name, {"free_flow": 50.0, "factor": 1.0, "temp": 28.0, "cond": "Clear", "rain": 0.0})
    free_flow = base["free_flow"]
    
    # Seed by name + minute to ensure dynamic but stable variation
    seed_val = sum(ord(c) for c in name)
    random.seed(seed_val + int(now_time // 60))
    
    ratio = max(0.12, min(0.98, peak_factor * base["factor"] + random.uniform(-0.1, 0.1)))
    current_speed = round(free_flow * ratio, 1)
    
    # Calculate congestion score
    rain_mm = base["rain"]
    rain_penalty = min(15, rain_mm * 3)
    congestion_score = min(100, round((1 - ratio) * 100 + rain_penalty))
    
    if congestion_score < 25:
        level = "free-flow"
    elif congestion_score < 50:
        level = "moderate"
    elif congestion_score < 75:
        level = "heavy"
    else:
        level = "critical"
        
    incidents = max(0, round((1 - ratio) * 12 + random.randint(0, 2)))
    
    # Temperature curve
    temp = round(base["temp"] + 3.0 * math.sin((hour - 8) * math.pi / 12), 1)

    return {
        "name": name,
        "lat": CITY_ROAD_POINTS[name]["lat"],
        "lon": CITY_ROAD_POINTS[name]["lon"],
        "temp_c": temp,
        "condition": base["cond"],
        "rain_mm": rain_mm,
        "current_speed_kph": current_speed,
        "free_flow_speed_kph": free_flow,
        "congestion_score": congestion_score,
        "level": level,
        "incidents": incidents,
    }


async def _fetch_city(city: dict, client: httpx.AsyncClient) -> dict:
    name = city["name"]
    road = CITY_ROAD_POINTS[name]

    # Weather
    temp_c = None
    condition = "—"
    rain_mm = 0.0

    if _is_key_valid(settings.OPENWEATHER_API_KEY):
        try:
            wr = await client.get(
                "https://api.openweathermap.org/data/2.5/weather",
                params={"lat": city["lat"], "lon": city["lon"],
                        "appid": settings.OPENWEATHER_API_KEY, "units": "metric"},
            )
            wr.raise_for_status()
            wd = wr.json()
            temp_c = round(wd["main"]["temp"], 1)
            condition = wd["weather"][0]["main"]
            rain_mm = wd.get("rain", {}).get("1h", 0)
        except Exception:
            pass

    # Traffic
    speed_kph = None
    free_flow_kph = None
    congestion_score = None
    level = "unknown"
    incidents = 0

    if _is_key_valid(settings.TOMTOM_API_KEY):
        try:
            tr = await client.get(
                "https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json",
                params={"key": settings.TOMTOM_API_KEY,
                        "point": f"{road['lat']},{road['lon']}"},
            )
            tr.raise_for_status()
            seg = tr.json()["flowSegmentData"]
            speed_kph = seg["currentSpeed"]
            free_flow_kph = seg["freeFlowSpeed"]
            
            # Anna Salai specific model logic for Chennai if available
            if name == "Chennai":
                try:
                    from app.services.traffic_service import calculate_road_congestion
                    congestion = await calculate_road_congestion(
                        "Anna Salai - Teynampet", speed_kph, free_flow_kph, rain_mm
                    )
                    congestion_score = congestion["score"]
                    level = congestion["level"]
                except Exception:
                    pass
            
            if congestion_score is None:
                ratio = max(0.0, min(1.0, speed_kph / max(free_flow_kph, 1)))
                rain_penalty = min(15, rain_mm * 3)
                congestion_score = min(100, round((1 - ratio) * 100 + rain_penalty))
                if congestion_score < 25:
                    level = "free-flow"
                elif congestion_score < 50:
                    level = "moderate"
                elif congestion_score < 75:
                    level = "heavy"
                else:
                    level = "critical"
            
            confidence = seg.get("confidence", 1.0)
            incidents = max(0, round((1 - confidence) * 20))
        except Exception:
            pass

    # Fallback to simulation per-city if real fetch failed or keys are invalid
    if temp_c is None or congestion_score is None:
        sim = _simulate_city(name, time.time())
        if temp_c is None:
            temp_c = sim["temp_c"]
            condition = sim["condition"]
            rain_mm = sim["rain_mm"]
        if congestion_score is None:
            speed_kph = sim["current_speed_kph"]
            free_flow_kph = sim["free_flow_speed_kph"]
            congestion_score = sim["congestion_score"]
            level = sim["level"]
            incidents = sim["incidents"]

    return {
        "name": name,
        "lat": city["lat"],
        "lon": city["lon"],
        "temp_c": temp_c,
        "condition": condition,
        "rain_mm": rain_mm,
        "current_speed_kph": speed_kph,
        "free_flow_speed_kph": free_flow_kph,
        "congestion_score": congestion_score,
        "level": level,
        "incidents": incidents,
    }


async def get_city_comparison() -> dict:
    global _cache, _cache_time

    now = time.time()
    if _cache and (now - _cache_time) < _CACHE_TTL:
        return _cache

    async with httpx.AsyncClient(timeout=12.0) as client:
        results = await asyncio.gather(
            *[_fetch_city(c, client) for c in CITIES],
            return_exceptions=True,
        )

    cities_data = []
    for r in results:
        if isinstance(r, Exception):
            continue
        cities_data.append(r)

    # Rank by congestion score descending (lower = better traffic health)
    scored = [c for c in cities_data if c["congestion_score"] is not None]
    best = min(scored, key=lambda c: c["congestion_score"])["name"] if scored else "—"

    result = {
        "source": "tomtom+openweather",
        "best_city": best,
        "cities": cities_data,
    }
    _cache = result
    _cache_time = now
    return result
