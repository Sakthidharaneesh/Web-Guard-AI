import pytest
import sys
import os

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from services.llm_service import generate_fallback_report, generate_security_report

def test_llm_fallback_report_structure():
    risk_payload = {
        "request_string": "GET /login?user=' OR 1=1 -- HTTP/1.1\nHost: store.webguard.local",
        "attack_probability": 0.98,
        "behavior_score": 0.52,
        "traffic_surge_index": 0.40,
        "risk_score": 0.74,
        "is_threat": True
    }
    report = generate_fallback_report(risk_payload)
    assert "# 🛡️ WebGuard Automated Threat Analysis" in report
    assert "1. Risk Summary & Root Cause Analysis" in report
    assert "2. MITRE ATT&CK Framework Mapping" in report
    assert "3. Immediate Automated Mitigation Code" in report
    assert "limit_req_zone" in report
    assert "iptables" in report

def test_generate_security_report_without_key():
    # Ensure without API key or with invalid key it deterministically falls back gracefully
    os.environ["GROQ_API_KEY"] = ""
    risk_payload = {
        "request_string": "GET /etc/passwd HTTP/1.1",
        "attack_probability": 0.95,
        "behavior_score": 0.60,
        "traffic_surge_index": 0.20,
        "risk_score": 0.68,
        "is_threat": True
    }
    report = generate_security_report(risk_payload)
    assert len(report) > 100
    assert "MITRE ATT&CK" in report
    assert "iptables" in report
