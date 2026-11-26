import pytest
import sys
import os

# Add backend directory to sys.path
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from services.traffic_service import traffic_service

def test_traffic_service_loaded():
    assert traffic_service.is_loaded() is True
    assert traffic_service.baseline > 0
    assert traffic_service.sigma > 0

def test_traffic_forecast_null_handling():
    res = traffic_service.forecast(None)
    assert "forecast" in res
    assert "traffic_surge_index" in res
    assert isinstance(res["forecast"], float)
    assert 0.0 <= res["traffic_surge_index"] <= 1.0

def test_traffic_forecast_custom_features():
    payload = {
        "lag_1": 2500,
        "lag_24": 2600,
        "lag_168": 2400,
        "rolling_mean_6h": 2550,
        "rolling_std_6h": 200,
        "hour_of_day": 15,
        "day_of_week": 2,
        "is_weekend": 0,
        "error_ratio": 0.015
    }
    res = traffic_service.forecast(payload)
    assert res["forecast"] > 0
    assert 0.0 <= res["traffic_surge_index"] <= 1.0

def test_traffic_surge_index_bounds():
    tsi_low = traffic_service.compute_tsi(500)
    assert tsi_low == 0.0 # Clipped at 0

    tsi_extreme = traffic_service.compute_tsi(15000)
    assert tsi_extreme == 1.0 # Clipped at 1
