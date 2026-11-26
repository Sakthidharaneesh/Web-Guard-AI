import os
import sys
import time
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Ensure project paths are resolved
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

load_dotenv(os.path.join(BASE_DIR, ".env"))

from services.traffic_service import traffic_service
from services.attack_service import attack_service
from services.client_service import client_service
from services.live_service import live_service, UPLOADS_DIR
from services.llm_service import generate_security_report
from werkzeug.utils import secure_filename

app = Flask(__name__)
CORS(app)

# Load evaluation summary if exists
EVAL_SUMMARY_PATH = os.path.join(BASE_DIR, "..", "ml", "outputs", "evaluation_summary.json")

@app.route("/api/v1/health", methods=["GET"])
def health_check():
    models_loaded = (
        traffic_service.is_loaded() and
        attack_service.is_loaded() and
        client_service.is_loaded()
    )
    return jsonify({
        "status": "ok",
        "models_loaded": models_loaded,
        "version": "1.0.0"
    }), 200

@app.route("/api/v1/traffic/forecast", methods=["POST"])
def traffic_forecast():
    start_time = time.time()
    try:
        data = request.get_json(silent=True) or {}
        result = traffic_service.forecast(data)
        elapsed_ms = (time.time() - start_time) * 1000.0
        result["latency_ms"] = round(elapsed_ms, 2)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": f"Traffic forecast failed: {str(e)}"}), 500

@app.route("/api/v1/client/analyze", methods=["POST"])
def client_analyze():
    start_time = time.time()
    try:
        data = request.get_json(silent=True) or {}
        result = client_service.analyze(data)
        elapsed_ms = (time.time() - start_time) * 1000.0
        result["latency_ms"] = round(elapsed_ms, 2)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": f"Client analysis failed: {str(e)}"}), 500

@app.route("/api/v1/attack/analyze", methods=["POST"])
def attack_analyze():
    start_time = time.time()
    try:
        data = request.get_json(silent=True) or {}
        result = attack_service.analyze(data)
        elapsed_ms = (time.time() - start_time) * 1000.0
        result["latency_ms"] = round(elapsed_ms, 2)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": f"Attack analysis failed: {str(e)}"}), 500

@app.route("/api/v1/report/generate", methods=["POST"])
def generate_report():
    """Generates an executive incident report using Groq LLM."""
    start_time = time.time()
    try:
        data = request.get_json(silent=True) or {}
        report = generate_security_report(data)
        elapsed_ms = (time.time() - start_time) * 1000.0
        return jsonify({
            "report": report,
            "status": "success",
            "model": os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b"),
            "latency_ms": round(elapsed_ms, 2)
        }), 200
    except Exception as e:
        return jsonify({"error": f"Report generation failed: {str(e)}"}), 500

@app.route("/api/v1/stats", methods=["GET"])
def get_stats():
    """Returns evaluation metrics, baseline parameters, and presets."""
    metrics = {}
    if os.path.exists(EVAL_SUMMARY_PATH):
        try:
            with open(EVAL_SUMMARY_PATH, "r") as f:
                metrics = json.load(f)
        except Exception:
            pass

    return jsonify({
        "metrics": metrics,
        "traffic_baseline": {
            "baseline": traffic_service.baseline,
            "sigma": traffic_service.sigma
        },
        "recent_history": traffic_service.baseline_info.get("recent_history", []) if traffic_service.baseline_info else []
    }), 200

# =====================================================================
# LIVE MONITORING & WEBSITE DATASET ENDPOINTS
# =====================================================================

@app.route("/api/v1/live/datasets", methods=["GET"])
def get_live_datasets():
    """Returns list of available datasets (built-in + uploaded)."""
    live_service.refresh_datasets()
    return jsonify({
        "datasets": list(live_service.datasets.values()),
        "active_dataset_id": live_service.active_dataset_id
    }), 200

@app.route("/api/v1/live/state", methods=["GET"])
def get_live_state():
    """Returns real-time telemetry snapshot, KPIs, and recent event stream."""
    return jsonify(live_service.get_state()), 200

@app.route("/api/v1/live/control", methods=["POST"])
def control_live_stream():
    """Controls the live stream: start, pause, reset, speed, or select dataset."""
    data = request.get_json(silent=True) or {}
    action = data.get("action", "start")
    dataset_id = data.get("dataset_id")
    speed = data.get("speed")

    if action == "start":
        live_service.start_stream(dataset_id=dataset_id, speed=speed)
    elif action == "pause":
        live_service.pause_stream()
    elif action == "reset":
        live_service.reset_stream()
    elif action == "set_speed":
        if speed:
            live_service.speed = int(speed)
    elif action == "select_dataset":
        if dataset_id:
            live_service.load_dataset(dataset_id)

    return jsonify(live_service.get_state()), 200

@app.route("/api/v1/live/upload", methods=["POST"])
def upload_dataset():
    """Uploads a custom website traffic dataset (.csv or .log)."""
    if "file" not in request.files:
        return jsonify({"error": "No file part in request"}), 400
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    filename = secure_filename(file.filename)
    if not filename.endswith((".csv", ".log", ".txt")):
        return jsonify({"error": "Unsupported file format. Please upload .csv or .log"}), 400

    save_path = os.path.join(UPLOADS_DIR, filename)
    file.save(save_path)
    
    live_service.refresh_datasets()
    new_id = f"custom_{filename}"
    live_service.load_dataset(new_id)

    return jsonify({
        "message": f"Dataset {filename} uploaded and loaded successfully",
        "dataset_id": new_id,
        "state": live_service.get_state()
    }), 200

@app.route("/api/v1/live/ingest", methods=["POST"])
def ingest_live_request():
    """
    Ingests an actual live HTTP request from a production website / middleware
    and processes it in real time through the WebGuard core.
    """
    data = request.get_json(silent=True) or {}
    event = live_service.process_request(data)
    return jsonify({
        "status": "ingested",
        "event": event
    }), 200

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
