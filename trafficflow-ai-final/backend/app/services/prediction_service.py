"""
Road ranking and the congestion gauge come straight from real/simulated traffic data.
The short-term trend line is an AI-forecasted projection using the trained
XGBoost model, run on simulated future traffic speeds based on diurnal patterns.
"""
import datetime
import random

from app.services.traffic_service import get_traffic, calculate_road_congestion, predictor, HAS_ML_DEPS
from app.services.weather_service import get_weather


def _traffic_factor(hour: int) -> float:
    """Return a multiplier (0-1) representing expected congestion at `hour`."""
    # Double peak: morning rush 8-10, evening rush 17-20
    if 8 <= hour <= 10:
        return 0.85 + min(hour - 8, 2) * 0.05
    if 17 <= hour <= 20:
        return 0.75 + min(hour - 17, 3) * 0.06
    if 0 <= hour <= 5:
        return 0.12 + hour * 0.02
    if 23 == hour:
        return 0.15
    return 0.35 + abs(hour - 14) * 0.01


async def get_prediction() -> dict:
    traffic = await get_traffic()
    roads = traffic.get("roads", [])
    average_score = traffic.get("average_score") or 0

    weather = await get_weather()
    rain_mm = weather.get("rain_mm") or 0.0

    ranking = sorted(
        [r for r in roads if "score" in r],
        key=lambda r: r["score"],
        reverse=True,
    )

    # 60-minute short term forecast using XGBoost
    now = datetime.datetime.now()
    trend = []
    
    # Calculate forecast for next 12 steps (5 min intervals = 60 mins)
    for i in range(12):
        minutes_ahead = (i + 1) * 5
        dt_future = now + datetime.timedelta(minutes=minutes_ahead)
        
        future_road_scores = []
        for road in roads:
            if "current_speed_kph" not in road or "free_flow_speed_kph" not in road:
                continue
            
            curr_speed = road["current_speed_kph"]
            free_speed = road["free_flow_speed_kph"]
            
            ratio_now = max(0.01, curr_speed / free_speed)
            factor_now = _traffic_factor(now.hour)
            factor_future = _traffic_factor(dt_future.hour)
            
            # Project ratio using peak/off-peak transition factor
            # Slower speed (more congestion) during peak hours
            ratio_future = max(0.12, min(0.98, ratio_now * (1.0 - (factor_future - factor_now))))
            speed_future = free_speed * ratio_future
            
            # Predict future congestion using the XGBoost model
            congestion_future = await calculate_road_congestion(
                road["name"],
                speed_future,
                free_speed,
                rain_mm,
                override_time=dt_future
            )
            future_road_scores.append(congestion_future["score"])
        
        if future_road_scores:
            step_score = round(sum(future_road_scores) / len(future_road_scores))
        else:
            # Fallback random walk if no roads found
            step_score = max(0, min(100, round(average_score + (i * random.uniform(-2, 2)))))
            
        trend.append({
            "t": f"+{minutes_ahead}m",
            "score": step_score
        })

    model_used = predictor.model is not None and HAS_ML_DEPS

    return {
        "source": "tomtom+xgboost_forecast" if model_used else "tomtom+simulated_forecast",
        "average_score": average_score,
        "level": (
            "free-flow" if average_score < 25
            else "moderate" if average_score < 50
            else "heavy" if average_score < 75
            else "critical"
        ),
        "road_ranking": ranking,
        "trend": trend,
        "trend_is_simulated": not model_used,
    }
