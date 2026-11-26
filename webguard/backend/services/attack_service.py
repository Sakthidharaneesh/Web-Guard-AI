import os
import re
import math
from collections import Counter
import joblib
import numpy as np
from scipy.sparse import hstack, csr_matrix
from .client_service import client_service
from .traffic_service import traffic_service
from .llm_service import generate_security_report

ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), "..", "artifacts")

SQL_REGEX = re.compile(
    r"(?i)\b(select|union|insert|update|delete|drop|exec|declare|cast|information_schema|table_name|column_name|script|alert|onload|onerror|eval|passwd|win\.ini|boot\.ini|cmd|whoami|cat\s+/)\b|--|\/\*|\*\/|\'\s*or\s*\'?|\bor\s+\d+=\d+|\band\s+\d+=\d+|\'--|1=1"
)
SPECIAL_CHARS = set(r"'\"<>;()/\-={}$`|&!#*+[]%")

def calculate_entropy(text):
    if not text:
        return 0.0
    length = len(text)
    counts = Counter(text)
    entropy = -sum((count / length) * math.log2(count / length) for count in counts.values())
    return round(entropy, 4)

def parse_http_components(request_str):
    if not request_str or not isinstance(request_str, str):
        request_str = "GET / HTTP/1.1"
    
    first_line = request_str.split("\n")[0].strip()
    parts = first_line.split(" ")
    method = parts[0].upper() if len(parts) > 0 and parts[0] else "GET"

    if len(parts) >= 3 and parts[-1].upper().startswith("HTTP/"):
        url = " ".join(parts[1:-1])
    elif len(parts) > 1:
        url = " ".join(parts[1:])
    else:
        url = "/"

    payload = ""
    if "?" in url:
        payload += url.split("?", 1)[1]
    if "\n\n" in request_str:
        payload += " " + request_str.split("\n\n", 1)[1]
    elif "\\n\\n" in request_str:
        payload += " " + request_str.split("\\n\\n", 1)[1]

    return method, url, payload

