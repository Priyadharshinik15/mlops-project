"""
Real traffic speed data from TomTom's Traffic Flow API, for a fixed list of
road points (see TRACKED_ROAD_POINTS in config.py). Cached in memory.
Integrates the trained XGBoost model from the MLOps pipeline to predict
congestion levels. Falls back to a rule-based formula if dependencies or models
are missing.
"""
import time
import random
import datetime
import os
import json
import httpx

from app.core.config import settings
from app.services.weather_service import get_weather

# Try to import ML dependencies
try:
    import xgboost as xgb
    import pandas as pd
    import numpy as np
    HAS_ML_DEPS = True
except ImportError:
    HAS_ML_DEPS = False

_cache: dict = {}
_cache_time: float = 0.0

# Road metadata matching features expected by the XGBoost model
ROAD_METADATA = {
    "OMR - Sholinganallur":   {"speedLimit": 80.0, "frc": 1, "distance": 1500.0, "free_flow_speed": 60.0},
    "GST Road - Tambaram":    {"speedLimit": 80.0, "frc": 1, "distance": 2000.0, "free_flow_speed": 55.0},
    "Anna Salai - Teynampet": {"speedLimit": 60.0, "frc": 2, "distance": 1000.0, "free_flow_speed": 50.0},
    "ECR - Neelankarai":      {"speedLimit": 50.0, "frc": 3, "distance": 1200.0, "free_flow_speed": 65.0},
}

FEATURES = [
    "speedLimit",
    "frc",
    "distance",
    "probeCount",
    "hour",
    "day_of_week",
    "is_weekend",
    "is_peak_hour",
    "avg_temp",
    "wind_speed",
    "air_pressure",
    "rainfall",
    "is_holiday",
    "holiday_type"
]


def _is_key_valid(key: str) -> bool:
    return bool(key and key.strip() and "YOUR_REAL_KEY" not in key and "api_key" not in key)


def _check_holiday(dt: datetime.datetime) -> tuple[int, str]:
    month, day = dt.month, dt.day
    if month == 8 and day == 15:
        return 1, "Independence Day / Parsi New Year's day/ Nauraj"
    elif month == 8 and day == 19:
        return 1, "Raksha Bandhan"
    elif month == 8 and day == 27:
        return 1, "Janmashtami (Vaishnva)"
    return 0, "None"


