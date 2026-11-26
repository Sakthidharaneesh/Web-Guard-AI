import pytest
import sys
import os

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from services.client_service import client_service

def test_client_service_loaded():
    assert client_service.is_loaded() is True

def test_client_service_null_handling():
    res = client_service.analyze(None)
    assert "anomaly" in res
    assert "anomaly_score" in res
    assert "behavior_score" in res
    assert "is_anomaly" in res
    assert res["anomaly"] in (1, -1)

def test_client_normal_behavior():
    normal_client = {
        "requests_per_min": 2.5,
        "error_rate": 0.01,
        "unique_urls": 6.0
    }
    res = client_service.analyze(normal_client)
    assert res["anomaly"] == 1
    assert res["is_anomaly"] is False
    assert res["behavior_score"] < 0.60
