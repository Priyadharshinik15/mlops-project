"""
Registers the most recent (or a specified) MLflow run's model into the
MLflow Model Registry, and promotes it to a given stage.

Run:
    python src/models/register.py
    python src/models/register.py --run-id <run_id> --stage Production
"""

import argparse

import mlflow
from mlflow.tracking import MlflowClient

mlflow.set_tracking_uri("sqlite:///mlflow.db")

MODEL_NAME = "smarttrafficops-congestion-model"
EXPERIMENT_NAME = "smarttrafficops-congestion"


def get_latest_run_id() -> str:
    client = MlflowClient()
    experiment = client.get_experiment_by_name(EXPERIMENT_NAME)
    runs = client.search_runs(
        experiment_ids=[experiment.experiment_id],
        order_by=["start_time DESC"],
        max_results=1,
    )
    if not runs:
        raise RuntimeError("No MLflow runs found. Run src/models/train.py first.")
    return runs[0].info.run_id


def register(run_id: str = None, stage: str = "Staging"):
    if run_id is None:
        run_id = get_latest_run_id()
        print("Using latest run:", run_id)

    model_uri = f"runs:/{run_id}/model"
    result = mlflow.register_model(model_uri=model_uri, name=MODEL_NAME)
    print(f"Registered {MODEL_NAME} version {result.version}")

    client = MlflowClient()
    client.transition_model_version_stage(
        name=MODEL_NAME,
        version=result.version,
        stage=stage,
        archive_existing_versions=(stage == "Production"),
    )
    print(f"Version {result.version} moved to stage: {stage}")

    return result.version


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-id", default=None, help="MLflow run ID (defaults to most recent)")
    parser.add_argument("--stage", default="Staging", choices=["Staging", "Production", "Archived"])
    args = parser.parse_args()

    register(run_id=args.run_id, stage=args.stage)