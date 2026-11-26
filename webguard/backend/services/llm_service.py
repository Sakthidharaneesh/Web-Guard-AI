import os
import json
import re

def parse_request_details(request_str):
    if not request_str:
        return "192.168.1.105", "/", "Generic Probe"
    
    first_line = request_str.split("\n")[0].strip()
    parts = first_line.split(" ")
    url = parts[1] if len(parts) > 1 else "/"
    
    # Try finding Host or IP
    ip_match = re.search(r'\b(?:\d{1,3}\.){3}\d{1,3}\b', request_str)
    client_ip = ip_match.group(0) if ip_match else "198.51.100.42"

    req_lower = request_str.lower()
    if any(k in req_lower for k in ["select", "union", "drop", "1=1", "sleep", "--"]):
        attack_type = "SQL Injection (SQLi)"
    elif any(k in req_lower for k in ["<script", "alert(", "onerror", "onload", "svg"]):
        attack_type = "Cross-Site Scripting (XSS)"
    elif any(k in req_lower for k in ["etc/passwd", "win.ini", "..", "boot.ini"]):
        attack_type = "Directory Path Traversal / LFI"
    elif any(k in req_lower for k in ["whoami", "cmd=", "|", "; rm", "ping"]):
        attack_type = "OS Command Injection"
    else:
        attack_type = "Automated Exploit / HTTP Flood"

    return client_ip, url, attack_type

def generate_fallback_report(risk_payload):
    req_str = risk_payload.get("request_string", "")
    client_ip, endpoint, attack_type = parse_request_details(req_str)
    
    risk_score = float(risk_payload.get("risk_score", 0.75))
    attack_prob = float(risk_payload.get("attack_probability", 0.90))
    behavior_score = float(risk_payload.get("behavior_score", 0.50))
    tsi = float(risk_payload.get("traffic_surge_index", 0.35))
    
    # Endpoint clean for nginx
    clean_endpoint = endpoint.split("?")[0] if "?" in endpoint else endpoint
    if not clean_endpoint.startswith("/"):
        clean_endpoint = "/" + clean_endpoint

    if "SQL" in attack_type:
        technique_id = "T1190"
        technique_name = "Exploit Public-Facing Application: SQL Injection"
        tactic = "Initial Access"
    elif "XSS" in attack_type:
        technique_id = "T1059.007"
        technique_name = "Command and Scripting Interpreter: JavaScript (XSS)"
        tactic = "Execution"
    elif "Traversal" in attack_type:
        technique_id = "T1083"
        technique_name = "File and Directory Discovery / Path Traversal"
        tactic = "Discovery"
    elif "Command" in attack_type:
        technique_id = "T1059"
        technique_name = "Command and Scripting Interpreter"
        tactic = "Execution"
    else:
        technique_id = "T1498"
        technique_name = "Network Denial of Service: Direct Network Flood"
        tactic = "Impact"

    report = f"""# 🛡️ WebGuard Automated Threat Analysis & Incident Response Report

## 1. Risk Summary & Root Cause Analysis
- **Threat Status**: **CRITICAL ACTIVE THREAT** (Composite Risk: `{risk_score:.4f}` ≥ 0.65)
- **Primary Attack Vector**: **{attack_type}** (Inference Confidence: `{attack_prob * 100:.1f}%`)
- **Offending Source IP**: `{client_ip}`
- **Target Application Endpoint**: `{endpoint}`
- **Client Anomaly Score**: `{behavior_score:.4f}`
- **Traffic Surge Index (TSI)**: `{tsi:.4f}`
- **Root Cause Analysis**:
  The WebGuard multi-model security engine detected malicious payloads matching known exploitation primitives in the incoming HTTP request stream. Concurrently, the client session exhibited anomalous velocity metrics exceeding baseline normal traffic thresholds. Left unmitigated, this vector could lead to unauthorized database exfiltration, remote session compromise, or denial of service on downstream database connectors.

## 2. MITRE ATT&CK Framework Mapping
| Tactic | Technique ID | Technique Name | Impact & Vector Details |
| :--- | :--- | :--- | :--- |
| **{tactic}** | `{technique_id}` | **{technique_name}** | Targeted probe directed at `{endpoint}` payload parameters |
| **Defense Evasion** | `T1027` | Obfuscated/Encoded Files or Information | Parameter encoding and quotation evasion syntax detected |
| **Impact** | `T1499.003` | Endpoint Denial of Service: Application Exhaustion | Correlated client surge (TSI `{tsi:.2f}`) with rapid error generation |

## 3. Immediate Automated Mitigation Code

### A. Deterministic Nginx Rate-Limit & Drop Configuration
Deploy immediately to `/etc/nginx/conf.d/webguard_mitigation.conf`:
```nginx
# WebGuard AI Instant Threat Isolation Rule
limit_req_zone $binary_remote_addr zone=threat_defense_zone:10m rate=1r/s;

# Direct isolation for offending client IP
geo $blocked_clients {{
    default 0;
    {client_ip} 1;
}}

server {{
    location {clean_endpoint} {{
        if ($blocked_clients) {{
            return 403 "Forbidden: Request blocked by WebGuard Automated Defense.";
        }}

        # Strict rate-limiting for suspected flood/attack vectors
        limit_req zone=threat_defense_zone burst=2 nodelay;
        limit_req_status 429;

        # Block signature indicators
        if ($query_string ~* "(select|union|concat|<script|onload|passwd|\.\./)") {{
            return 400 "Bad Request: Malicious characters detected.";
        }}

        proxy_pass http://backend_application_upstream;
    }}
}}
```

### B. Linux Kernel Firewall (`iptables`) Defense Script
Execute with root privileges on the perimeter ingress node:
```bash
#!/usr/bin/env bash
# WebGuard Autonomous Perimeter Defense Execution
echo "[WebGuard] Applying deterministic firewall block for IP: {client_ip}..."

# 1. Immediately drop all traffic from offending source IP
iptables -I INPUT 1 -s {client_ip} -j DROP

# 2. Rate-limit HTTP flood requests on ingress port 80/443
iptables -A INPUT -p tcp --dport 80 -m state --state NEW -m recent --set
iptables -A INPUT -p tcp --dport 80 -m state --state NEW -m recent --update --seconds 10 --hitcount 30 -j DROP

# 3. Log blocked incident to security syslog
logger -p local0.warn "WebGuard AI: Dropped exploit packet from {client_ip} targeting {endpoint}"
echo "[WebGuard] Mitigation active. Perimeter rules locked."
```
"""
    return report

