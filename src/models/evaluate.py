"""
Evaluate the trained model on the held-out test split and write
metrics.json (consumed by dvc.yaml's `evaluate` stage and by CI).

Run:
    python src/models/evaluate.py
"""

import json
import os
import sys

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    classification_report,
    confusion_matrix,
)

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from src.utils.config import FEATURES, TARGET, CLASS_NAMES, MODEL_PATH, METRICS_PATH


def evaluate(model_path: str = MODEL_PATH, metrics_path: str = METRICS_PATH):
    print("=" * 70)
    print("EVALUATE")
    print("=" * 70)

    test_path = os.path.join(os.path.dirname(model_path), "_test_split.parquet")
    df_test = pd.read_parquet(test_path)
    X_test, y_test = df_test[FEATURES], df_test[TARGET].astype(int)

    model = xgb.XGBClassifier()
    model.load_model(model_path)

    y_pred = np.asarray(model.predict(X_test)).astype(int)

    accuracy = accuracy_score(y_test, y_pred)
    macro_f1 = f1_score(y_test, y_pred, average="macro")
    weighted_f1 = f1_score(y_test, y_pred, average="weighted")

    print(f"\nTest Accuracy : {accuracy:.4f} ({accuracy * 100:.2f}%)")
    print(f"Macro F1      : {macro_f1:.4f}")
    print(f"Weighted F1   : {weighted_f1:.4f}")

    report = classification_report(
        y_test, y_pred, labels=[0, 1, 2, 3], target_names=CLASS_NAMES, digits=4, output_dict=True
    )
    print("\n", classification_report(y_test, y_pred, labels=[0, 1, 2, 3], target_names=CLASS_NAMES, digits=4))

    cm = confusion_matrix(y_test, y_pred, labels=[0, 1, 2, 3])
    print("Confusion Matrix:\n", cm)

    metrics = {
        "accuracy": accuracy,
        "macro_f1": macro_f1,
        "weighted_f1": weighted_f1,
        "per_class": report,
        "confusion_matrix": cm.tolist(),
    }

    with open(metrics_path, "w") as f:
        json.dump(metrics, f, indent=2)
    print("\nSaved metrics ->", metrics_path)

    return metrics


if __name__ == "__main__":
    evaluate()
