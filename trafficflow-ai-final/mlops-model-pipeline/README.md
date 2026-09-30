# SmartTrafficOps

Adaptive Traffic Congestion Prediction using MLOps (SDG 11 — Sustainable Cities and Communities)

## Setup
```bash
python -m venv venv
source venv/bin/activate   # venv\Scripts\activate on Windows
pip install -r requirements.txt
```

## Pipeline
```bash
dvc repro
```

## Serve the API
```bash
uvicorn api.main:app --reload
```

## Run tests
```bash
pytest tests/ -v
```

## Structure
- `data/` — raw, processed, and external datasets (gitignored, tracked via DVC)
- `models/` — trained model artifacts and preprocessing objects
- `src/` — ingestion, feature engineering, training, evaluation, prediction
- `api/` — FastAPI serving layer
- `monitoring/` — Evidently AI drift detection
- `pipelines/` — automatic retraining trigger
- `notebooks/` — exploration and training notebooks
- `tests/` — unit tests
- `docker/` — containerization
- `.github/workflows/` — CI/CD
