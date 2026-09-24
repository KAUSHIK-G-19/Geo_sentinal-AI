"""
GeoMesh Sentinel - Synthetic 6-DOF IMU Dataset Generator
Generates sample geotechnical / miner wearable telemetry:
acc_x, acc_y, acc_z, gyro_x, gyro_y, gyro_z, heart_rate, fall_event
"""
import os
import numpy as np
import pandas as pd

OUTPUT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fall_detection_dataset.csv")

def generate_benchmark_data(num_samples=15000, sr=100):
    np.random.seed(42)
    time = np.linspace(0, num_samples / sr, num_samples)
    
    # 1. Normal ambient baseline (gravity ~ 1.0g on Z, minor walking/equipment vibration)
    acc_x = np.random.normal(0.05, 0.12, num_samples)
    acc_y = np.random.normal(0.02, 0.10, num_samples)
    acc_z = np.random.normal(0.98, 0.15, num_samples)
    
    gyro_x = np.random.normal(0.0, 4.5, num_samples)
    gyro_y = np.random.normal(0.0, 4.2, num_samples)
    gyro_z = np.random.normal(0.0, 3.8, num_samples)
    
    heart_rate = np.random.normal(76, 5, num_samples)
    fall_event = np.zeros(num_samples, dtype=int)
    
    # 2. Inject periodic fall / strata collapse shockwaves
    event_centers = [2500, 6000, 9500, 13000]
    for center in event_centers:
        span = 200  # 2 seconds at 100Hz
        start = center - span // 2
        end = center + span // 2
        
        # High impact shockwave > 3.2g
        impact = np.sin(np.linspace(0, np.pi, span)) * 3.6
        acc_x[start:end] += np.random.normal(0, 0.8, span) + impact * 0.6
        acc_y[start:end] += np.random.normal(0, 0.9, span) + impact * 0.7
        acc_z[start:end] = impact * 1.8 + np.random.normal(0, 0.4, span)
        
        gyro_x[start:end] += np.random.normal(45.0, 30.0, span)
        gyro_y[start:end] += np.random.normal(52.0, 25.0, span)
        gyro_z[start:end] += np.random.normal(38.0, 20.0, span)
        
        heart_rate[start:end + 800] += np.linspace(10, 45, len(heart_rate[start:end + 800]))
        fall_event[start:end] = 1
        
    df = pd.DataFrame({
        'acc_x': acc_x,
        'acc_y': acc_y,
        'acc_z': acc_z,
        'gyro_x': gyro_x,
        'gyro_y': gyro_y,
        'gyro_z': gyro_z,
        'heart_rate': np.clip(heart_rate, 50, 180).round(1),
        'fall_event': fall_event
    })
    
    df.to_csv(OUTPUT_PATH, index=False)
    print(f"Dataset generated with {len(df)} samples ({df['fall_event'].sum()} anomaly steps) at: {OUTPUT_PATH}")

if __name__ == "__main__":
    generate_benchmark_data()
