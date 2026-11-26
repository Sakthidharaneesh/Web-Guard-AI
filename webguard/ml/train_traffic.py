import os
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from statsmodels.tsa.statespace.sarimax import SARIMAX

DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "hourly_traffic.csv")
ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), "..", "backend", "artifacts")
os.makedirs(ARTIFACTS_DIR, exist_ok=True)

def build_features(df):
    df = df.copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values("timestamp").reset_index(drop=True)

    # Time indicators
    df["hour_of_day"] = df["timestamp"].dt.hour
    df["day_of_week"] = df["timestamp"].dt.dayofweek
    df["is_weekend"] = (df["timestamp"].dt.dayofweek >= 5).astype(int)

    # Lags (shift(1) to avoid data leakage)
    df["lag_1"] = df["request_count"].shift(1)
    df["lag_24"] = df["request_count"].shift(24)
    df["lag_168"] = df["request_count"].shift(168)

    # Rolling statistics (using past values up to t-1)
    past_series = df["request_count"].shift(1)
    mean_val = df["request_count"].mean()
    df["rolling_mean_6h"] = past_series.rolling(window=6, min_periods=1).mean().fillna(mean_val)
    df["rolling_std_6h"] = past_series.rolling(window=6, min_periods=1).std().fillna(0.0)

    # Fallback for early rows where lag_168 is NaN
    # We backfill lags with lag_24 or mean to keep sufficient training data
    df["lag_168"] = df["lag_168"].fillna(df["lag_24"]).fillna(df["lag_1"]).fillna(df["request_count"].mean())
    df["lag_24"] = df["lag_24"].fillna(df["lag_1"]).fillna(df["request_count"].mean())
    df["lag_1"] = df["lag_1"].fillna(df["request_count"].mean())

    feature_cols = [
        "lag_1", "lag_24", "lag_168",
        "rolling_mean_6h", "rolling_std_6h",
        "hour_of_day", "day_of_week", "is_weekend",
        "error_ratio"
    ]

    return df, feature_cols

def compute_metrics(y_true, y_pred):
    mae = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    mape = np.mean(np.abs((y_true - y_pred) / np.maximum(y_true, 1))) * 100
    r2 = r2_score(y_true, y_pred)
    return {
        "MAE": round(float(mae), 2),
        "RMSE": round(float(rmse), 2),
        "MAPE": round(float(mape), 2),
        "R2": round(float(r2), 4)
    }

def train_traffic_model():
    print("--- Training Traffic Forecasting Model ---")
    df = pd.read_csv(DATA_PATH)
    df, feature_cols = build_features(df)

    # Time-based split: 80% train, 20% test (no shuffling)
    split_idx = int(len(df) * 0.80)
    train_df = df.iloc[:split_idx]
    test_df = df.iloc[split_idx:]

    X_train = train_df[feature_cols].values
    y_train = train_df["request_count"].values
    X_test = test_df[feature_cols].values
    y_test = test_df["request_count"].values

    print(f"Dataset split: Train={len(train_df)} hours, Test={len(test_df)} hours")

    # Fit StandardScaler
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # GradientBoostingRegressor
    gbr = GradientBoostingRegressor(
        n_estimators=300,
        learning_rate=0.05,
        max_depth=4,
        random_state=42
    )
    gbr.fit(X_train_scaled, y_train)
    y_pred_gbr = gbr.predict(X_test_scaled)
    metrics_gbr = compute_metrics(y_test, y_pred_gbr)
    print("GradientBoostingRegressor Results:", metrics_gbr)

    # Baseline: SARIMA model
    print("Fitting SARIMA baseline model...")
    try:
        # Fit SARIMAX on train series with order=(1,1,1), seasonal_order=(1,0,0,24)
        sarima = SARIMAX(
            y_train,
            order=(1, 1, 1),
            seasonal_order=(1, 0, 0, 24),
            enforce_stationarity=False,
            enforce_invertibility=False
        )
        sarima_res = sarima.fit(disp=False, maxiter=25)
        # Forecast test length
        y_pred_sarima = sarima_res.forecast(steps=len(y_test))
        metrics_sarima = compute_metrics(y_test, y_pred_sarima)
    except Exception as e:
        print(f"SARIMA fitting warning: {e}. Falling back to ARIMA(2,1,1)")
        sarima = SARIMAX(y_train, order=(2, 1, 1), enforce_stationarity=False, enforce_invertibility=False)
        sarima_res = sarima.fit(disp=False, maxiter=25)
        y_pred_sarima = sarima_res.forecast(steps=len(y_test))
        metrics_sarima = compute_metrics(y_test, y_pred_sarima)

    print("SARIMA Baseline Results:", metrics_sarima)

    # Calculate BASELINE and SIGMA
    baseline_val = float(np.mean(y_train))
    sigma_val = float(np.std(y_train))
    print(f"Traffic Baseline: {baseline_val:.2f}, Sigma: {sigma_val:.2f}")

    # Save artifacts
    model_path = os.path.join(ARTIFACTS_DIR, "traffic_forecaster.joblib")
    scaler_path = os.path.join(ARTIFACTS_DIR, "traffic_scaler.joblib")
    baseline_path = os.path.join(ARTIFACTS_DIR, "traffic_baseline.joblib")

    joblib.dump(gbr, model_path)
    joblib.dump(scaler, scaler_path)

    recent_history = df.tail(48)[["timestamp", "request_count", "error_ratio"]].to_dict(orient="records")
    for r in recent_history:
        r["timestamp"] = str(r["timestamp"])

    baseline_info = {
        "BASELINE": baseline_val,
        "SIGMA": sigma_val,
        "feature_cols": feature_cols,
        "metrics_gbr": metrics_gbr,
        "metrics_sarima": metrics_sarima,
        "recent_history": recent_history
    }
    joblib.dump(baseline_info, baseline_path)

    print(f"Artifacts successfully saved to {ARTIFACTS_DIR}")
    return metrics_gbr, metrics_sarima

if __name__ == "__main__":
    train_traffic_model()
