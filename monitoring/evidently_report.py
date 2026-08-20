"""
Data drift check between the training feature set (reference) and a
"current" batch (e.g. the held-out test split, or new incoming data).

Uses Evidently >=0.6 API (Report / Dataset / DataDefinition / presets),
which replaced the old evidently.report.Report / metric_preset imports
in earlier versions.

The pass/fail boolean is computed independently with a KS-test on each
numeric feature rather than parsed out of Evidently's internal result
dict, since that schema has changed across Evidently versions -- this
keeps pipelines/retrain.py stable even if Evidently's API shifts again.

Run:
    python monitoring/evidently_report.py
"""

import os
import sys
import json

import pandas as pd
from scipy.stats import ks_2samp

from evidently import Report, Dataset, DataDefinition
from evidently.presets import DataDriftPreset

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(BASE_DIR)
from src.utils.config import PROCESSED_DATA_PATH, TEST_SPLIT_PATH, FEATURES, TARGET

DRIFT_REPORT_PATH = os.path.join(BASE_DIR, "monitoring", "drift_report.html")
DRIFT_STATUS_PATH = os.path.join(BASE_DIR, "monitoring", "drift_status.json")

CATEGORICAL = {"day_of_week", "is_weekend", "is_peak_hour", "is_holiday", "holiday_type", "frc"}
NUMERICAL = [c for c in FEATURES if c not in CATEGORICAL]
CATEGORICAL_COLS = [c for c in FEATURES if c in CATEGORICAL]


def _ks_drift_flags(reference: pd.DataFrame, current: pd.DataFrame, alpha: float = 0.05) -> dict:
    """Per-feature KS-test drift flags for numeric columns -- version-independent."""
    flags = {}
    for col in NUMERICAL:
        if col not in reference.columns or col not in current.columns:
            continue
        stat, p_value = ks_2samp(reference[col].dropna(), current[col].dropna())
        flags[col] = bool(p_value < alpha)
    return flags


def run_drift_check(
    reference_path: str = PROCESSED_DATA_PATH,
    current_path: str = TEST_SPLIT_PATH,
    drift_share_threshold: float = 0.5,
) -> bool:
    reference = pd.read_parquet(reference_path)[FEATURES + [TARGET]]
    current = pd.read_parquet(current_path)[FEATURES + [TARGET]]

    # --- Visual HTML report (Evidently's own preset) ---
    schema = DataDefinition(
        numerical_columns=NUMERICAL,
        categorical_columns=CATEGORICAL_COLS,
    )
    ref_dataset = Dataset.from_pandas(reference, data_definition=schema)
    cur_dataset = Dataset.from_pandas(current, data_definition=schema)

    report = Report([DataDriftPreset()])
    my_eval = report.run(reference_data=ref_dataset, current_data=cur_dataset)
    os.makedirs(os.path.dirname(DRIFT_REPORT_PATH), exist_ok=True)
    my_eval.save_html(DRIFT_REPORT_PATH)

    # --- Independent pass/fail boolean (KS-test) ---
    flags = _ks_drift_flags(reference, current)
    drifted_count = sum(flags.values())
    drift_share = drifted_count / len(flags) if flags else 0.0
    drift_detected = drift_share >= drift_share_threshold

    status = {
        "drift_detected": drift_detected,
        "drift_share": round(drift_share, 4),
        "drifted_features": [c for c, v in flags.items() if v],
        "per_feature": flags,
    }
    with open(DRIFT_STATUS_PATH, "w") as f:
        json.dump(status, f, indent=2)

    print(f"Drifted features: {drifted_count}/{len(flags)}  (share={drift_share:.2%})")
    print(f"Drift detected  : {drift_detected}")
    print(f"HTML report     -> {DRIFT_REPORT_PATH}")
    print(f"Status JSON     -> {DRIFT_STATUS_PATH}")

    return drift_detected


if __name__ == "__main__":
    run_drift_check()