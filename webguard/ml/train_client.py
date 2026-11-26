import os
import joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import IsolationForest
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "client_profiles.csv")
OUTPUTS_DIR = os.path.join(os.path.dirname(__file__), "outputs")
ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), "..", "backend", "artifacts")
os.makedirs(OUTPUTS_DIR, exist_ok=True)
os.makedirs(ARTIFACTS_DIR, exist_ok=True)

def train_client_model():
    print("--- Training Client Behavior Anomaly Detection Model ---")
    df = pd.read_csv(DATA_PATH)
    print(f"Loaded {len(df)} client session profiles.")

    features = ["requests_per_min", "error_rate", "unique_urls"]
    X = df[features].values

    # Fit StandardScaler
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # IsolationForest (Unsupervised)
    iso = IsolationForest(
        n_estimators=100,
        contamination=0.03,
        random_state=42
    )
    iso.fit(X_scaled)

    # Evaluate on the 1,000 profiles
    predictions = iso.predict(X_scaled) # 1: normal, -1: anomaly
    raw_scores = iso.score_samples(X_scaled) # scikit-learn: negative score
    behavior_scores = -raw_scores # negated as specified: behavior_score = -score_samples

    normal_count = int(np.sum(predictions == 1))
    anomalous_count = int(np.sum(predictions == -1))
    min_score = round(float(np.min(behavior_scores)), 4)
    max_score = round(float(np.max(behavior_scores)), 4)
    mean_score = round(float(np.mean(behavior_scores)), 4)

    metrics = {
        "total_profiles": len(df),
        "normal_count": normal_count,
        "anomalous_count": anomalous_count,
        "min_score": min_score,
        "max_score": max_score,
        "mean_score": mean_score
    }

    print("Client Behavior Model Evaluation (1,000 profiles):")
    for k, v in metrics.items():
        print(f"  {k}: {v}")

    # Plot score range distribution
    plot_path = os.path.join(OUTPUTS_DIR, "client_score_range.png")
    plt.figure(figsize=(7, 4.5))
    plt.hist(
        behavior_scores[predictions == 1],
        bins=30,
        alpha=0.7,
        color="#3B82F6",
        label=f"Normal (n={normal_count})"
    )
    plt.hist(
        behavior_scores[predictions == -1],
        bins=20,
        alpha=0.85,
        color="#EF4444",
        label=f"Anomalous (n={anomalous_count})"
    )
    plt.axvline(mean_score, color="#F59E0B", linestyle="--", linewidth=1.5, label=f"Mean: {mean_score}")
    plt.title("Client Anomaly Behavior Score (-score_samples) Distribution", fontsize=11, fontweight="bold")
    plt.xlabel("Behavior Score (-score_samples)")
    plt.ylabel("Number of Profiles")
    plt.legend()
    plt.tight_layout()
    plt.savefig(plot_path, dpi=200)
    plt.close()
    print(f"Saved score-range plot to {plot_path}")

    # Save artifacts
    model_path = os.path.join(ARTIFACTS_DIR, "client_anomaly_model.joblib")
    scaler_path = os.path.join(ARTIFACTS_DIR, "client_scaler.joblib")
    meta_path = os.path.join(ARTIFACTS_DIR, "client_metadata.joblib")

    joblib.dump(iso, model_path)
    joblib.dump(scaler, scaler_path)
    joblib.dump(metrics, meta_path)

    print(f"Client model artifacts saved to {ARTIFACTS_DIR}")
    return metrics

if __name__ == "__main__":
    train_client_model()
