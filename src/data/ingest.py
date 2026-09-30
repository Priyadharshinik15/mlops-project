"""
Merges the 5 raw source files into a single ml_data_holiday.parquet:
    - traffic.csv    (segment-level probe data: speedLimit, frc, distance, probeCount, etc.)
    - weather.csv     (avg_temp, wind_speed, air_pressure, rainfall, avg_visibility)
    - accidents.csv   (accident_count, avg_accident_risk, avg_vehicles_involved)
    - holidays.csv    (is_holiday, holiday_type)
    - events.csv      (event-related signals, if used as a feature)

Adjust the join keys / column names below to match your actual files --
this is a template based on your feature list in config.py.

Run:
    python src/data/ingest.py
"""

import os
import sys

import pandas as pd

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from src.utils.config import RAW_DATA_PATH

EXTERNAL_DIR = os.path.join(os.path.dirname(RAW_DATA_PATH), "..", "external")


def load(name: str) -> pd.DataFrame:
    path = os.path.join(EXTERNAL_DIR, name)
    df = pd.read_csv(path)
    print(f"Loaded {name}: {df.shape}")
    return df


def ingest():
    print("=" * 70)
    print("INGEST -- merging 5 source files")
    print("=" * 70)

    traffic = load("traffic.csv")
    weather = load("weather.csv")
    accidents = load("accidents.csv")
    holidays = load("holidays.csv")
    events = load("events.csv")

    # Normalize timestamp columns
    for df in (traffic, weather, accidents):
        if "timestamp" in df.columns:
            df["timestamp"] = pd.to_datetime(df["timestamp"])

    # Derive a plain date column for the daily-granularity files
    if "timestamp" in traffic.columns:
        traffic["date"] = traffic["timestamp"].dt.date
    for df, name in [(holidays, "holidays"), (events, "events")]:
        if "date" in df.columns:
            df["date"] = pd.to_datetime(df["date"]).dt.date
        else:
            print(f"WARNING: no 'date' column found in {name}.csv -- adjust merge key")

    # ------------------------------------------------------------
    # 1. traffic + weather  (segment_id + timestamp, or nearest-time join)
    # ------------------------------------------------------------
    join_keys = [k for k in ["segment_id", "timestamp"] if k in traffic.columns and k in weather.columns]
    if join_keys:
        merged = traffic.merge(weather, on=join_keys, how="left")
    else:
        print("WARNING: no shared segment_id/timestamp between traffic and weather -- merging on timestamp only")
        merged = traffic.merge(weather, on="timestamp", how="left") if "timestamp" in weather.columns else traffic.copy()

    # ------------------------------------------------------------
    # 2. + accidents (segment_id + timestamp, or segment_id + date window)
    # ------------------------------------------------------------
    join_keys = [k for k in ["segment_id", "timestamp"] if k in merged.columns and k in accidents.columns]
    if join_keys:
        merged = merged.merge(accidents, on=join_keys, how="left")
    elif "segment_id" in merged.columns and "segment_id" in accidents.columns:
        merged = merged.merge(accidents, on="segment_id", how="left")
    else:
        print("WARNING: could not join accidents -- check accidents.csv keys")

    # ------------------------------------------------------------
    # 3. + holidays (date)
    # ------------------------------------------------------------
    if "date" in merged.columns and "date" in holidays.columns:
        merged = merged.merge(holidays, on="date", how="left")
        merged["is_holiday"] = merged["is_holiday"].fillna(0).astype(int)
        merged["holiday_type"] = merged["holiday_type"].fillna("None")
    else:
        print("WARNING: could not join holidays -- check holidays.csv 'date' column")

    # ------------------------------------------------------------
    # 4. + events (date, optional feature)
    # ------------------------------------------------------------
    if "date" in merged.columns and "date" in events.columns:
        merged = merged.merge(events, on="date", how="left")
    else:
        print("WARNING: could not join events -- check events.csv 'date' column")

    merged = merged.drop(columns=["date"], errors="ignore")

    print("\nFinal merged shape:", merged.shape)
    print("Missing values per column:\n", merged.isnull().sum())

    os.makedirs(os.path.dirname(RAW_DATA_PATH), exist_ok=True)
    merged.to_parquet(RAW_DATA_PATH, index=False)
    print("\nSaved merged dataset ->", RAW_DATA_PATH)

    return merged


if __name__ == "__main__":
    ingest()
