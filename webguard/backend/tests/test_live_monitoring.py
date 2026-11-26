import pytest
import sys
import os
import json
import time

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app import app
from services.live_service import live_service

@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client

def test_live_datasets_endpoint(client):
    res = client.get("/api/v1/live/datasets")
    assert res.status_code == 200
    data = res.get_json()
    assert "datasets" in data
    assert len(data["datasets"]) >= 2
    assert "active_dataset_id" in data

def test_live_state_endpoint(client):
    res = client.get("/api/v1/live/state")
    assert res.status_code == 200
    data = res.get_json()
    assert "is_running" in data
    assert "kpis" in data
    assert "total_processed" in data["kpis"]
    assert "timeline" in data
    assert "recent_events" in data

def test_live_control_endpoint(client):
    # Test setting speed
    res = client.post("/api/v1/live/control", json={"action": "set_speed", "speed": 5})
    assert res.status_code == 200
    data = res.get_json()
    assert data["speed"] == 5

    # Test pause and reset
    res = client.post("/api/v1/live/control", json={"action": "reset"})
    assert res.status_code == 200
    data = res.get_json()
    assert data["kpis"]["total_processed"] == 0

def test_live_ingest_endpoint(client):
    payload = {
        "request_string": "GET /search?q=1' OR 1=1-- HTTP/1.1\nHost: mywebsite.com",
        "client_ip": "198.51.100.99",
        "requests_per_min": 50.0,
        "error_rate": 0.20,
        "unique_urls": 3
    }
    res = client.post("/api/v1/live/ingest", json=payload)
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "ingested"
    assert "event" in data
    event = data["event"]
    assert event["client_ip"] == "198.51.100.99"
    assert event["is_threat"] is True
    assert "SQL" in event["attack_type"]
    assert event["risk_score"] >= 0.65