class CongestionPredictor:
    def __init__(self):
        self.model = None
        self.holiday_name_to_code = {}
        self.load_model()

    def load_model(self):
        if not HAS_ML_DEPS:
            return
        try:
            # Sibling directory resolution
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            mlops_dir = os.path.abspath(os.path.join(base_dir, "..", "mlops-model-pipeline"))
            model_path = os.path.join(mlops_dir, "models", "xgboost_congestion_model.json")
            encoder_path = os.path.join(mlops_dir, "models", "preprocessing", "holiday_type_encoder.json")

            if os.path.exists(model_path):
                self.model = xgb.XGBClassifier()
                self.model.load_model(model_path)
                print(f"CongestionPredictor: Loaded model successfully from {model_path}")
            else:
                print(f"CongestionPredictor: Model file not found at {model_path}")

            if os.path.exists(encoder_path):
                with open(encoder_path) as f:
                    code_to_name = json.load(f)
                    self.holiday_name_to_code = {v: int(k) for k, v in code_to_name.items()}
            else:
                self.holiday_name_to_code = {"None": 2}
        except Exception as e:
            print(f"CongestionPredictor: Failed to load model files: {e}")
            self.model = None

    def predict_score(self, record: dict) -> dict:
        """
        Runs XGBoost classification and computes a continuous 0-100 score:
        Score = P(Low)*12 + P(Medium)*38 + P(High)*68 + P(Very High)*92
        """
        if self.model is None or not HAS_ML_DEPS:
            # Rule-based fallback
            return self._rule_based_fallback(record)

        try:
            row = dict(record)
            # Map holiday name to int code
            ht = row.get("holiday_type", "None")
            row["holiday_type"] = self.holiday_name_to_code.get(ht, self.holiday_name_to_code.get("None", 2))

            df = pd.DataFrame([row])[FEATURES]
            probs = self.model.predict_proba(df)[0].tolist()
            # Classes order: Low (0), Medium (1), High (2), Very High (3)
            # Match class probability names
            prob_map = dict(zip(["Low", "Medium", "High", "Very High"], probs))

            score = round(probs[0] * 12 + probs[1] * 38 + probs[2] * 68 + probs[3] * 92)
            
            # Map score to status levels
            if score < 25:
                level = "free-flow"
            elif score < 50:
                level = "moderate"
            elif score < 75:
                level = "heavy"
            else:
                level = "critical"

            return {
                "score": score,
                "level": level,
                "probabilities": prob_map,
                "ml_model_used": True,
            }
        except Exception as e:
            print(f"CongestionPredictor: Inference error ({e}), falling back to rule-based")
            return self._rule_based_fallback(record)

    def _rule_based_fallback(self, record: dict) -> dict:
        speed = record.get("current_speed", 40.0)
        free_flow = record.get("speedLimit", 60.0) # free flow proxy
        rain_mm = record.get("rainfall", 0.0)

        ratio = max(0.0, min(1.0, speed / free_flow))
        base_score = round((1 - ratio) * 100)
        rain_penalty = min(15, rain_mm * 3)
        score = min(100, round(base_score + rain_penalty))

        if score < 25:
            level = "free-flow"
        elif score < 50:
            level = "moderate"
        elif score < 75:
            level = "heavy"
        else:
            level = "critical"

        # Mock probabilities to keep schema consistent
        probs = [0.0, 0.0, 0.0, 0.0]
        if level == "free-flow":
            probs[0] = 0.8; probs[1] = 0.2
        elif level == "moderate":
            probs[1] = 0.7; probs[0] = 0.15; probs[2] = 0.15
        elif level == "heavy":
            probs[2] = 0.7; probs[1] = 0.15; probs[3] = 0.15
        else:
            probs[3] = 0.8; probs[2] = 0.2

        return {
            "score": score,
            "level": level,
            "probabilities": dict(zip(["Low", "Medium", "High", "Very High"], probs)),
            "ml_model_used": False,
        }


# Instantiate singleton predictor
predictor = CongestionPredictor()


async def calculate_road_congestion(
    road_name: str,
    current_speed: float,
    free_flow_speed: float,
    rain_mm: float,
    override_time: datetime.datetime | None = None
) -> dict:
    """Compiles the 15 features and runs predictions using the XGBoost model."""
    meta = ROAD_METADATA.get(road_name, {"speedLimit": 60.0, "frc": 3, "distance": 1000.0})
    
    dt = override_time if override_time is not None else datetime.datetime.now()
    hour = dt.hour
    day_of_week = dt.weekday()
    is_weekend = 1 if day_of_week >= 5 else 0
    is_peak = 1 if hour in [8, 9, 10, 17, 18, 19, 20] else 0
    
    # Weather context
    weather = await get_weather()
    avg_temp = weather.get("temp_c") if weather.get("temp_c") is not None else 30.0
    wind_speed = weather.get("wind_kph") if weather.get("wind_kph") is not None else 5.0
    air_pressure = 1010.0 # Default pressure in hPa
    
    is_holiday, holiday_type = _check_holiday(dt)

    # Estimate dynamic probeCount based on congestion speed ratio
    speed_ratio = max(0.01, min(1.0, current_speed / free_flow_speed))
    probe_count = max(2, int((1 - speed_ratio) * 60 + random.randint(1, 5)))

    # Compile the feature record
    record = {
        "speedLimit": meta["speedLimit"],
        "frc": meta["frc"],
        "distance": meta["distance"],
        "probeCount": probe_count,
        "hour": hour,
        "day_of_week": day_of_week,
        "is_weekend": is_weekend,
        "is_peak_hour": is_peak,
        "avg_temp": avg_temp,
        "wind_speed": wind_speed,
        "air_pressure": air_pressure,
        "rainfall": rain_mm,
        "is_holiday": is_holiday,
        "holiday_type": holiday_type,
        "current_speed": current_speed # helper for rule-fallback
    }

    pred_res = predictor.predict_score(record)
    pred_res["speed_ratio"] = round(speed_ratio, 2)
    return pred_res


