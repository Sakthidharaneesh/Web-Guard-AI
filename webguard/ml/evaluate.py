import os
import json
import joblib
import numpy as np
import pandas as pd
from scipy.sparse import hstack, csr_matrix
from sklearn.metrics import (
    mean_absolute_error, mean_squared_error, r2_score,
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix
)
import sys
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from train_traffic import build_features, compute_metrics as compute_traffic_metrics
from train_attack import extract_structural_features

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
OUTPUTS_DIR = os.path.join(os.path.dirname(__file__), "outputs")
ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), "..", "backend", "artifacts")
os.makedirs(OUTPUTS_DIR, exist_ok=True)

def evaluate_all():
    print("=" * 80)
    print("       WEBGUARD AI: COMPREHENSIVE MACHINE LEARNING MODEL EVALUATION      ")
    print("=" * 80)

    # -------------------------------------------------------------
    # 1. EVALUATE TRAFFIC FORECASTER
    # -------------------------------------------------------------
    print("\n[MODULE 1] Traffic Forecasting Evaluation (NASA HTTP Log Series)")
    print("-" * 80)
    traffic_model = joblib.load(os.path.join(ARTIFACTS_DIR, "traffic_forecaster.joblib"))
    traffic_scaler = joblib.load(os.path.join(ARTIFACTS_DIR, "traffic_scaler.joblib"))
    traffic_base = joblib.load(os.path.join(ARTIFACTS_DIR, "traffic_baseline.joblib"))

    df_traffic = pd.read_csv(os.path.join(DATA_DIR, "hourly_traffic.csv"))
    df_feat, feature_cols = build_features(df_traffic)
    split_idx = int(len(df_feat) * 0.80)
    test_traffic = df_feat.iloc[split_idx:]

    X_test_tr = traffic_scaler.transform(test_traffic[feature_cols].values)
    y_test_tr = test_traffic["request_count"].values
    y_pred_gbr = traffic_model.predict(X_test_tr)

    traffic_metrics_gbr = compute_traffic_metrics(y_test_tr, y_pred_gbr)
    traffic_metrics_sarima = traffic_base.get("metrics_sarima", {})

    print(f"{'Model':<28} | {'MAE':<10} | {'RMSE':<10} | {'MAPE (%)':<10} | {'R2 Score':<10}")
    print("-" * 80)
    print(f"{'GradientBoostingRegressor':<28} | {traffic_metrics_gbr['MAE']:<10} | {traffic_metrics_gbr['RMSE']:<10} | {traffic_metrics_gbr['MAPE']:<10} | {traffic_metrics_gbr['R2']:<10}")
    print(f"{'SARIMA Baseline':<28} | {traffic_metrics_sarima.get('MAE', 'N/A'):<10} | {traffic_metrics_sarima.get('RMSE', 'N/A'):<10} | {traffic_metrics_sarima.get('MAPE', 'N/A'):<10} | {traffic_metrics_sarima.get('R2', 'N/A'):<10}")
    print(f"Traffic Baseline Mean: {traffic_base['BASELINE']:.2f} req/hr | Sigma: {traffic_base['SIGMA']:.2f}")

    # -------------------------------------------------------------
    # 2. EVALUATE WEB ATTACK DETECTOR
    # -------------------------------------------------------------
    print("\n[MODULE 2] Web Attack Detection Evaluation (CSIC 2010 HTTP Dataset)")
    print("-" * 80)
    attack_model = joblib.load(os.path.join(ARTIFACTS_DIR, "web_attack_model.joblib"))
    tfidf = joblib.load(os.path.join(ARTIFACTS_DIR, "tfidf_vectorizer.joblib"))
    attack_scaler = joblib.load(os.path.join(ARTIFACTS_DIR, "attack_scaler.joblib"))
    method_encoder = joblib.load(os.path.join(ARTIFACTS_DIR, "method_encoder.joblib"))

    df_attack = pd.read_csv(os.path.join(DATA_DIR, "csic_2010.csv"))
    # Evaluate on full dataset / test split
    X_raw = df_attack["request_string"].astype(str).values
    y_attack = df_attack["label"].values

    X_struct, _ = extract_structural_features(X_raw, method_encoder=method_encoder, fit_encoder=False)
    X_struct_sc = attack_scaler.transform(X_struct)
    X_tfidf = tfidf.transform(X_raw)
    X_combined = hstack([csr_matrix(X_struct_sc), X_tfidf])

    y_pred_att = attack_model.predict(X_combined)
    acc = accuracy_score(y_attack, y_pred_att)
    prec = precision_score(y_attack, y_pred_att)
    rec = recall_score(y_attack, y_pred_att)
    f1 = f1_score(y_attack, y_pred_att)
    cm = confusion_matrix(y_attack, y_pred_att)
    tn, fp, fn, tp = cm.ravel()

    attack_metrics = {
        "Accuracy": round(float(acc), 4),
        "Precision": round(float(prec), 4),
        "Recall": round(float(rec), 4),
        "F1": round(float(f1), 4),
        "TN": int(tn),
        "FP": int(fp),
        "FN": int(fn),
        "TP": int(tp)
    }

    print(f"{'Metric':<20} | {'Value':<15}")
    print("-" * 40)
    print(f"{'Accuracy':<20} | {attack_metrics['Accuracy']:<15}")
    print(f"{'Precision':<20} | {attack_metrics['Precision']:<15}")
    print(f"{'Recall':<20} | {attack_metrics['Recall']:<15}")
    print(f"{'F1-Score':<20} | {attack_metrics['F1']:<15}")
    print("-" * 40)
    print(f"Confusion Matrix: TN={tn}, FP={fp}, FN={fn}, TP={tp}")
    print(f"Confusion Matrix Plot: {os.path.join(OUTPUTS_DIR, 'confusion_matrix.png')}")

    # -------------------------------------------------------------
    # 3. EVALUATE CLIENT BEHAVIOR ANOMALY ENGINE
    # -------------------------------------------------------------
    print("\n[MODULE 3] Client Behavior Anomaly Detection (Isolation Forest)")
    print("-" * 80)
    client_model = joblib.load(os.path.join(ARTIFACTS_DIR, "client_anomaly_model.joblib"))
    client_scaler = joblib.load(os.path.join(ARTIFACTS_DIR, "client_scaler.joblib"))

    df_client = pd.read_csv(os.path.join(DATA_DIR, "client_profiles.csv"))
    features_cl = ["requests_per_min", "error_rate", "unique_urls"]
    X_cl_sc = client_scaler.transform(df_client[features_cl].values)

    preds_cl = client_model.predict(X_cl_sc)
    scores_cl = -client_model.score_samples(X_cl_sc)

    normal_cnt = int(np.sum(preds_cl == 1))
    anom_cnt = int(np.sum(preds_cl == -1))
    min_sc = round(float(np.min(scores_cl)), 4)
    max_sc = round(float(np.max(scores_cl)), 4)
    mean_sc = round(float(np.mean(scores_cl)), 4)

    client_metrics = {
        "total_profiles": len(df_client),
        "normal_count": normal_cnt,
        "anomalous_count": anom_cnt,
        "min_score": min_sc,
        "max_score": max_sc,
        "mean_score": mean_sc
    }

    print(f"{'Metric':<25} | {'Value':<15}")
    print("-" * 45)
    print(f"{'Total Evaluated Profiles':<25} | {client_metrics['total_profiles']:<15}")
    print(f"{'Normal Profiles (1)':<25} | {client_metrics['normal_count']:<15}")
    print(f"{'Anomalous Profiles (-1)':<25} | {client_metrics['anomalous_count']:<15}")
    print(f"{'Min Behavior Score':<25} | {client_metrics['min_score']:<15}")
    print(f"{'Max Behavior Score':<25} | {client_metrics['max_score']:<15}")
    print(f"{'Mean Behavior Score':<25} | {client_metrics['mean_score']:<15}")
    print(f"Score Range Plot: {os.path.join(OUTPUTS_DIR, 'client_score_range.png')}")

    # Save summary json
    summary = {
        "traffic": {
            "gbr": traffic_metrics_gbr,
            "sarima": traffic_metrics_sarima,
            "baseline": traffic_base["BASELINE"],
            "sigma": traffic_base["SIGMA"]
        },
        "attack": attack_metrics,
        "client": client_metrics
    }
    summary_path = os.path.join(OUTPUTS_DIR, "evaluation_summary.json")
    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2)
    print(f"\nAll metrics exported to: {summary_path}")
    print("=" * 80)
    return summary

if __name__ == "__main__":
    evaluate_all()
