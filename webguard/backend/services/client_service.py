import os
import joblib
import numpy as np

ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), "..", "artifacts")

class ClientService:
    def __init__(self):
        self.model = None
        self.scaler = None
        self.metadata = None
        self.features = ["requests_per_min", "error_rate", "unique_urls"]
        self.load_artifacts()

    def load_artifacts(self):
        try:
            model_path = os.path.join(ARTIFACTS_DIR, "client_anomaly_model.joblib")
            scaler_path = os.path.join(ARTIFACTS_DIR, "client_scaler.joblib")
            meta_path = os.path.join(ARTIFACTS_DIR, "client_metadata.joblib")

            if os.path.exists(model_path):
                self.model = joblib.load(model_path)
            if os.path.exists(scaler_path):
                self.scaler = joblib.load(scaler_path)
            if os.path.exists(meta_path):
                self.metadata = joblib.load(meta_path)
        except Exception as e:
            print(f"Warning loading client anomaly artifacts: {e}")

    def is_loaded(self):
        return self.model is not None and self.scaler is not None

    def analyze(self, payload):
        """
        Evaluates client profile: { requests_per_min, error_rate, unique_urls }
        Returns { anomaly (-1/1), anomaly_score, behavior_score, is_anomaly }
        """
        if payload is None:
            payload = {}

        rpm = float(payload.get("requests_per_min") if payload.get("requests_per_min") is not None else 5.0)
        err = float(payload.get("error_rate") if payload.get("error_rate") is not None else 0.01)
        uniq = float(payload.get("unique_urls") if payload.get("unique_urls") is not None else 6.0)

        vec = np.array([[rpm, err, uniq]], dtype=float)
        vec_scaled = self.scaler.transform(vec)

        pred = int(self.model.predict(vec_scaled)[0])
        # In scikit-learn IsolationForest: score_samples is negative (anomalies more negative)
        raw_score = float(self.model.score_samples(vec_scaled)[0])
        # behavior_score = -score_samples
        behavior_score = -raw_score

        return {
            "anomaly": pred,
            "anomaly_score": round(behavior_score, 4),
            "behavior_score": round(behavior_score, 4),
            "is_anomaly": bool(pred == -1),
            "profile": {
                "requests_per_min": rpm,
                "error_rate": err,
                "unique_urls": uniq
            }
        }

client_service = ClientService()
