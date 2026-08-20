from pydantic import BaseModel, Field


class CongestionRequest(BaseModel):
    speedLimit: float = Field(..., example=60)
    frc: int = Field(..., example=3, description="Functional road class")
    distance: float = Field(..., example=500)
    probeCount: int = Field(..., example=12)
    hour: int = Field(..., ge=0, le=23, example=8)
    day_of_week: int = Field(..., ge=0, le=6, example=1)
    is_weekend: int = Field(..., ge=0, le=1, example=0)
    is_peak_hour: int = Field(..., ge=0, le=1, example=1)
    avg_temp: float = Field(..., example=28.5)
    wind_speed: float = Field(..., example=5.2)
    air_pressure: float = Field(..., example=1012.0)
    rainfall: float = Field(..., example=0.0)
    is_holiday: int = Field(..., ge=0, le=1, example=0)
    holiday_type: str = Field(..., example="None")


class CongestionResponse(BaseModel):
    congestion_level: str
    congestion_code: int
    probabilities: dict
