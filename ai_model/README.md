# 🤖 GeoMesh Sentinel — AI Multi-Model Detection Pipeline

This module implements the edge-to-server AI pipeline for **geotechnical strata breach detection and miner safety monitoring**, combining signal processing with deep learning and ensemble trees.

## 🧠 Model Architecture & Methodology

1. **1D Kalman Filtering (Edge Denoising)**:
   - Filters 6-DOF IMU channels (`acc_x, acc_y, acc_z, gyro_x, gyro_y, gyro_z`) to isolate actual geotechnical displacement and miner dynamics from machinery vibrations and environmental noise.
   - Process variance $Q = 10^{-5}$, Measurement variance $R = 0.01$.

2. **Window Feature Engineering**:
   - Computes statistical moments over sliding 2.0s windows (mean, standard deviation, min, max, median, 25th/75th percentiles, absolute first difference).
   - Computes **Signal Vector Magnitude (SVM)**: $SVM = \sqrt{a_x^2 + a_y^2 + a_z^2}$.
   - Computes angular velocity magnitude and heart rate dynamics.

3. **Multi-Model Inference**:
   - **Model 1 — Deep Learning LSTM**: Dual-layer LSTM (`LSTM(32) -> Dropout(0.2) -> LSTM(16) -> Dense(32) -> Dense(1, Sigmoid)`) with $L_2$ regularization and label smoothing.
   - **Model 2 — ExtraTrees Classifier**: 400-tree ensemble with StratifiedKFold GridSearch and optional SMOTE rebalancing.
   - **Model 3 — 1D-Kalman Peak SVM Detector**: High-speed edge heuristic detecting acceleration impulses exceeding the $2.5g$ critical threshold.

## 🚀 Execution Instructions

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Generate benchmark dataset (if you don't have custom sensor logs)
python generate_dataset.py

# 3. Train models and generate evaluation metrics Excel report
python strata_fall_detector.py
```

Outputs will be generated at `Fallall_output.xlsx` containing:
- Sheet `Metrics`: Accuracy, F1-Score, and Precision across all 3 models.
- Sheet `Predictions`: True ground-truth vs Kalman, LSTM, and ExtraTrees predictions.
