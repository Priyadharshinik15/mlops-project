import os
import sys

import pytest
from fastapi.testclient import TestClient

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from api.main import app
from src.utils.config import MODEL_PATH

pytestmark = pytest.mark.skipif(
    not os.path.exists(MODEL_PATH),
    reason="Trained model not present in this environment -- run src/models/train.py first.",
)


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["model_loaded"] is True


def test_predict(client):
    payload = {
        "speedLimit": 60, "frc": 3, "distance": 500, "probeCount": 12,
        "hour": 8, "day_of_week": 1, "is_weekend": 0, "is_peak_hour": 1,
        "avg_temp": 28.5, "wind_speed": 5.2, "air_pressure": 1012.0,
        "rainfall": 0.0, "is_holiday": 0, "holiday_type": "None",
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["congestion_level"] in ["Low", "Medium", "High", "Very High"]
    assert sum(body["probabilities"].values()) == pytest.approx(1.0, abs=0.01)