class AttackService:
    def __init__(self):
        self.model = None
        self.tfidf = None
        self.scaler = None
        self.method_encoder = None
        self.metadata = None
        self.load_artifacts()

    def load_artifacts(self):
        try:
            model_path = os.path.join(ARTIFACTS_DIR, "web_attack_model.joblib")
            tfidf_path = os.path.join(ARTIFACTS_DIR, "tfidf_vectorizer.joblib")
            scaler_path = os.path.join(ARTIFACTS_DIR, "attack_scaler.joblib")
            encoder_path = os.path.join(ARTIFACTS_DIR, "method_encoder.joblib")
            meta_path = os.path.join(ARTIFACTS_DIR, "attack_metadata.joblib")

            if os.path.exists(model_path):
                self.model = joblib.load(model_path)
            if os.path.exists(tfidf_path):
                self.tfidf = joblib.load(tfidf_path)
            if os.path.exists(scaler_path):
                self.scaler = joblib.load(scaler_path)
            if os.path.exists(encoder_path):
                self.method_encoder = joblib.load(encoder_path)
            if os.path.exists(meta_path):
                self.metadata = joblib.load(meta_path)
        except Exception as e:
            print(f"Warning loading attack artifacts: {e}")

    def is_loaded(self):
        return self.model is not None and self.tfidf is not None

    def extract_features(self, req_str):
        method, url, payload = parse_http_components(req_str)
        known_methods = set(self.method_encoder.classes_) if self.method_encoder else set()
        safe_method = method if method in known_methods else "GET"
        encoded_method = self.method_encoder.transform([safe_method])[0] if self.method_encoder else 0

        url_length = len(url)
        param_count = req_str.count("&") + req_str.count("?") + req_str.count("=")
        special_char_count = sum(1 for c in req_str if c in SPECIAL_CHARS)
        payload_length = len(payload)
        digit_count = sum(1 for c in req_str if c.isdigit())
        digit_ratio = digit_count / max(len(req_str), 1)
        entropy = calculate_entropy(req_str)
        has_sql_keyword = 1 if SQL_REGEX.search(req_str) else 0

        structural_vec = np.array([[
            url_length,
            param_count,
            special_char_count,
            encoded_method,
            payload_length,
            digit_ratio,
            entropy,
            has_sql_keyword
        ]], dtype=float)

        structural_scaled = self.scaler.transform(structural_vec)
        text_vec = self.tfidf.transform([req_str])
        combined_vec = hstack([csr_matrix(structural_scaled), text_vec])

        feature_dict = {
            "method": method,
            "url": url,
            "url_length": url_length,
            "param_count": param_count,
            "special_char_count": special_char_count,
            "payload_length": payload_length,
            "digit_ratio": round(digit_ratio, 3),
            "entropy": round(entropy, 3),
            "has_sql_keyword": has_sql_keyword
        }

        return combined_vec, feature_dict

    def analyze(self, payload):
        """
        Accepts:
          request_string: str
          requests_per_min: float (optional)
          error_rate: float (optional)
          unique_urls: float (optional)
          traffic_surge_index: float (optional)
        Returns:
          { attack_probability, behavior_score, traffic_surge_index,
            risk_score, is_threat, predicted_label, llm_report, features }
        """
        if payload is None:
            payload = {}

        req_str = payload.get("request_string")
        if not req_str or not isinstance(req_str, str) or not req_str.strip():
            req_str = "GET / HTTP/1.1\nHost: store.webguard.local\nUser-Agent: Mozilla/5.0"

        # 1. Web Attack Model Inference
        combined_vec, feature_dict = self.extract_features(req_str)
        probs = self.model.predict_proba(combined_vec)[0]
        attack_prob = float(probs[1]) if len(probs) > 1 else float(probs[0])
        pred_label = int(self.model.predict(combined_vec)[0])

        # Signature & structural grounding
        if feature_dict.get("has_sql_keyword", 0) == 1:
            attack_prob = max(attack_prob, 0.98)
            pred_label = 1
        elif feature_dict.get("has_sql_keyword", 0) == 0 and feature_dict.get("param_count", 0) == 0 and feature_dict.get("payload_length", 0) == 0:
            attack_prob = min(attack_prob, 0.04)
            pred_label = 0

        # 2. Client Behavior Analysis
        client_res = client_service.analyze(payload)
        behavior_score = float(client_res["behavior_score"])

        # 3. Traffic Surge Index (TSI)
        if "traffic_surge_index" in payload and payload["traffic_surge_index"] is not None:
            tsi = float(payload["traffic_surge_index"])
        else:
            if attack_prob >= 0.85:
                tsi = 0.35
            elif client_res["anomaly"] == -1:
                tsi = 0.40
            else:
                tsi = 0.0

        tsi = float(np.clip(tsi, 0.0, 1.0))

        # 4. COMPOSITE RISK ENGINE:
        # risk_score = 0.40 * attack_probability + 0.30 * behavior_score + 0.30 * TSI
        # Threat if risk_score >= 0.65
        risk_score = (0.40 * attack_prob) + (0.30 * behavior_score) + (0.30 * tsi)
        if attack_prob >= 0.90:
            risk_score = max(risk_score, 0.68)
        elif client_res.get("is_anomaly") and tsi >= 0.80:
            risk_score = max(risk_score, 0.68)

        risk_score = round(float(np.clip(risk_score, 0.0, 1.0)), 4)
        is_threat = bool(risk_score >= 0.65)

        # 5. LLM Decision Support Report
        llm_report = ""
        if is_threat:
            risk_context = {
                "request_string": req_str,
                "attack_probability": round(attack_prob, 4),
                "behavior_score": round(behavior_score, 4),
                "traffic_surge_index": round(tsi, 4),
                "risk_score": risk_score,
                "is_threat": is_threat,
                "client_profile": client_res["profile"],
                "features": feature_dict
            }
            llm_report = generate_security_report(risk_context)

        return {
            "attack_probability": round(attack_prob, 4),
            "behavior_score": round(behavior_score, 4),
            "traffic_surge_index": round(tsi, 4),
            "risk_score": risk_score,
            "is_threat": is_threat,
            "predicted_label": pred_label,
            "llm_report": llm_report,
            "features": feature_dict,
            "client_analysis": client_res
        }

attack_service = AttackService()
