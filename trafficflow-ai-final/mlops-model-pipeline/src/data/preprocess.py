"""
Load the raw merged dataset, sort chronologically, encode holiday_type
and the target, and write out a cleaned parquet ready for feature building.

Run:
    python src/data/preprocess.py
"""

import json
import os
import sys

import pandas as pd

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from src.utils.config import (
    RAW_DATA_PATH,
    CLEANED_DATA_PATH,
    TARGET,
    TARGET_MAPPING,
    HOLIDAY_ENCODER_PATH,
)


def preprocess(raw_path: str = RAW_DATA_PATH, out_path: str = CLEANED_DATA_PATH) -> pd.DataFrame:
    print("=" * 70)
    print("PREPROCESS")
    print("=" * 70)

    df = pd.read_parquet(raw_path)
    print("Loaded:", df.shape)

    # Chronological sort (required for the time-based split later)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values("timestamp").reset_index(drop=True)

    # Encode holiday_type -> integer codes, and save the mapping so
    # the API / predict.py can encode new requests consistently.
    df["holiday_type"] = df["holiday_type"].astype("category")
    holiday_mapping = dict(enumerate(df["holiday_type"].cat.categories))
    df["holiday_type"] = df["holiday_type"].cat.codes

    os.makedirs(os.path.dirname(HOLIDAY_ENCODER_PATH), exist_ok=True)
    with open(HOLIDAY_ENCODER_PATH, "w") as f:
        json.dump({str(k): v for k, v in holiday_mapping.items()}, f, indent=2)
    print("Saved holiday encoder ->", HOLIDAY_ENCODER_PATH)

    # Encode target
    df[TARGET] = df[TARGET].map(TARGET_MAPPING).astype("int8")

    print("\nMissing values:", df.isnull().sum().sum())
    print("Target distribution:\n", df[TARGET].value_counts().sort_index())

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    df.to_parquet(out_path, index=False)
    print("\nSaved processed dataset ->", out_path, df.shape)

    return df


if __name__ == "__main__":
    preprocess()
