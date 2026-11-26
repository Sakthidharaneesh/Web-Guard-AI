import os
import joblib
import numpy as np

ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), "..", "artifacts")

class TrafficService:
    def __init__(self):
        self.model = None
        self.scaler = None
        self.baseline_info = None
        self.baseline = 2986.23
        self.sigma = 1748.54
        self.feature_cols = [
            "lag_1", "lag_24", "lag_168",
            "rolling_mean_6h", "rolling_std_6h",
            "hour_of_day", "day_of_week", "is_weekend",
            "error_ratio"
        ]
        self.load_artifacts()

    def load_artifacts(self):
        try:
            model_path = os.path.join(ARTIFACTS_DIR, "traffic_forecaster.joblib")
            scaler_path = os.path.join(ARTIFACTS_DIR, "traffic_scaler.joblib")
            base_path = os.path.join(ARTIFACTS_DIR, "traffic_baseline.joblib")

            if os.path.exists(model_path):
                self.model = joblib.load(model_path)
            if os.path.exists(scaler_path):
                self.scaler = joblib.load(scaler_path)
            if os.path.exists(base_path):
                self.baseline_info = joblib.load(base_path)
                self.baseline = float(self.baseline_info.get("BASELINE", 2986.23))
                self.sigma = float(self.baseline_info.get("SIGMA", 1748.54))
                if "feature_cols" in self.baseline_info:
                    self.feature_cols = self.baseline_info["feature_cols"]
        except Exception as e:
            print(f"Warning loading traffic artifacts: {e}")

    def is_loaded(self):
        return self.model is not None and self.scaler is not None

    def compute_tsi(self, forecast_value):
        """Traffic Surge Index: clip((forecast - BASELINE) / (3 * SIGMA), 0, 1)"""
        denom = 3.0 * self.sigma
        if denom == 0:
            return 0.0
        tsi = (float(forecast_value) - self.baseline) / denom
        return float(np.clip(tsi, 0.0, 1.0))

    def forecast(self, payload):
        """
        Accepts feature dict or uses defaults.
        Returns { forecast, traffic_surge_index, baseline, sigma }
        """
        if payload is None:
            payload = {}

        # Default features based on baseline NASA statistics
        default_features = {
            "lag_1": float(payload.get("lag_1", self.baseline)),
            "lag_24": float(payload.get("lag_24", self.baseline * 1.05)),
            "lag_168": float(payload.get("lag_168", self.baseline * 0.98)),
            "rolling_mean_6h": float(payload.get("rolling_mean_6h", self.baseline)),
            "rolling_std_6h": float(payload.get("rolling_std_6h", self.sigma * 0.45)),
            "hour_of_day": int(payload.get("hour_of_day", 14)),
            "day_of_week": int(payload.get("day_of_week", 2)),
            "is_weekend": int(payload.get("is_weekend", 0)),
            "error_ratio": float(payload.get("error_ratio", 0.02))
        }

        # Support requests_per_min or request_count overrides
        if "requests_per_min" in payload and payload["requests_per_min"] is not None:
            rpm = float(payload["requests_per_min"])
            # In HTTP flood 4800 req/min = 288,000 req/hr
            hourly_equiv = rpm * 2.0 # scaled hourly surge representation
            default_features["lag_1"] = max(default_features["lag_1"], hourly_equiv)
            default_features["rolling_mean_6h"] = max(default_features["rolling_mean_6h"], hourly_equiv)

        if "request_count" in payload and payload["request_count"] is not None:
            req_cnt = float(payload["request_count"])
            default_features["lag_1"] = req_cnt
            default_features["rolling_mean_6h"] = req_cnt

        vec = np.array([[default_features[col] for col in self.feature_cols]], dtype=float)
        vec_scaled = self.scaler.transform(vec)
        raw_pred = self.model.predict(vec_scaled)[0]
        forecast_val = max(0.0, float(raw_pred))

        # Extrapolate for extreme surges (beyond training max)
        surge_val = max(float(default_features.get("lag_1", 0)), float(default_features.get("rolling_mean_6h", 0)))
        if surge_val >= 8000:
            forecast_val = max(forecast_val, surge_val)

        tsi = self.compute_tsi(forecast_val)

        return {
            "forecast": round(forecast_val, 2),
            "traffic_surge_index": round(tsi, 4),
            "baseline": round(self.baseline, 2),
            "sigma": round(self.sigma, 2),
            "metrics": self.baseline_info.get("metrics_gbr", {}) if self.baseline_info else {},
            "recent_history": self.baseline_info.get("recent_history", []) if self.baseline_info else []
        }

traffic_service = TrafficService()
