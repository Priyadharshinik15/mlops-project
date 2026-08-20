"""
Train the XGBoost congestion classifier on the engineered feature set,
using a chronological train/val/test split and class-balanced sample
weights. Logs the run to MLflow, saves the model locally, and writes
the held-out test split for evaluate.py to score.

Run:
    python src/models/train.py
"""

import os
import sys

import numpy as np
import pandas as pd
import yaml
import mlflow
import mlflow.xgboost
from xgboost import XGBClassifier
from sklearn.metrics import accuracy_score, f1_score
from sklearn.utils.class_weight import compute_sample_weight

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(BASE_DIR)
from src.utils.config import (
    PROCESSED_DATA_PATH,
    FEATURES,
    TARGET,
    MODEL_PATH,
    TEST_SPLIT_PATH,
    TRAIN_RATIO,
    VAL_RATIO,
    XGB_PARAMS,
    USE_SAMPLE_WEIGHTS,
)

PARAMS_PATH = os.path.join(BASE_DIR, "params.yaml")


def chronological_split(df: pd.DataFrame):
    """70/15/15 split in time order (no shuffling) -- matches notebook Cell 14."""
    n = len(df)
    train_end = int(n * TRAIN_RATIO)
    val_end = int(n * (TRAIN_RATIO + VAL_RATIO))
    return df.iloc[:train_end], df.iloc[train_end:val_end], df.iloc[val_end:]


def train():
    print("=" * 70)
    print("TRAIN")
    print("=" * 70)

    df = pd.read_parquet(PROCESSED_DATA_PATH)
    if "timestamp" in df.columns:
        df = df.sort_values("timestamp").reset_index(drop=True)

    df_train, df_val, df_test = chronological_split(df)
    print(f"Train: {len(df_train)}  Val: {len(df_val)}  Test: {len(df_test)}")

    X_train, y_train = df_train[FEATURES], df_train[TARGET].astype(int)
    X_val, y_val = df_val[FEATURES], df_val[TARGET].astype(int)
    X_test, y_test = df_test[FEATURES], df_test[TARGET].astype(int)

    sample_weights = compute_sample_weight("balanced", y_train) if USE_SAMPLE_WEIGHTS else None

    # dvc.yaml-tracked params (params.yaml) override the defaults in config.py,
    # so `dvc exp run -S train.max_depth=10` etc. actually takes effect.
    with open(PARAMS_PATH) as f:
        dvc_params = yaml.safe_load(f)["train"]
    xgb_params = {**XGB_PARAMS, **dvc_params}

    mlflow.set_tracking_uri("sqlite:///mlflow.db")
    mlflow.set_experiment("smarttrafficops-congestion")

    with mlflow.start_run():
        mlflow.log_params(xgb_params)
        mlflow.log_param("use_sample_weights", USE_SAMPLE_WEIGHTS)

        model = XGBClassifier(**xgb_params)
        model.fit(
            X_train, y_train,
            sample_weight=sample_weights,
            eval_set=[(X_val, y_val)],
            verbose=100,
        )

        y_pred = np.asarray(model.predict(X_test)).astype(int)
        accuracy = accuracy_score(y_test, y_pred)
        macro_f1 = f1_score(y_test, y_pred, average="macro")

        mlflow.log_metric("accuracy", accuracy)
        mlflow.log_metric("macro_f1", macro_f1)
        mlflow.xgboost.log_model(model, "model")

        os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
        model.save_model(MODEL_PATH)

        os.makedirs(os.path.dirname(TEST_SPLIT_PATH), exist_ok=True)
        df_test.to_parquet(TEST_SPLIT_PATH, index=False)

        print(f"\nTest accuracy: {accuracy:.4f}  Macro F1: {macro_f1:.4f}")
        print("Saved model      ->", MODEL_PATH)
        print("Saved test split ->", TEST_SPLIT_PATH)
        print("MLflow run ID    :", mlflow.active_run().info.run_id)
        print("\nNext: python src/models/register.py --stage Production")


if __name__ == "__main__":
    train()
