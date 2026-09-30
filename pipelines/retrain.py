"""
Checks for drift; if detected (or --force is passed), re-runs the full
DVC pipeline to retrain, then registers and promotes the new model to
Production in the MLflow registry.

Run:
    python pipelines/retrain.py
    python pipelines/retrain.py --force
"""

import argparse
import os
import subprocess
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from monitoring.evidently_report import run_drift_check
from src.models.register import register


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="Skip drift check and retrain anyway")
    parser.add_argument("--min-macro-f1", type=float, default=0.60, help="Minimum macro F1 to promote to Production")
    args = parser.parse_args()

    should_retrain = args.force or run_drift_check()

    if not should_retrain:
        print("No retraining needed.")
        return

    print("Triggering retraining pipeline (dvc repro)...")
    subprocess.run(["dvc", "repro"], check=True)
    print("Retraining complete.")

    import json
    with open("metrics.json") as f:
        metrics = json.load(f)

    macro_f1 = metrics["macro_f1"]
    print(f"New model macro F1: {macro_f1:.4f}")

    if macro_f1 >= args.min_macro_f1:
        version = register(stage="Production")
        print(f"Promoted model version {version} to Production.")
    else:
        version = register(stage="Staging")
        print(f"Macro F1 below threshold ({args.min_macro_f1}) — model registered as Staging only,"
              f" NOT promoted to Production. Version {version} needs manual review.")


if __name__ == "__main__":
    main()
