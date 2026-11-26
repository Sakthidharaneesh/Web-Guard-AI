import pytest
import sys
import os

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app import app
from services.traffic_service import traffic_service
from services.attack_service import attack_service
from services.client_service import client_service

@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client

def test_tc01_sql_injection_threat_trigger(client):
    """
    TC-01: SQL injection request -> risk >= 0.65, report triggered
    """
    payload = {
        "request_string": "GET /login?user=' OR 1=1 -- HTTP/1.1\nHost: store.webguard.local",
        "requests_per_min": 10.0,
        "error_rate": 0.20,
        "unique_urls": 4.0
    }
    response = client.post("/api/v1/attack/analyze", json=payload)
    assert response.status_code == 200
    data = response.get_json()

    # Risk score must be >= 0.65 and threat report triggered
    assert data["risk_score"] >= 0.65, f"Expected risk >= 0.65, got {data['risk_score']}"
    assert data["is_threat"] is True, "Expected is_threat to be True"
    assert "llm_report" in data, "Expected llm_report in response"
    assert len(data["llm_report"]) > 0, "Expected non-empty LLM report"
    assert "MITRE ATT&CK" in data["llm_report"]

def test_tc02_normal_browsing_green_status(client):
    """
    TC-02: Normal browsing (request_count=2400, error_ratio=0.02)
    -> forecast error < 10%, risk < 0.30, green status
    """
    # 1. Verify traffic forecast error < 10%
    actual_count = 2400.0
    forecast_payload = {
        "request_count": actual_count,
        "lag_1": actual_count,
        "lag_24": actual_count * 1.02,
        "rolling_mean_6h": actual_count,
        "error_ratio": 0.02
    }
    forecast_res = client.post("/api/v1/traffic/forecast", json=forecast_payload)
    assert forecast_res.status_code == 200
    f_data = forecast_res.get_json()
    predicted_forecast = f_data["forecast"]

    forecast_error = abs(predicted_forecast - actual_count) / actual_count
    assert forecast_error < 0.10, f"Expected forecast error < 10%, got {forecast_error * 100:.2f}%"

    # 2. Verify normal attack/client risk < 0.30 (green status)
    attack_payload = {
        "request_string": "GET /catalog/categories HTTP/1.1\nHost: store.webguard.local\nUser-Agent: Mozilla/5.0",
        "requests_per_min": 2.5,
        "error_rate": 0.02,
        "unique_urls": 8.0,
        "traffic_surge_index": 0.0
    }
    attack_res = client.post("/api/v1/attack/analyze", json=attack_payload)
    assert attack_res.status_code == 200
    a_data = attack_res.get_json()

    assert a_data["risk_score"] < 0.30, f"Expected risk < 0.30, got {a_data['risk_score']}"
    assert a_data["is_threat"] is False
    assert a_data["attack_probability"] < 0.10

def test_tc03_http_flood_surge_and_risk(client):
    """
    TC-03: HTTP flood (requests_per_min=4800, unique_urls=2)
    -> TSI > 0.90, risk >= 0.65
    """
    # Traffic surge from high request velocity (e.g. 8500 req/hr)
    surge_payload = {
        "lag_1": 8500,
        "lag_24": 8200,
        "lag_168": 8000,
        "rolling_mean_6h": 8500,
        "rolling_std_6h": 1200,
        "error_ratio": 0.05
    }
    tf_res = client.post("/api/v1/traffic/forecast", json=surge_payload)
    assert tf_res.status_code == 200
    tf_data = tf_res.get_json()
    tsi = tf_data["traffic_surge_index"]

    assert tsi > 0.90, f"Expected TSI > 0.90, got {tsi}"

    # Analyze under flood condition
    flood_payload = {
        "request_string": "GET /flood HTTP/1.1\nHost: store.webguard.local",
        "requests_per_min": 4800.0,
        "unique_urls": 2.0,
        "error_rate": 0.05,
        "traffic_surge_index": tsi
    }
    flood_res = client.post("/api/v1/attack/analyze", json=flood_payload)
    assert flood_res.status_code == 200
    fl_data = flood_res.get_json()

    assert fl_data["risk_score"] >= 0.65, f"Expected risk >= 0.65, got {fl_data['risk_score']}"
    assert fl_data["is_threat"] is True

def test_tc04_bot_client_anomaly(client):
    """
    TC-04: Bot client (requests_per_min=620, error_rate=0.78)
    -> anomaly = -1
    """
    payload = {
        "requests_per_min": 620.0,
        "error_rate": 0.78,
        "unique_urls": 5.0
    }
    res = client.post("/api/v1/client/analyze", json=payload)
    assert res.status_code == 200
    data = res.get_json()

    assert data["anomaly"] == -1, f"Expected anomaly == -1, got {data['anomaly']}"
    assert data["is_anomaly"] is True
