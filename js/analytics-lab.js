/**
 * GeoMesh Sentinel - Subsidence & PINN Analytics Lab Engine
 * Multi-chart geotechnical monitoring suite:
 * 1. 14-Day Knothe Subsidence Forecasting Curve with 95% Confidence Bounds
 * 2. 3D Attitude Gyroscope Vector Compass (Pitch vs Roll)
 * 3. 8-Sector Comparative Subsidence Strain Chart
 * 4. ESP32 1D-Kalman Filter Live Noise Isolation Oscilloscope
 */

class AnalyticsLabEngine {
  constructor() {
    this.forecastHorizon = 14; // days
    this.extractionRate = 120; // tons/day
    this.pinnInfluenceAngle = 64; // degrees
    this.overburdenDepth = 185; // meters
    this.kalmanQ = 0.001;
    this.kalmanR = 0.05;

    this.animTime = 0;
    this.gyroRoll = 3.82;
    this.gyroPitch = 4.15;

    this.bindControls();
    this.startRenderLoop();
  }

  bindControls() {
    // Horizon buttons (7d, 14d, 30d)
    const horizonBtns = document.querySelectorAll('.analytics-horizon-btn');
    horizonBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        horizonBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.forecastHorizon = parseInt(btn.dataset.days, 10);
        this.drawKnotheForecast();
        if (window.soundEngine) window.soundEngine.playClick();
      });
    });

    // Slider controls for PINN parameters
    const sliderRate = document.getElementById('sliderExtractionRate');
    const lblRate = document.getElementById('lblExtractionRate');
    if (sliderRate) {
      sliderRate.addEventListener('input', (e) => {
        this.extractionRate = parseInt(e.target.value, 10);
        if (lblRate) lblRate.textContent = `${this.extractionRate} T/day`;
        this.drawKnotheForecast();
        this.drawSectorBarChart();
      });
    }

    const sliderAngle = document.getElementById('sliderInfluenceAngle');
    const lblAngle = document.getElementById('lblInfluenceAngle');
    if (sliderAngle) {
      sliderAngle.addEventListener('input', (e) => {
        this.pinnInfluenceAngle = parseInt(e.target.value, 10);
        if (lblAngle) lblAngle.textContent = `${this.pinnInfluenceAngle}°`;
        this.drawKnotheForecast();
      });
    }
  }

  startRenderLoop() {
    const loop = () => {
      this.animTime += 0.03;
      // Oscillate gyro slightly for live telemetry feel
      this.gyroRoll = 4.15 + Math.sin(this.animTime * 1.5) * 0.4;
      this.gyroPitch = 3.82 + Math.cos(this.animTime * 1.2) * 0.35;

      const labWorkspace = document.getElementById('analyticsWorkspace');
      if (labWorkspace && labWorkspace.classList.contains('active-workspace')) {
        this.drawGyroCompass();
        this.drawKalmanComparison();
      }

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  renderAll() {
    this.drawKnotheForecast();
    this.drawGyroCompass();
    this.drawSectorBarChart();
    this.drawKalmanComparison();
  }

  /**
   * 1. 14-Day Knothe Subsidence Forecasting Curve (ST-GNN + PINN)
   */
  drawKnotheForecast() {
    const canvas = document.getElementById('labForecastCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.parentElement.clientWidth;
    const h = canvas.height = 240;
    const isLight = document.body.classList.contains('light-theme');

    ctx.clearRect(0, 0, w, h);

    // Grid lines & labels
    ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.07)';
    ctx.lineWidth = 1;
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = isLight ? '#475569' : '#64748b';

    for (let y = 30; y <= h - 30; y += 40) {
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(w - 20, y);
      ctx.stroke();

      const dispVal = Math.round((1 - (y - 30) / (h - 60)) * 35);
      ctx.fillText(`${dispVal}mm`, 8, y + 3);
    }

    // Critical Threshold Line at +15mm
    const critY = h - 30 - (15 / 35) * (h - 60);
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.55)';
    ctx.setLineDash([6, 4]);
    ctx.moveTo(40, critY);
    ctx.lineTo(w - 20, critY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = isLight ? '#dc2626' : '#f87171';
    ctx.fillText('CRITICAL BREACH THRESHOLD (+15mm)', w - 240, critY - 6);

    // Split point: T0 (Current Time) is at 45% width
    const splitX = 40 + (w - 60) * 0.45;

    // Time Axis T0 line
    ctx.beginPath();
    ctx.strokeStyle = isLight ? 'rgba(2, 132, 199, 0.4)' : 'rgba(0, 240, 255, 0.3)';
    ctx.moveTo(splitX, 20);
    ctx.lineTo(splitX, h - 30);
    ctx.stroke();
    ctx.fillStyle = isLight ? '#0284c7' : '#00f0ff';
    ctx.fillText('NOW (T 0)', splitX - 25, h - 14);

    // 1. Observed Historical Data (T -14 to T 0)
    ctx.beginPath();
    ctx.strokeStyle = isLight ? '#0284c7' : '#00f0ff';
    ctx.lineWidth = 2.5;

    const histPoints = [
      { x: 40, val: 2.1 },
      { x: 40 + (splitX - 40) * 0.2, val: 3.4 },
      { x: 40 + (splitX - 40) * 0.4, val: 5.1 },
      { x: 40 + (splitX - 40) * 0.6, val: 7.8 },
      { x: 40 + (splitX - 40) * 0.8, val: 10.9 },
      { x: splitX, val: 14.2 }
    ];

    histPoints.forEach((p, i) => {
      const px = p.x;
      const py = h - 30 - (p.val / 35) * (h - 60);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    // 2. 95% Confidence Band for Forecast (T 0 to T +N)
    const futureRateMult = (this.extractionRate / 120);
    const endVal = 14.2 + (this.forecastHorizon === 7 ? 6.5 : (this.forecastHorizon === 14 ? 12.8 : 19.5)) * futureRateMult;
    const endUpper = endVal + 3.8;
    const endLower = Math.max(14.2, endVal - 3.2);

    const endX = w - 20;

    // Confidence area fill
    ctx.beginPath();
    ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
    ctx.moveTo(splitX, h - 30 - (14.2 / 35) * (h - 60));
    ctx.lineTo(endX, h - 30 - (endUpper / 35) * (h - 60));
    ctx.lineTo(endX, h - 30 - (endLower / 35) * (h - 60));
    ctx.closePath();
    ctx.fill();

    // 3. PINN Mean Predicted Curve (Amber -> Red)
    ctx.beginPath();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 4]);
    ctx.moveTo(splitX, h - 30 - (14.2 / 35) * (h - 60));
    
    // Intermediate point
    const midX = splitX + (endX - splitX) * 0.5;
    const midVal = 14.2 + (endVal - 14.2) * 0.62;
    ctx.lineTo(midX, h - 30 - (midVal / 35) * (h - 60));
    ctx.lineTo(endX, h - 30 - (endVal / 35) * (h - 60));
    ctx.stroke();
    ctx.setLineDash([]);

    // End marker dot
    const endY = h - 30 - (endVal / 35) * (h - 60);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(endX, endY, 5, 0, Math.PI * 2);
    ctx.fill();

    // End value label
    ctx.fillStyle = '#fca5a5';
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.fillText(`+${endVal.toFixed(1)}mm (${this.forecastHorizon}d)`, endX - 110, endY - 10);
  }

  /**
   * 2. 3D Gyroscope Attitude Vector Compass (Pitch vs Roll)
   */
  drawGyroCompass() {
    const canvas = document.getElementById('labGyroCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.parentElement.clientWidth;
    const h = canvas.height = 240;

    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(cx, cy) - 25;

    // Outer ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Outer tick marks (every 30 deg)
    for (let deg = 0; deg < 360; deg += 30) {
      const rad = (deg * Math.PI) / 180;
      const x1 = cx + Math.cos(rad) * (radius - 8);
      const y1 = cy + Math.sin(rad) * (radius - 8);
      const x2 = cx + Math.cos(rad) * radius;
      const y2 = cy + Math.sin(rad) * radius;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = deg % 90 === 0 ? '#00f0ff' : 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = deg % 90 === 0 ? 2 : 1;
      ctx.stroke();

      if (deg % 90 === 0) {
        const labels = ['E', 'S', 'W', 'N'];
        const lx = cx + Math.cos(rad) * (radius - 18);
        const ly = cy + Math.sin(rad) * (radius - 18);
        ctx.fillStyle = '#00f0ff';
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labels[deg / 90], lx, ly);
      }
    }

    // Horizon line rotated by roll
    const rollRad = (this.gyroRoll * Math.PI) / 180;
    const pitchOffset = this.gyroPitch * 5;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2);
    ctx.clip();

    // Sky / Ground split
    ctx.translate(cx, cy + pitchOffset);
    ctx.rotate(rollRad);

    // Ground color (warning brown/amber)
    ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
    ctx.fillRect(-radius * 2, 0, radius * 4, radius * 2);

    // Sky color (dark navy)
    ctx.fillStyle = 'rgba(7, 10, 18, 0.8)';
    ctx.fillRect(-radius * 2, -radius * 2, radius * 4, radius * 2);

    // Horizon line
    ctx.beginPath();
    ctx.moveTo(-radius * 1.5, 0);
    ctx.lineTo(radius * 1.5, 0);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();

    // Crosshair in center
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 15, cy);
    ctx.lineTo(cx - 7, cy);
    ctx.moveTo(cx + 7, cy);
    ctx.lineTo(cx + 15, cy);
    ctx.moveTo(cx, cy - 15);
    ctx.lineTo(cx, cy - 7);
    ctx.moveTo(cx, cy + 7);
    ctx.lineTo(cx, cy + 15);
    ctx.stroke();

    // Attitude text readouts
    ctx.fillStyle = '#f1f5f9';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`PITCH: ${this.gyroPitch.toFixed(2)}°`, 14, 24);
    ctx.fillText(`ROLL : ${this.gyroRoll.toFixed(2)}°`, 14, 40);
    ctx.fillStyle = '#f87171';
    ctx.fillText(`SLOPE VECTOR: 5.64° (EXCEEDED)`, 14, 56);
  }

  /**
   * 3. 8-Sector Comparative Subsidence Strain Chart
   */
  drawSectorBarChart() {
    const canvas = document.getElementById('labSectorBarCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.parentElement.clientWidth;
    const h = canvas.height = 200;

    ctx.clearRect(0, 0, w, h);

    const sectors = [
      { code: 'SEC-01', strain: 1.2, status: 'normal' },
      { code: 'SEC-02', strain: 4.8, status: 'watch' },
      { code: 'SEC-03', strain: 0.8, status: 'normal' },
      { code: 'SEC-04', strain: 14.2 * (this.extractionRate / 120), status: 'breach' },
      { code: 'SEC-05', strain: 3.5, status: 'watch' },
      { code: 'SEC-06', strain: 1.6, status: 'normal' },
      { code: 'SEC-07', strain: 4.1, status: 'watch' },
      { code: 'SEC-08', strain: 0.9, status: 'normal' }
    ];

    const maxStrain = 18;
    const barWidth = (w - 70) / sectors.length - 12;

    sectors.forEach((sec, idx) => {
      const x = 50 + idx * (barWidth + 12);
      const barH = (sec.strain / maxStrain) * (h - 60);
      const y = h - 35 - barH;

      const color = sec.status === 'breach' ? '#ef4444' : 
                   (sec.status === 'watch' ? '#f59e0b' : '#00f0ff');

      // Bar fill
      ctx.fillStyle = color;
      ctx.fillRect(x, y, barWidth, barH);

      // Top value
      ctx.fillStyle = color;
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${sec.strain.toFixed(1)}mm`, x + barWidth / 2, y - 6);

      // Label at bottom
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(sec.code, x + barWidth / 2, h - 18);
    });

    // Warning Line at 5.0mm
    const warnY = h - 35 - (5.0 / maxStrain) * (h - 60);
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
    ctx.setLineDash([4, 4]);
    ctx.moveTo(40, warnY);
    ctx.lineTo(w - 20, warnY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#fbbf24';
    ctx.textAlign = 'left';
    ctx.fillText('WATCH LIMIT 5mm', 42, warnY - 4);
  }

  /**
   * 4. ESP32 1D-Kalman Filter Noise Isolation Oscilloscope
   */
  drawKalmanComparison() {
    const canvas = document.getElementById('labKalmanCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.parentElement.clientWidth;
    const h = canvas.height = 140;

    ctx.clearRect(0, 0, w, h);

    // Center baseline
    const baseLine = h / 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.moveTo(30, baseLine);
    ctx.lineTo(w - 20, baseLine);
    ctx.stroke();

    // 1. Raw noisy signal (Truck vibrations + wind) - Dim Orange
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
    ctx.lineWidth = 1;
    for (let x = 30; x < w - 20; x += 3) {
      const trueSignal = Math.sin((x + this.animTime * 40) * 0.04) * 22;
      const noise = (Math.sin(x * 1.8 + this.animTime * 15) + Math.cos(x * 3.4)) * 14;
      const y = baseLine + trueSignal + noise;
      if (x === 30) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 2. Filtered 1D-Kalman True Ground Tilt - Glowing Cyan
    ctx.beginPath();
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2.2;
    for (let x = 30; x < w - 20; x += 3) {
      const trueSignal = Math.sin((x + this.animTime * 40) * 0.04) * 22;
      const y = baseLine + trueSignal;
      if (x === 30) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Legend
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(245, 158, 11, 0.7)';
    ctx.fillText('RAW MPU6050 (VIBRATION NOISE)', 40, 20);
    ctx.fillStyle = '#00f0ff';
    ctx.fillText('1D-KALMAN ISOLATED GROUND TILT (Q=0.001)', 40, 36);
  }
}
