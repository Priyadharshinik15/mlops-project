"""
FastAPI serving layer for the SmartTrafficOps congestion model.

Run:
    uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
"""

import os
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from api.schemas import CongestionRequest, CongestionResponse
from src.models.predict import CongestionPredictor

predictor = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global predictor
    predictor = CongestionPredictor()
    yield
    predictor = None


app = FastAPI(
    title="SmartTrafficOps API",
    description="Adaptive traffic congestion prediction (SDG 11)",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": predictor is not None}


@app.post("/predict", response_model=CongestionResponse)
def predict(request: CongestionRequest):
    if predictor is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    try:
        result = predictor.predict(request.dict())
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))