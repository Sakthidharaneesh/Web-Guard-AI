import pytest
import sys
import os
import json
import time

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app import app

@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client

def test_health_endpoint(client):
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "ok"
    assert data["models_loaded"] is True

def test_traffic_endpoint(client):
    payload = {
        "lag_1": 2800,
        "lag_24": 2900,
        "lag_168": 2700,
        "rolling_mean_6h": 2850,
        "rolling_std_6h": 220,
        "hour_of_day": 14,
        "day_of_week": 1,
        "is_weekend": 0,
        "error_ratio": 0.02
    }
    start = time.time()
    res = client.post("/api/v1/traffic/forecast", json=payload)
    elapsed = (time.time() - start) * 1000.0
    assert res.status_code == 200
    data = res.get_json()
    assert "forecast" in data
    assert "traffic_surge_index" in data
    assert data["forecast"] > 0
    # Latency verification
    assert elapsed < 50.0

def test_client_endpoint(client):
    payload = {
        "requests_per_min": 12.0,
        "error_rate": 0.02,
        "unique_urls": 10.0
    }
    res = client.post("/api/v1/client/analyze", json=payload)
    assert res.status_code == 200
    data = res.get_json()
    assert "anomaly" in data
    assert "anomaly_score" in data

def test_attack_endpoint(client):
    payload = {
        "request_string": "GET /tienda1/productos/ver.jsp?id=1 HTTP/1.1\nHost: store.webguard.local",
        "requests_per_min": 4.0,
        "error_rate": 0.01,
        "unique_urls": 5.0
    }
    res = client.post("/api/v1/attack/analyze", json=payload)
    assert res.status_code == 200
    data = res.get_json()
    assert "attack_probability" in data
    assert "behavior_score" in data
    assert "traffic_surge_index" in data
    assert "risk_score" in data
    assert "is_threat" in data

def test_stats_endpoint(client):
    res = client.get("/api/v1/stats")
    assert res.status_code == 200
    data = res.get_json()
    assert "traffic_baseline" in data