def _simulate_traffic(road_name: str, now_time: float) -> tuple[float, float]:
    """Generates realistic speed and free flow speed for a road point."""
    meta = ROAD_METADATA.get(road_name, {"free_flow_speed": 60.0})
    free_flow = meta["free_flow_speed"]
    
    dt = datetime.datetime.fromtimestamp(now_time)
    hour = dt.hour
    
    # Peak hour traffic dip (congestion)
    if 8 <= hour <= 10 or 17 <= hour <= 20:
        base_ratio = 0.35
    else:
        base_ratio = 0.85

    # Seed differently per road to prevent identical speeds
    seed_val = sum(ord(c) for c in road_name)
    random.seed(seed_val + int(now_time // 60)) # shifts every minute
    
    ratio = max(0.15, min(0.98, base_ratio + random.uniform(-0.12, 0.12)))
    current_speed = round(free_flow * ratio, 1)
    return current_speed, free_flow


async def get_traffic() -> dict:
    global _cache, _cache_time

    now = time.time()
    if _cache and (now - _cache_time) < settings.TRAFFIC_REFRESH_SECONDS:
        return _cache

    weather = await get_weather()
    rain_mm = weather.get("rain_mm") or 0

    if not _is_key_valid(settings.TOMTOM_API_KEY):
        # Generate simulated roads
        roads = []
        for name, meta in ROAD_METADATA.items():
            curr_speed, free_speed = _simulate_traffic(name, now)
            congestion = await calculate_road_congestion(name, curr_speed, free_speed, rain_mm)
            roads.append({
                "name": name,
                "lat": settings.TRACKED_ROAD_POINTS[list(ROAD_METADATA.keys()).index(name)]["lat"],
                "lon": settings.TRACKED_ROAD_POINTS[list(ROAD_METADATA.keys()).index(name)]["lon"],
                "current_speed_kph": curr_speed,
                "free_flow_speed_kph": free_speed,
                "confidence": round(random.uniform(0.85, 0.98), 2),
                **congestion
            })

        scored = [r["score"] for r in roads if "score" in r]
        average_score = round(sum(scored) / len(scored)) if scored else None

        result = {
            "source": "simulated",
            "fetched_at": now,
            "roads": roads,
            "average_score": average_score,
            "ml_predictor_status": "loaded" if predictor.model is not None else "fallback_rule_based"
        }
        _cache = result
        _cache_time = now
        return result

    # Real TomTom API
    roads = []
    async with httpx.AsyncClient(timeout=10.0) as client:
        for point in settings.TRACKED_ROAD_POINTS:
            url = "https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json"
            params = {"key": settings.TOMTOM_API_KEY, "point": f"{point['lat']},{point['lon']}"}
            try:
                resp = await client.get(url, params=params)
                resp.raise_for_status()
                seg = resp.json()["flowSegmentData"]
                
                congestion = await calculate_road_congestion(
                    point["name"], seg["currentSpeed"], seg["freeFlowSpeed"], rain_mm
                )
                roads.append(
                    {
                        "name": point["name"],
                        "lat": point["lat"],
                        "lon": point["lon"],
                        "current_speed_kph": seg["currentSpeed"],
                        "free_flow_speed_kph": seg["freeFlowSpeed"],
                        "confidence": seg.get("confidence"),
                        **congestion,
                    }
                )
            except Exception as exc:
                print(f"TomTom API failed for {point['name']} ({exc}), using simulation fallback")
                # Fall back to simulation for this road
                curr_speed, free_speed = _simulate_traffic(point["name"], now)
                congestion = await calculate_road_congestion(point["name"], curr_speed, free_speed, rain_mm)
                roads.append({
                    "name": point["name"],
                    "lat": point["lat"],
                    "lon": point["lon"],
                    "current_speed_kph": curr_speed,
                    "free_flow_speed_kph": free_speed,
                    "confidence": 0.90,
                    **congestion,
                })

    scored = [r["score"] for r in roads if "score" in r]
    average_score = round(sum(scored) / len(scored)) if scored else None

    result = {
        "source": "tomtom",
        "fetched_at": now,
        "roads": roads,
        "average_score": average_score,
        "ml_predictor_status": "loaded" if predictor.model is not None else "fallback_rule_based"
    }
    _cache = result
    _cache_time = now
    return result
