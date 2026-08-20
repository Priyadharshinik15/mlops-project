"""
Load the trained model + preprocessing artifacts and run inference on
new records. Used directly by api/main.py.

Loads from the MLflow Model Registry (Production stage) if available,
falling back to the local models/xgboost_congestion_model.json file.
"""

import json
import os
import sys

import pandas as pd
import xgboost as xgb

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from src.utils.config import FEATURES, MODEL_PATH, HOLIDAY_ENCODER_PATH, TARGET_MAPPING_INV

MODEL_NAME = "smarttrafficops-congestion-model"


class CongestionPredictor:
    def __init__(self, model_path: str = MODEL_PATH, holiday_encoder_path: str = HOLIDAY_ENCODER_PATH, use_registry: bool = True):
        self.model = self._load_model(model_path, use_registry)

        with open(holiday_encoder_path) as f:
            code_to_name = json.load(f)
            self.holiday_name_to_code = {v: int(k) for k, v in code_to_name.items()}

    def _load_model(self, model_path: str, use_registry: bool):
        if use_registry:
            try:
                import mlflow.xgboost
                model = mlflow.xgboost.load_model(f"models:/{MODEL_NAME}/Production")
                print(f"Loaded model from MLflow registry: {MODEL_NAME} (Production)")
                return model
            except Exception as e:
                print(f"Registry load failed ({e}), falling back to local file: {model_path}")

        model = xgb.XGBClassifier()
        model.load_model(model_path)
        print(f"Loaded model from local file: {model_path}")
        return model

    def _encode(self, record: dict) -> pd.DataFrame:
        row = dict(record)
        if isinstance(row.get("holiday_type"), str):
            row["holiday_type"] = self.holiday_name_to_code.get(row["holiday_type"], -1)
        return pd.DataFrame([row])[FEATURES]

    def predict(self, record: dict) -> dict:
        X = self._encode(record)
        pred_class = int(self.model.predict(X)[0])
        probs = self.model.predict_proba(X)[0].tolist()

        return {
            "congestion_level": TARGET_MAPPING_INV[pred_class],
            "congestion_code": pred_class,
            "probabilities": dict(zip(["Low", "Medium", "High", "Very High"], probs)),
        }


if __name__ == "__main__":
    predictor = CongestionPredictor()
    sample = {
        "speedLimit": 60, "frc": 3, "distance": 500, "probeCount": 12,
        "hour": 8, "day_of_week": 1, "is_weekend": 0, "is_peak_hour": 1,
        "avg_temp": 28.5, "wind_speed": 5.2, "air_pressure": 1012.0,
        "rainfall": 0.0, "is_holiday": 0, "holiday_type": "None",
    }
    print(predictor.predict(sample))
