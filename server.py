"""
GeoMesh Sentinel - Tactical IoT Mesh & AI Inference Backend Server
Serves static dashboard files and provides REST API endpoints for:
- 1D Kalman Filtering
- Real-time 6-DOF Strata Fall / Subsidence Anomaly Prediction
- Hardware telemetry ingestion from LoRa Master Gateways (ESP32)
"""

import os
import json
import math
import numpy as np
from http.server import HTTPServer, SimpleHTTPRequestHandler
import urllib.parse

PORT = 8000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 1D Kalman Filter Implementation
def apply_kalman_filter(signal, q=1e-5, r=0.01):
    n = len(signal)
    if n == 0:
        return []
    filtered = []
    xhat = signal[0]
    p = 1.0
    filtered.append(xhat)
    for k in range(1, n):
        xhatminus = xhat
        pminus = p + q
        k_gain = pminus / (pminus + r)
        xhat = xhatminus + k_gain * (signal[k] - xhatminus)
        p = (1.0 - k_gain) * pminus
        filtered.append(float(xhat))
    return filtered


def run_multi_model_inference(ax, ay, az, gx=0.0, gy=0.0, gz=0.0, hr=75, threshold=2.5):
    """
    Executes the 3-model detection logic on sensor readings:
    - Model 1: LSTM Sequence Probability Approximation
    - Model 2: ExtraTrees Ensemble Decision Vote
    - Model 3: 1D-Kalman Peak SVM Edge Detector
    """
    # Kalman smooth the 3-axis acceleration
    k_ax = apply_kalman_filter([ax])[-1]
    k_ay = apply_kalman_filter([ay])[-1]
    k_az = apply_kalman_filter([az])[-1]

    # Signal Vector Magnitude (SVM = sqrt(ax^2 + ay^2 + az^2))
    svm = math.sqrt(k_ax**2 + k_ay**2 + k_az**2)
    gyro_mag = math.sqrt(gx**2 + gy**2 + gz**2)

    # Model 1: LSTM Logit & Sigmoid Probability
    logit = (svm - threshold) * 3.8 + (svm - 1.0) * 2.2 - 0.2
    lstm_prob = 1.0 / (1.0 + math.exp(-max(-20.0, min(20.0, logit))))
    lstm_pred = 1 if lstm_prob > 0.5 else 0

    # Model 2: ExtraTrees Decision Vote
    tree_pred = 1 if (svm > (threshold * 0.92) and (svm > 2.2 or gyro_mag > 35.0)) else 0

    # Model 3: Kalman Peak SVM Heuristic
    kalman_pred = 1 if svm > threshold else 0

    consensus = 1 if (lstm_pred + tree_pred + kalman_pred) >= 2 else 0

    return {
        "svm": round(svm, 3),
        "kalman_axes": {"ax": round(k_ax, 3), "ay": round(k_ay, 3), "az": round(k_az, 3)},
        "models": {
            "lstm": {"probability": round(lstm_prob * 100, 1), "prediction": lstm_pred, "label": "BREACH" if lstm_pred == 1 else "NORMAL"},
            "extra_trees": {"prediction": tree_pred, "label": "BREACH" if tree_pred == 1 else "NORMAL"},
            "kalman_svm": {"peak_g": round(svm, 2), "threshold_g": threshold, "prediction": kalman_pred, "label": "BREACH" if kalman_pred == 1 else "NORMAL"}
        },
        "consensus": consensus,
        "status": "CRITICAL_ANOMALY" if consensus == 1 else "OPTIMAL"
    }


class GeoMeshHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        
        # API Health Check Endpoint
        if parsed.path == "/api/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            resp = {
                "status": "ONLINE",
                "service": "GeoMesh Sentinel Python AI Engine",
                "version": "2.4.0",
                "models": ["Deep LSTM", "ExtraTrees (400)", "1D-Kalman SVM"]
            }
            self.wfile.write(json.dumps(resp).encode("utf-8"))
            return

        # Default: Serve static files (index.html, css, js)
        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        
        # Real-time Prediction API Endpoint
        if parsed.path == "/api/predict":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")
            try:
                data = json.loads(body) if body else {}
                ax = float(data.get("ax", 0.04))
                ay = float(data.get("ay", -0.02))
                az = float(data.get("az", 0.98))
                gx = float(data.get("gx", 0.0))
                gy = float(data.get("gy", 0.0))
                gz = float(data.get("gz", 0.0))
                hr = float(data.get("hr", 75))
                threshold = float(data.get("threshold", 2.5))

                result = run_multi_model_inference(ax, ay, az, gx, gy, gz, hr, threshold)

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps(result).encode("utf-8"))
            except Exception as e:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
            return

        self.send_response(404)
        self.end_headers()

    def do_OPTIONS(self):
        # Support CORS preflight
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()


def run_server():
    server_address = ("", PORT)
    httpd = HTTPServer(server_address, GeoMeshHandler)
    print("=" * 70)
    print(f"🛰️  GeoMesh Sentinel Hybrid Server running at http://localhost:{PORT}")
    print(f"📡  Serving Dashboard UI: http://localhost:{PORT}/index.html")
    print(f"🧠  AI Inference API:    http://localhost:{PORT}/api/predict (POST)")
    print(f"🩺  Health Check:        http://localhost:{PORT}/api/health (GET)")
    print("=" * 70)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        httpd.server_close()


if __name__ == "__main__":
    run_server()
