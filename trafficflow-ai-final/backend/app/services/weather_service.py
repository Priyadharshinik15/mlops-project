"""
Real weather data from OpenWeather's One Call / current-weather endpoint.
Cached in memory so we don't re-hit the API more often than
WEATHER_REFRESH_SECONDS, regardless of how many browsers are connected.
If OpenWeather API key is not valid, automatically falls back to simulated
dynamic weather for Chennai.
"""
import time
import math
import datetime
import httpx

from app.core.config import settings

_cache: dict = {}
_cache_time: float = 0.0

_forecast_cache: dict = {}
_forecast_cache_time: float = 0.0


def _is_key_valid(key: str) -> bool:
    return bool(key and key.strip() and "YOUR_REAL_KEY" not in key and "api_key" not in key)


def _simulate_weather(now_time: float) -> dict:
    now = datetime.datetime.fromtimestamp(now_time)
    hour = now.hour
    
    # Coldest at 5 AM (~24 C), hottest at 2 PM (~34 C)
    temp = round(29.0 + 5.0 * math.sin((hour - 8) * math.pi / 12), 1)
    
    # 20% chance of rain based on timestamp block (rains for 30m every 4h)
    is_rainy = (int(now_time // 1800) % 8 == 0)
    rain = 4.5 if is_rainy else 0.0
    cond = "Rain" if is_rainy else "Clear" if hour in [6, 7, 8, 9, 16, 17, 18, 19] else "Clouds"
    desc = "light rain" if is_rainy else "clear sky" if cond == "Clear" else "few clouds"
    
    return {
        "source": "simulated",
        "fetched_at": now_time,
        "temp_c": temp,
        "feels_like_c": round(temp + (2.0 if is_rainy else 1.0), 1),
        "humidity": 85 if is_rainy else 60,
        "condition": cond,
        "description": desc,
        "wind_kph": 12.5 if is_rainy else 8.0,
        "rain_mm": rain,
        "visibility_m": 6000 if is_rainy else 10000,
    }


async def get_weather(lat: float | None = None, lon: float | None = None) -> dict:
    global _cache, _cache_time

    lat = lat if lat is not None else settings.DEFAULT_LAT
    lon = lon if lon is not None else settings.DEFAULT_LON

    now = time.time()
    if _cache and (now - _cache_time) < settings.WEATHER_REFRESH_SECONDS:
        return _cache

    if not _is_key_valid(settings.OPENWEATHER_API_KEY):
        _cache = _simulate_weather(now)
        _cache_time = now
        return _cache

    url = "https://api.openweathermap.org/data/2.5/weather"
    params = {
        "lat": lat,
        "lon": lon,
        "appid": settings.OPENWEATHER_API_KEY,
        "units": "metric",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()

        result = {
            "source": "openweather",
            "fetched_at": now,
            "temp_c": data["main"]["temp"],
            "feels_like_c": data["main"].get("feels_like", data["main"]["temp"]),
            "humidity": data["main"]["humidity"],
            "condition": data["weather"][0]["main"],
            "description": data["weather"][0]["description"],
            "wind_kph": round(data["wind"]["speed"] * 3.6, 1),
            "rain_mm": data.get("rain", {}).get("1h", 0),
            "visibility_m": data.get("visibility"),
        }
        _cache = result
        _cache_time = now
        return result
    except Exception as e:
        print(f"Weather API call failed ({e}), falling back to simulation")
        _cache = _simulate_weather(now)
        _cache_time = now
        return _cache


async def get_forecast(lat: float | None = None, lon: float | None = None) -> dict:
    global _forecast_cache, _forecast_cache_time

    lat = lat if lat is not None else settings.DEFAULT_LAT
    lon = lon if lon is not None else settings.DEFAULT_LON

    now = time.time()
    if _forecast_cache and (now - _forecast_cache_time) < settings.WEATHER_REFRESH_SECONDS:
        return _forecast_cache

    if not _is_key_valid(settings.OPENWEATHER_API_KEY):
        steps = []
        for i in range(6):
            future_time = datetime.datetime.fromtimestamp(now) + datetime.timedelta(hours=i*3)
            f_hour = future_time.hour
            f_temp = round(29.0 + 5.0 * math.sin((f_hour - 8) * math.pi / 12), 1)
            f_is_rain = (int((now + i * 3 * 3600) // 1800) % 8 == 0)
            f_cond = "Rain" if f_is_rain else "Clear" if f_hour in [6, 7, 8, 9, 16, 17, 18, 19] else "Clouds"
            steps.append({
                "time": future_time.strftime("%Y-%m-%d %H:%M:%S"),
                "temp_c": f_temp,
                "condition": f_cond,
                "rain_mm": 3.0 if f_is_rain else 0.0,
            })
        _forecast_cache = {"source": "simulated", "fetched_at": now, "steps": steps}
        _forecast_cache_time = now
        return _forecast_cache

    url = "https://api.openweathermap.org/data/2.5/forecast"
    params = {"lat": lat, "lon": lon, "appid": settings.OPENWEATHER_API_KEY, "units": "metric", "cnt": 6}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()

        steps = [
            {
                "time": item["dt_txt"],
                "temp_c": item["main"]["temp"],
                "condition": item["weather"][0]["main"],
                "rain_mm": item.get("rain", {}).get("3h", 0),
            }
            for item in data.get("list", [])
        ]

        result = {"source": "openweather", "fetched_at": now, "steps": steps}
        _forecast_cache = result
        _forecast_cache_time = now
        return result
    except Exception as e:
        print(f"Forecast API call failed ({e}), falling back to simulation")
        # generate mock forecast steps
        steps = []
        for i in range(6):
            future_time = datetime.datetime.fromtimestamp(now) + datetime.timedelta(hours=i*3)
            f_hour = future_time.hour
            f_temp = round(29.0 + 5.0 * math.sin((f_hour - 8) * math.pi / 12), 1)
            f_is_rain = (int((now + i * 3 * 3600) // 1800) % 8 == 0)
            f_cond = "Rain" if f_is_rain else "Clear" if f_hour in [6, 7, 8, 9, 16, 17, 18, 19] else "Clouds"
            steps.append({
                "time": future_time.strftime("%Y-%m-%d %H:%M:%S"),
                "temp_c": f_temp,
                "condition": f_cond,
                "rain_mm": 3.0 if f_is_rain else 0.0,
            })
        _forecast_cache = {"source": "simulated", "fetched_at": now, "steps": steps}
        _forecast_cache_time = now
        return _forecast_cache
