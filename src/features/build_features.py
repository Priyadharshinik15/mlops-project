"""
Select the final feature set from the processed dataset and persist the
feature list so train.py, predict.py, and the API all agree on column
order.

Run:
    python src/features/build_features.py
"""

import json
import os
import sys

import pandas as pd

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from src.utils.config import (
    CLEANED_DATA_PATH,
    PROCESSED_DATA_PATH,
    FEATURES,
    TARGET,
    FEATURE_LIST_PATH,
)


def build_features(in_path: str = CLEANED_DATA_PATH, out_path: str = PROCESSED_DATA_PATH) -> pd.DataFrame:
    print("=" * 70)
    print("BUILD FEATURES")
    print("=" * 70)

    df = pd.read_parquet(in_path)

    missing = [c for c in FEATURES + [TARGET] if c not in df.columns]
    if missing:
        raise ValueError(f"Missing expected columns: {missing}")

    ml_df = df[["timestamp"] + FEATURES + [TARGET]].copy() if "timestamp" in df.columns else df[FEATURES + [TARGET]].copy()

    os.makedirs(os.path.dirname(FEATURE_LIST_PATH), exist_ok=True)
    with open(FEATURE_LIST_PATH, "w") as f:
        json.dump(FEATURES, f, indent=2)
    print("Saved feature list ->", FEATURE_LIST_PATH)

    ml_df.to_parquet(out_path, index=False)
    print("Saved feature dataset ->", out_path, ml_df.shape)

    return ml_df


if __name__ == "__main__":
    build_features()
