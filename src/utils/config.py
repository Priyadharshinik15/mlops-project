"""
Central config for SmartTrafficOps.
All paths, feature lists, and mappings used across the pipeline live here
so every script (preprocess, train, evaluate, api) stays in sync.
"""

import os

# ------------------------------------------------------------------
# Paths
# ------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

RAW_DATA_PATH = os.path.join(BASE_DIR, "data", "raw", "ml_data_holiday.parquet")
CLEANED_DATA_PATH = os.path.join(BASE_DIR, "data", "processed", "cleaned.parquet")
PROCESSED_DATA_PATH = os.path.join(BASE_DIR, "data", "processed", "features.parquet")

MODEL_PATH = os.path.join(BASE_DIR, "models", "xgboost_congestion_model.json")
HOLIDAY_ENCODER_PATH = os.path.join(BASE_DIR, "models", "preprocessing", "holiday_type_encoder.json")
FEATURE_LIST_PATH = os.path.join(BASE_DIR, "models", "preprocessing", "feature_list.json")
TEST_SPLIT_PATH = os.path.join(BASE_DIR, "models", "_test_split.parquet")

METRICS_PATH = os.path.join(BASE_DIR, "metrics.json")

# ------------------------------------------------------------------
# Features / target (from model-training.ipynb, Cell 16)
# ------------------------------------------------------------------
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
    "holiday_type",
]

TARGET = "congestion_level"

TARGET_MAPPING = {
    "Low": 0,
    "Medium": 1,
    "High": 2,
    "Very High": 3,
}

TARGET_MAPPING_INV = {v: k for k, v in TARGET_MAPPING.items()}

CLASS_NAMES = ["Low", "Medium", "High", "Very High"]

# ------------------------------------------------------------------
# Split ratios (chronological — see notebook Cell 14)
# ------------------------------------------------------------------
TRAIN_RATIO = 0.70
VAL_RATIO = 0.15  # remainder (0.15) is test

# ------------------------------------------------------------------
# Model hyperparameters (improved_xgb, notebook Cell 23)
# ------------------------------------------------------------------
XGB_PARAMS = {
    "objective": "multi:softprob",
    "num_class": 4,
    "n_estimators": 1500,
    "learning_rate": 0.05,
    "max_depth": 8,
    "min_child_weight": 3,
    "subsample": 0.90,
    "colsample_bytree": 0.90,
    "gamma": 0,
    "reg_alpha": 0.05,
    "reg_lambda": 1.5,
    "tree_method": "hist",
    "eval_metric": "mlogloss",
    "early_stopping_rounds": 75,
    "random_state": 42,
    "n_jobs": -1,
}

USE_SAMPLE_WEIGHTS = True  # toggle: balanced class weighting on/off
