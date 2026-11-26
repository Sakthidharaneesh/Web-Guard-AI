import pytest
import sys
import os

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from services.attack_service import attack_service

def test_attack_service_loaded():
    assert attack_service.is_loaded() is True

def test_attack_service_null_handling():
    res = attack_service.analyze(None)
    assert "attack_probability" in res
    assert "behavior_score" in res
    assert "risk_score" in res
    assert "is_threat" in res
    assert 0.0 <= res["risk_score"] <= 1.0

def test_attack_feature_extraction():
    req = "POST /api/v1/auth/login HTTP/1.1\n\nuser=admin'--&pass=foo"
    vec, feat = attack_service.extract_features(req)
    assert feat["method"] == "POST"
    assert feat["has_sql_keyword"] == 1
    assert feat["param_count"] >= 2
    assert feat["url"] == "/api/v1/auth/login"

def test_attack_detection_confidence():
    sqli = "GET /products?id=1 UNION SELECT 1,username,password FROM users-- HTTP/1.1"
    res = attack_service.analyze({"request_string": sqli})
    assert res["attack_probability"] > 0.80
    assert res["predicted_label"] == 1