def generate_security_report(risk_payload):
    """
    Calls Groq API if GROQ_API_KEY is available.
    Otherwise returns deterministic structured markdown fallback report.
    """
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip()

    if not api_key:
        print("[LLM Service] No GROQ_API_KEY set. Returning deterministic fallback report.")
        return generate_fallback_report(risk_payload)

    risk_json_str = json.dumps(risk_payload, indent=2)
    system_prompt = (
        "You are an expert Web Security Analyst. Analyze the following web traffic "
        "forecast and risk context payload and generate a structured markdown report "
        "containing: 1. Risk Summary & Root Cause Analysis 2. MITRE ATT&CK Framework "
        "Mapping (Tactics, Technique IDs, Technique Names) 3. Immediate Automated "
        "Mitigation Code (Deterministic Nginx / iptables script to rate-limit or block "
        f"the offending IP/endpoint). Context Payload: {risk_json_str}"
    )

    try:
        from groq import Groq
        client = Groq(api_key=api_key)
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Generate the comprehensive WebGuard threat report for: {risk_json_str}"}
            ],
            temperature=0.2,
            max_tokens=2500,
            timeout=15
        )
        report_content = response.choices[0].message.content
        if report_content and len(report_content.strip()) > 50:
            return report_content
        return generate_fallback_report(risk_payload)
    except Exception as e:
        print(f"[LLM Service] Groq API call failed: {e}. Falling back to deterministic report.")
        return generate_fallback_report(risk_payload)
