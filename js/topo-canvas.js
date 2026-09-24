/**
 * GeoMesh Sentinel - Topographical Map & Hexagonal Grid Canvas Engine
 * Renders 60FPS tactical topography, hex geomesh overlay, LoRa multi-hop paths,
 * photon data pulses, and color-coded sentinel nodes.
 */

class TopoMapEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.nodes = window.GEOMESH_NODES || [];
    
    // Viewport transform
    this.scale = 1.0;
    this.minScale = 0.6;
    this.maxScale = 3.5;
    this.panX = 0;
    this.panY = 0;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;

    // Layer toggles
    this.showHexMesh = true;
    this.showContours = true;
    this.showLoRaLinks = true;
    this.showRiskHeatmap = true;
    this.showParticles = true;

    // Interactive selection
    this.hoveredNode = null;
    this.selectedNode = null;
    this.mouseWorld = { x: 0, y: 0 };

    // Animation states
    this.animTime = 0;
    this.dataPackets = [];
    this.initDataPackets();

    this.initCanvasSize();
    this.bindEvents();
    this.startRenderLoop();
  }

  initCanvasSize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;

    this.canvas.width = Math.floor(this.width * dpr);
    this.canvas.height = Math.floor(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Center map initially
    if (this.panX === 0 && this.panY === 0) {
      this.panX = 0;
      this.panY = 0;
    }
  }

  initDataPackets() {
    // Packets moving along links
    this.dataPackets = [];
    for (let i = 0; i < 28; i++) {
      const sourceNode = this.nodes[Math.floor(Math.random() * this.nodes.length)];
      if (sourceNode && sourceNode.parent && sourceNode.status !== 'offline') {
        const parentNode = this.nodes.find(n => n.id === sourceNode.parent) || this.nodes[0];
        this.dataPackets.push({
          source: sourceNode,
          target: parentNode,
          progress: Math.random(),
          speed: 0.005 + Math.random() * 0.009,
          color: sourceNode.status === 'alert' ? '#ef4444' : (sourceNode.status === 'warning' ? '#f59e0b' : '#00f0ff')
        });
      }
    }
  }

  bindEvents() {
    window.addEventListener('resize', () => this.initCanvasSize());

    // Mouse drag for pan
    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.dragStartX = e.clientX - this.panX;
      this.dragStartY = e.clientY - this.panY;
    });

    window.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      if (this.isDragging) {
        this.panX = e.clientX - this.dragStartX;
        this.panY = e.clientY - this.dragStartY;
      }

      // Convert screen coords to world map space
      const worldX = (mouseX - (this.width / 2 + this.panX)) / (this.scale * this.width) + 0.5;
      const worldY = (mouseY - (this.height / 2 + this.panY)) / (this.scale * this.height) + 0.5;
      this.mouseWorld = { x: worldX, y: worldY };

      // Update cursor coordinate HUD readout
      const coordEl = document.getElementById('mapCoordReadout');
      if (coordEl) {
        const lat = (23.7842 + (0.5 - worldY) * 0.08).toFixed(4);
        const lon = (86.4189 + (worldX - 0.5) * 0.08).toFixed(4);
        coordEl.textContent = `LAT ${lat}° N // LON ${lon}° E // ELEV ~${Math.round(180 + (1 - worldY) * 160)}m`;
      }

      // Hit-test nodes
      this.checkNodeHover(mouseX, mouseY);
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // Zoom on wheel
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      this.zoom(zoomFactor, e.clientX, e.clientY);
    }, { passive: false });

    // Click to select node
    this.canvas.addEventListener('click', (e) => {
      if (this.hoveredNode) {
        this.selectNode(this.hoveredNode);
      }
    });

    // HUD buttons
    const btnZoomIn = document.getElementById('btnZoomIn');
    const btnZoomOut = document.getElementById('btnZoomOut');
    const btnResetView = document.getElementById('btnResetView');
    const btnToggleHex = document.getElementById('btnToggleHex');
    const btnToggleContours = document.getElementById('btnToggleContours');
    const btnToggleLinks = document.getElementById('btnToggleLinks');
    const btnToggleHeatmap = document.getElementById('btnToggleHeatmap');

    if (btnZoomIn) btnZoomIn.addEventListener('click', () => this.zoom(1.2));
    if (btnZoomOut) btnZoomOut.addEventListener('click', () => this.zoom(0.8));
    if (btnResetView) btnResetView.addEventListener('click', () => this.resetView());

    if (btnToggleHex) {
      btnToggleHex.addEventListener('click', () => {
        this.showHexMesh = !this.showHexMesh;
        btnToggleHex.classList.toggle('active', this.showHexMesh);
        if (window.soundEngine) window.soundEngine.playClick();
      });
    }

    if (btnToggleContours) {
      btnToggleContours.addEventListener('click', () => {
        this.showContours = !this.showContours;
        btnToggleContours.classList.toggle('active', this.showContours);
        if (window.soundEngine) window.soundEngine.playClick();
      });
    }

    if (btnToggleLinks) {
      btnToggleLinks.addEventListener('click', () => {
        this.showLoRaLinks = !this.showLoRaLinks;
        btnToggleLinks.classList.toggle('active', this.showLoRaLinks);
        if (window.soundEngine) window.soundEngine.playClick();
      });
    }

    if (btnToggleHeatmap) {
      btnToggleHeatmap.addEventListener('click', () => {
        this.showRiskHeatmap = !this.showRiskHeatmap;
        btnToggleHeatmap.classList.toggle('active', this.showRiskHeatmap);
        if (window.soundEngine) window.soundEngine.playClick();
      });
    }
  }

  zoom(factor, clientX, clientY) {
    const oldScale = this.scale;
    const newScale = Math.min(this.maxScale, Math.max(this.minScale, this.scale * factor));
    if (newScale === oldScale) return;

    if (clientX !== undefined && clientY !== undefined) {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = clientX - rect.left;
      const mouseY = clientY - rect.top;
      this.panX = mouseX - (mouseX - this.panX) * (newScale / oldScale);
      this.panY = mouseY - (mouseY - this.panY) * (newScale / oldScale);
    }

    this.scale = newScale;
    if (window.soundEngine) window.soundEngine.playClick();
  }

  resetView() {
    this.scale = 1.0;
    this.panX = 0;
    this.panY = 0;
    if (window.soundEngine) window.soundEngine.playClick();
  }

  checkNodeHover(mouseX, mouseY) {
    let closest = null;
    let minDistance = 14; // pixels hit radius

    for (const node of this.nodes) {
      const screenPos = this.worldToScreen(node.x, node.y);
      const dist = Math.hypot(screenPos.x - mouseX, screenPos.y - mouseY);
      if (dist < minDistance) {
        minDistance = dist;
        closest = node;
      }
    }

    if (this.hoveredNode !== closest) {
      this.hoveredNode = closest;
      this.canvas.style.cursor = closest ? 'pointer' : (this.isDragging ? 'grabbing' : 'grab');
      if (closest && window.soundEngine) {
        window.soundEngine.playClick();
      }
    }
  }

  worldToScreen(wx, wy) {
    return {
      x: (wx - 0.5) * (this.width * this.scale) + (this.width / 2 + this.panX),
      y: (wy - 0.5) * (this.height * this.scale) + (this.height / 2 + this.panY)
    };
  }

  screenToWorld(sx, sy) {
    return {
      x: (sx - (this.width / 2 + this.panX)) / (this.width * this.scale) + 0.5,
      y: (sy - (this.height / 2 + this.panY)) / (this.height * this.scale) + 0.5
    };
  }

  selectNode(node) {
    this.selectedNode = node;
    if (window.soundEngine) {
      if (node.status === 'alert') {
        window.soundEngine.playAlertStrobe();
      } else if (node.status === 'warning') {
        window.soundEngine.playWarning();
      } else {
        window.soundEngine.playPing();
      }
    }

    // Show floating Inspector HUD
    this.updateInspectorHUD(node);

    // Notify telemetry list
    if (window.telemetryManager) {
      window.telemetryManager.highlightNodeInList(node.id);
    }
  }

  focusNodeById(nodeId) {
    const node = this.nodes.find(n => n.id.toLowerCase() === nodeId.toLowerCase() || n.code.toLowerCase() === nodeId.toLowerCase());
    if (node) {
      // Pan camera to node
      const targetPanX = -(node.x - 0.5) * (this.width * this.scale);
      const targetPanY = -(node.y - 0.5) * (this.height * this.scale);
      
      // Animate pan smoothly
      this.panX = targetPanX;
      this.panY = targetPanY;
      this.selectNode(node);
      return true;
    }
    return false;
  }

  focusOnNode(nodeId) {
    return this.focusNodeById(nodeId);
  }

  updateInspectorHUD(node) {
    const hud = document.getElementById('nodeInspectorHud');
    if (!hud) return;

    hud.classList.add('active');
    document.getElementById('hudNodeId').textContent = node.id;
    document.getElementById('hudSector').textContent = `${node.sectorCode} - ${node.sector}`;
    
    // Status tag
    const statusTag = document.getElementById('hudStatusTag');
    statusTag.textContent = node.statusLabel;
    statusTag.className = `status-tag tag-${node.status === 'alert' ? 'alert' : (node.status === 'warning' ? 'warning' : (node.status === 'offline' ? 'offline' : 'healthy'))}`;

    document.getElementById('hudSignal').textContent = `${node.signalDbm} dBm (${node.signalBars}/4 bars)`;
    document.getElementById('hudBattery').textContent = `${node.battery}% (${node.batteryVoltage}V)`;
    document.getElementById('hudTilt').textContent = `Pitch: ${node.pitch}° | Roll: ${node.roll}°`;
    document.getElementById('hudCrack').textContent = `${node.crackDisp} mm (Potentiometer)`;
    document.getElementById('hudTempHum').textContent = `${node.temp}°C / ${node.humidity}% RH`;
    document.getElementById('hudHops').textContent = `${node.hops} Hop${node.hops !== 1 ? 's' : ''} (Parent: ${node.parent || 'None'})`;
    document.getElementById('hudPinnRisk').textContent = `${(node.pinnRisk * 100).toFixed(1)}% (Knothe ST-GNN)`;

    // Tilt gauge fill
    const gauge = document.getElementById('hudTiltGauge');
    if (gauge) {
      const fillPct = Math.min(100, Math.max(5, (Math.abs(node.pitch) + Math.abs(node.roll)) * 12));
      gauge.style.width = `${fillPct}%`;
      gauge.style.backgroundColor = node.status === 'alert' ? '#ef4444' : (node.status === 'warning' ? '#f59e0b' : '#00f0ff');
    }

    this.renderHudMiniOscilloscope(node);
  }

  renderHudMiniOscilloscope(node) {
    const canvas = document.getElementById('hudOscilloscopeCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.parentElement ? canvas.parentElement.clientWidth : 240;
    const h = canvas.height = 50;
    const isLight = document.body.classList.contains('light-theme');

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = isLight ? '#f8fafc' : 'rgba(7, 10, 18, 0.9)';
    ctx.fillRect(0, 0, w, h);

    // Center grid line
    ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    // Ground vibration waveform
    ctx.strokeStyle = node.status === 'alert' ? '#dc2626' : (node.status === 'warning' ? '#d97706' : (isLight ? '#0284c7' : '#00f0ff'));
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    const amp = node.status === 'alert' ? 18 : (node.status === 'warning' ? 10 : 5);
    const freq = node.status === 'alert' ? 0.2 : 0.08;

    for (let x = 0; x < w; x += 3) {
      const y = h / 2 + Math.sin(x * freq + this.animTime * 8) * amp + (Math.random() * 2 - 1);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Oscilloscope label
    ctx.fillStyle = isLight ? '#64748b' : '#94a3b8';
    ctx.font = '8.5px "JetBrains Mono", monospace';
    ctx.fillText('LIVE MPU6050 VIBRATION', 6, 12);
  }

  startRenderLoop() {
    const render = (time) => {
      this.animTime = time * 0.001;
      this.draw();
      if (this.selectedNode) {
        this.renderHudMiniOscilloscope(this.selectedNode);
      }
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
  }

  draw() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    const isLight = document.body.classList.contains('light-theme');

    // Base background
    this.ctx.fillStyle = isLight ? '#eef4fa' : '#060911';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Save context for transform
    this.ctx.save();
    this.ctx.translate(this.width / 2 + this.panX, this.height / 2 + this.panY);
    this.ctx.scale(this.scale, this.scale);

    // 1. Draw Topographic Contours
    if (this.showContours) {
      this.drawTopography();
    }

    // 2. Draw Subsidence Risk Heatmap Overlay (Knothe PINN hazard zones)
    if (this.showRiskHeatmap) {
      this.drawRiskHeatmap();
    }

    // 3. Draw Hexagonal Grid (The "GeoMesh")
    if (this.showHexMesh) {
      this.drawHexGrid();
    }

    // 4. Draw LoRa Multi-Hop Communication Links
    if (this.showLoRaLinks) {
      this.drawLoRaLinks();
    }

    // 5. Draw Animated Data Photon Packets
    if (this.showParticles && this.showLoRaLinks) {
      this.drawDataPackets();
    }

    // 5b. Revolving Radar Sweep across mine sectors
    this.drawRadarSweep();

    // 6. Draw Sentinel Nodes
    this.drawNodes();

    // 7. Draw Selection Reticle / Crosshair if a node is selected
    if (this.selectedNode) {
      this.drawSelectedReticle(this.selectedNode);
    }

    this.ctx.restore();

    // Draw UI HUD overlays in screen coordinates
    this.drawScreenHUD();
  }

  drawRadarSweep() {
    const w = this.width;
    const h = this.height;
    const maxR = Math.hypot(w * 0.48, h * 0.48);
    const sweepAngle = (this.animTime * 0.85) % (Math.PI * 2);
    const isLight = document.body.classList.contains('light-theme');

    this.ctx.save();
    // Phosphor sweep trail
    const trailSlices = 14;
    for (let i = 0; i < trailSlices; i++) {
      const a1 = sweepAngle - (i / trailSlices) * 0.38;
      const a2 = sweepAngle - ((i + 1) / trailSlices) * 0.38;
      const alpha = (1 - i / trailSlices) * (isLight ? 0.05 : 0.07);

      this.ctx.beginPath();
      this.ctx.moveTo(0, 0);
      this.ctx.arc(0, 0, maxR, a1, a2, true);
      this.ctx.closePath();
      this.ctx.fillStyle = isLight ? `rgba(2, 132, 199, ${alpha})` : `rgba(0, 240, 255, ${alpha})`;
      this.ctx.fill();
    }

    // Leading sweep ray
    this.ctx.beginPath();
    this.ctx.moveTo(0, 0);
    this.ctx.lineTo(Math.cos(sweepAngle) * maxR, Math.sin(sweepAngle) * maxR);
    this.ctx.strokeStyle = isLight ? 'rgba(2, 132, 199, 0.4)' : 'rgba(0, 240, 255, 0.45)';
    this.ctx.lineWidth = 1.2;
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawTopography() {
    const w = this.width;
    const h = this.height;
    const isLight = document.body.classList.contains('light-theme');

    // Draw mine pit / basin contour elevation rings centered around (0, 0)
    this.ctx.lineWidth = 1.0;
    const contourLevels = 10;
    
    for (let i = 1; i <= contourLevels; i++) {
      const radiusX = (i / contourLevels) * (w * 0.52);
      const radiusY = (i / contourLevels) * (h * 0.46);
      const isIndexBench = i % 3 === 0;

      this.ctx.beginPath();
      this.ctx.strokeStyle = isIndexBench ? 
        (isLight ? 'rgba(2, 132, 199, 0.35)' : 'rgba(0, 240, 255, 0.25)') : 
        (isLight ? 'rgba(148, 163, 184, 0.28)' : 'rgba(56, 189, 248, 0.10)');
      this.ctx.lineWidth = isIndexBench ? 1.4 : 0.8;
      
      // Elliptical contour with geological wobble
      const steps = 60;
      for (let s = 0; s <= steps; s++) {
        const angle = (s / steps) * Math.PI * 2;
        const wobble = Math.sin(angle * 4 + i) * 14 + Math.cos(angle * 2) * 8;
        const x = Math.cos(angle) * (radiusX + wobble);
        const y = Math.sin(angle) * (radiusY + wobble);
        if (s === 0) this.ctx.moveTo(x, y);
        else this.ctx.lineTo(x, y);
      }
      this.ctx.closePath();
      this.ctx.stroke();

      // Elevation labels on index contours
      if (isIndexBench) {
        this.ctx.fillStyle = isLight ? 'rgba(2, 132, 199, 0.75)' : 'rgba(56, 189, 248, 0.45)';
        this.ctx.font = '9px "JetBrains Mono", monospace';
        const labelX = radiusX - 20;
        const labelY = -10;
        this.ctx.fillText(`+${100 + i * 35}M`, labelX, labelY);
      }
    }

    // Draw Geological Fault / Shear Fissure line through Sector 4
    this.ctx.beginPath();
    this.ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
    this.ctx.lineWidth = 1.8;
    this.ctx.setLineDash([6, 4]);
    this.ctx.moveTo(-w * 0.22, h * 0.08);
    this.ctx.lineTo(-w * 0.08, h * 0.26);
    this.ctx.lineTo(w * 0.15, h * 0.38);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    this.ctx.fillStyle = 'rgba(239, 68, 68, 0.6)';
    this.ctx.font = '10px "JetBrains Mono", monospace';
    this.ctx.fillText('FAULT LINE: CENTRAL SUBSIDENCE FISSURE', -w * 0.18, h * 0.18);
  }

  drawRiskHeatmap() {
    const w = this.width;
    const h = this.height;

    // Subsidence risk zone in Sector 4 (fissure zone)
    const sec4X = (0.42 - 0.5) * w;
    const sec4Y = (0.68 - 0.5) * h;

    const radGrad = this.ctx.createRadialGradient(sec4X, sec4Y, 15, sec4X, sec4Y, 130);
    radGrad.addColorStop(0, 'rgba(239, 68, 68, 0.32)');
    radGrad.addColorStop(0.5, 'rgba(245, 158, 11, 0.18)');
    radGrad.addColorStop(1, 'rgba(245, 158, 11, 0.0)');

    this.ctx.fillStyle = radGrad;
    this.ctx.beginPath();
    this.ctx.arc(sec4X, sec4Y, 130, 0, Math.PI * 2);
    this.ctx.fill();

    // Secondary watch zone in Sector 2
    const sec2X = (0.72 - 0.5) * w;
    const sec2Y = (0.28 - 0.5) * h;
    const radGrad2 = this.ctx.createRadialGradient(sec2X, sec2Y, 10, sec2X, sec2Y, 80);
    radGrad2.addColorStop(0, 'rgba(245, 158, 11, 0.25)');
    radGrad2.addColorStop(1, 'rgba(245, 158, 11, 0.0)');
    this.ctx.fillStyle = radGrad2;
    this.ctx.beginPath();
    this.ctx.arc(sec2X, sec2Y, 80, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawHexGrid() {
    const w = this.width;
    const h = this.height;
    const hexRadius = 42;
    const hexWidth = hexRadius * Math.sqrt(3);
    const hexHeight = hexRadius * 2;
    const vertSpacing = hexHeight * 0.75;

    this.ctx.save();
    this.ctx.lineWidth = 0.6;
    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.10)';

    const minX = -w * 0.6;
    const maxX = w * 0.6;
    const minY = -h * 0.6;
    const maxY = h * 0.6;

    let row = 0;
    for (let y = minY; y < maxY; y += vertSpacing) {
      const xOffset = (row % 2) * (hexWidth / 2);
      let col = 0;
      for (let x = minX + xOffset; x < maxX; x += hexWidth) {
        this.drawSingleHexagon(x, y, hexRadius);
        col++;
      }
      row++;
    }
    this.ctx.restore();
  }

  drawSingleHexagon(cx, cy, r) {
    this.ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i + (Math.PI / 6);
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    }
    this.ctx.closePath();
    this.ctx.stroke();
  }

  drawLoRaLinks() {
    const w = this.width;
    const h = this.height;

    this.ctx.save();
    this.ctx.lineWidth = 0.8;

    for (const node of this.nodes) {
      if (!node.parent || node.status === 'offline') continue;

      const parentNode = this.nodes.find(n => n.id === node.parent) || this.nodes[0];
      const x1 = (node.x - 0.5) * w;
      const y1 = (node.y - 0.5) * h;
      const x2 = (parentNode.x - 0.5) * w;
      const y2 = (parentNode.y - 0.5) * h;

      this.ctx.beginPath();
      if (node.status === 'alert') {
        this.ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
        this.ctx.setLineDash([4, 4]);
      } else if (node.status === 'warning') {
        this.ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
        this.ctx.setLineDash([]);
      } else {
        this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.16)';
        this.ctx.setLineDash([]);
      }
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  drawDataPackets() {
    const w = this.width;
    const h = this.height;

    for (const packet of this.dataPackets) {
      packet.progress += packet.speed;
      if (packet.progress >= 1.0) {
        packet.progress = 0;
      }

      const x1 = (packet.source.x - 0.5) * w;
      const y1 = (packet.source.y - 0.5) * h;
      const x2 = (packet.target.x - 0.5) * w;
      const y2 = (packet.target.y - 0.5) * h;

      const currX = x1 + (x2 - x1) * packet.progress;
      const currY = y1 + (y2 - y1) * packet.progress;

      this.ctx.beginPath();
      this.ctx.arc(currX, currY, 2.0, 0, Math.PI * 2);
      this.ctx.fillStyle = packet.color;
      this.ctx.shadowColor = packet.color;
      this.ctx.shadowBlur = 6;
      this.ctx.fill();
      this.ctx.shadowBlur = 0;
    }
  }

  drawNodes() {
    const w = this.width;
    const h = this.height;
    const pulsePhase = Math.sin(this.animTime * 3.5);

    for (const node of this.nodes) {
      const nx = (node.x - 0.5) * w;
      const ny = (node.y - 0.5) * h;

      // Master Gateway
      if (node.isGateway) {
        this.drawGatewayNode(nx, ny);
        continue;
      }

      // Color selection
      let fillColor = '#10b981'; // Healthy Green
      let glowColor = 'rgba(16, 185, 129, 0.6)';
      let nodeRadius = 3.5;

      if (node.status === 'warning') {
        fillColor = '#f59e0b'; // Amber
        glowColor = 'rgba(245, 158, 11, 0.7)';
        nodeRadius = 4.2;
      } else if (node.status === 'alert') {
        fillColor = '#ef4444'; // Red
        glowColor = 'rgba(239, 68, 68, 0.85)';
        nodeRadius = 5.2;
      } else if (node.status === 'offline') {
        fillColor = '#475569';
        glowColor = 'transparent';
        nodeRadius = 2.8;
      }

      // Draw pulsating ring for alert/warning nodes
      if (node.status === 'alert') {
        const ringRad = 8 + pulsePhase * 5;
        this.ctx.beginPath();
        this.ctx.arc(nx, ny, ringRad, 0, Math.PI * 2);
        this.ctx.strokeStyle = 'rgba(239, 68, 68, 0.75)';
        this.ctx.lineWidth = 1.4;
        this.ctx.stroke();
      } else if (node.status === 'warning') {
        const ringRad = 7 + pulsePhase * 3;
        this.ctx.beginPath();
        this.ctx.arc(nx, ny, ringRad, 0, Math.PI * 2);
        this.ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
        this.ctx.lineWidth = 1.0;
        this.ctx.stroke();
      }

      // Node Body
      this.ctx.beginPath();
      this.ctx.arc(nx, ny, nodeRadius, 0, Math.PI * 2);
      this.ctx.fillStyle = fillColor;
      this.ctx.shadowColor = glowColor;
      this.ctx.shadowBlur = node.status !== 'offline' ? 8 : 0;
      this.ctx.fill();
      this.ctx.shadowBlur = 0;

      // Hover glow ring
      if (this.hoveredNode === node) {
        this.ctx.beginPath();
        this.ctx.arc(nx, ny, nodeRadius + 6, 0, Math.PI * 2);
        this.ctx.strokeStyle = '#00f0ff';
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();

        // Hover tooltip label
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '10px "JetBrains Mono", monospace';
        this.ctx.fillText(`${node.id} [${node.statusLabel}]`, nx + 9, ny - 6);
      }
    }
  }

  drawGatewayNode(x, y) {
    const pulse = (Math.sin(this.animTime * 2.5) + 1) * 0.5;

    // Expanding beacon waves
    this.ctx.beginPath();
    this.ctx.arc(x, y, 14 + pulse * 12, 0, Math.PI * 2);
    this.ctx.strokeStyle = `rgba(0, 240, 255, ${0.6 - pulse * 0.5})`;
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();

    // Gateway Diamond Base
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(this.animTime * 0.4);

    this.ctx.beginPath();
    this.ctx.rect(-7, -7, 14, 14);
    this.ctx.fillStyle = 'rgba(0, 240, 255, 0.25)';
    this.ctx.strokeStyle = '#00f0ff';
    this.ctx.lineWidth = 1.8;
    this.ctx.shadowColor = '#00f0ff';
    this.ctx.shadowBlur = 12;
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.restore();

    // Center Core
    this.ctx.beginPath();
    this.ctx.arc(x, y, 4, 0, Math.PI * 2);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fill();

    this.ctx.fillStyle = '#00f0ff';
    this.ctx.font = 'bold 9px "JetBrains Mono", monospace';
    this.ctx.fillText('MASTER GW', x - 26, y - 14);
  }

  drawSelectedReticle(node) {
    const w = this.width;
    const h = this.height;
    const nx = (node.x - 0.5) * w;
    const ny = (node.y - 0.5) * h;

    this.ctx.save();
    this.ctx.translate(nx, ny);

    // Tactical HUD crosshairs
    this.ctx.strokeStyle = '#00f0ff';
    this.ctx.lineWidth = 1.2;
    this.ctx.shadowColor = '#00f0ff';
    this.ctx.shadowBlur = 8;

    const r = 16;
    const arm = 6;

    // 4 Corner Brackets
    // Top-Left
    this.ctx.beginPath();
    this.ctx.moveTo(-r, -r + arm);
    this.ctx.lineTo(-r, -r);
    this.ctx.lineTo(-r + arm, -r);
    this.ctx.stroke();

    // Top-Right
    this.ctx.beginPath();
    this.ctx.moveTo(r - arm, -r);
    this.ctx.lineTo(r, -r);
    this.ctx.lineTo(r, -r + arm);
    this.ctx.stroke();

    // Bottom-Left
    this.ctx.beginPath();
    this.ctx.moveTo(-r, r - arm);
    this.ctx.lineTo(-r, r);
    this.ctx.lineTo(-r + arm, r);
    this.ctx.stroke();

    // Bottom-Right
    this.ctx.beginPath();
    this.ctx.moveTo(r - arm, r);
    this.ctx.lineTo(r, r);
    this.ctx.lineTo(r, r - arm);
    this.ctx.stroke();

    // Center tick marks
    this.ctx.beginPath();
    this.ctx.moveTo(0, -r - 4);
    this.ctx.lineTo(0, -r);
    this.ctx.moveTo(0, r);
    this.ctx.lineTo(0, r + 4);
    this.ctx.moveTo(-r - 4, 0);
    this.ctx.lineTo(-r, 0);
    this.ctx.moveTo(r, 0);
    this.ctx.lineTo(r + 4, 0);
    this.ctx.stroke();

    this.ctx.restore();
  }

  drawScreenHUD() {
    // Compass rose in top-right of map viewport
    const cx = this.width - 45;
    const cy = 40;

    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
    this.ctx.lineWidth = 1.0;

    // Outer ring
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    this.ctx.stroke();

    // North arrow
    this.ctx.beginPath();
    this.ctx.moveTo(cx, cy - 14);
    this.ctx.lineTo(cx + 5, cy);
    this.ctx.lineTo(cx, cy - 3);
    this.ctx.lineTo(cx - 5, cy);
    this.ctx.closePath();
    this.ctx.fillStyle = '#00f0ff';
    this.ctx.fill();

    this.ctx.fillStyle = '#00f0ff';
    this.ctx.font = 'bold 9px "JetBrains Mono", monospace';
    this.ctx.fillText('N', cx - 3, cy - 20);

    this.ctx.restore();
  }
}

window.TopoMapEngine = TopoMapEngine;
