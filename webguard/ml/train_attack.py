import os
import re
import math
from collections import Counter
import joblib
import numpy as np
import pandas as pd
from scipy.sparse import hstack, csr_matrix
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix
)
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns

DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "csic_2010.csv")
OUTPUTS_DIR = os.path.join(os.path.dirname(__file__), "outputs")
ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), "..", "backend", "artifacts")
os.makedirs(OUTPUTS_DIR, exist_ok=True)
os.makedirs(ARTIFACTS_DIR, exist_ok=True)

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

def extract_structural_features(request_strings, method_encoder=None, fit_encoder=False):
    methods = []
    url_lengths = []
    param_counts = []
    special_char_counts = []
    payload_lengths = []
    digit_ratios = []
    entropies = []
    has_sql_keywords = []

    for req in request_strings:
        method, url, payload = parse_http_components(req)
        methods.append(method)
        url_lengths.append(len(url))
        param_counts.append(req.count("&") + req.count("?") + req.count("="))
        special_char_counts.append(sum(1 for c in req if c in SPECIAL_CHARS))
        payload_lengths.append(len(payload))
        digit_count = sum(1 for c in req if c.isdigit())
        digit_ratios.append(digit_count / max(len(req), 1))
        entropies.append(calculate_entropy(req))
        has_sql_keywords.append(1 if SQL_REGEX.search(req) else 0)

    if fit_encoder:
        method_encoder = LabelEncoder()
        # include standard methods in classes
        all_possible_methods = list(set(methods) | {"GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS"})
        method_encoder.fit(all_possible_methods)
        encoded_methods = method_encoder.transform(methods)
    else:
        known = set(method_encoder.classes_)
        safe_methods = [m if m in known else "GET" for m in methods]
        encoded_methods = method_encoder.transform(safe_methods)

    features = np.column_stack([
        url_lengths,
        param_counts,
        special_char_counts,
        encoded_methods,
        payload_lengths,
        digit_ratios,
        entropies,
        has_sql_keywords
    ])
    return features, method_encoder

def train_attack_model():
    print("--- Training Web Attack Detection Model ---")
    df = pd.read_csv(DATA_PATH)
    print(f"Loaded {len(df)} HTTP requests. Class distribution:")
    print(df["label"].value_counts())

    X_raw = df["request_string"].astype(str).values
    y = df["label"].values

    # Stratified 80/20 train/test split
    X_train_raw, X_test_raw, y_train, y_test = train_test_split(
        X_raw, y, test_size=0.20, stratify=y, random_state=42
    )

    # 1. Structural features
    X_train_struct, method_encoder = extract_structural_features(X_train_raw, fit_encoder=True)
    X_test_struct, _ = extract_structural_features(X_test_raw, method_encoder=method_encoder, fit_encoder=False)

    scaler = StandardScaler()
    X_train_struct_scaled = scaler.fit_transform(X_train_struct)
    X_test_struct_scaled = scaler.transform(X_test_struct)

    # 2. Text TF-IDF features
    tfidf = TfidfVectorizer(analyzer="char", ngram_range=(1, 2), max_features=500)
    X_train_tfidf = tfidf.fit_transform(X_train_raw)
    X_test_tfidf = tfidf.transform(X_test_raw)

    # 3. Combine with scipy.sparse.hstack
    X_train_combined = hstack([csr_matrix(X_train_struct_scaled), X_train_tfidf])
    X_test_combined = hstack([csr_matrix(X_test_struct_scaled), X_test_tfidf])

    # 4. Train RandomForestClassifier
    rf = RandomForestClassifier(
        n_estimators=200,
        max_depth=15,
        random_state=42,
        n_jobs=-1
    )
    rf.fit(X_train_combined, y_train)

    # 5. Evaluate
    y_pred = rf.predict(X_test_combined)
    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred)
    rec = recall_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    cm = confusion_matrix(y_test, y_pred)
    tn, fp, fn, tp = cm.ravel()

    metrics = {
        "Accuracy": round(float(acc), 4),
        "Precision": round(float(prec), 4),
        "Recall": round(float(rec), 4),
        "F1": round(float(f1), 4),
        "TN": int(tn),
        "FP": int(fp),
        "FN": int(fn),
        "TP": int(tp)
    }
    print("Web Attack Detection Metrics:")
    for k, v in metrics.items():
        print(f"  {k}: {v}")

    # 6. Save confusion matrix heatmap as PNG
    cm_path = os.path.join(OUTPUTS_DIR, "confusion_matrix.png")
    plt.figure(figsize=(6, 5))
    sns.heatmap(
        cm,
        annot=True,
        fmt="d",
        cmap="Blues",
        xticklabels=["Normal (0)", "Attack (1)"],
        yticklabels=["Normal (0)", "Attack (1)"],
        cbar=False
    )
    plt.title(f"Web Attack Detection Confusion Matrix\n(F1 Score: {metrics['F1']:.4f})", fontsize=12, fontweight="bold")
    plt.xlabel("Predicted Label")
    plt.ylabel("True Label")
    plt.tight_layout()
    plt.savefig(cm_path, dpi=200)
    plt.close()
    print(f"Saved confusion matrix plot to {cm_path}")

    # 7. Save artifacts
    model_path = os.path.join(ARTIFACTS_DIR, "web_attack_model.joblib")
    tfidf_path = os.path.join(ARTIFACTS_DIR, "tfidf_vectorizer.joblib")
    scaler_path = os.path.join(ARTIFACTS_DIR, "attack_scaler.joblib")
    encoder_path = os.path.join(ARTIFACTS_DIR, "method_encoder.joblib")
    meta_path = os.path.join(ARTIFACTS_DIR, "attack_metadata.joblib")

    joblib.dump(rf, model_path)
    joblib.dump(tfidf, tfidf_path)
    joblib.dump(scaler, scaler_path)
    joblib.dump(method_encoder, encoder_path)
    joblib.dump(metrics, meta_path)

    print(f"Attack detection artifacts saved to {ARTIFACTS_DIR}")
    return metrics

if __name__ == "__main__":
    train_attack_model()
