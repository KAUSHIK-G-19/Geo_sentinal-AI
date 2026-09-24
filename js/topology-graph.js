/**
 * GeoMesh Sentinel - LoRa Mesh Topology Visualizer Engine
 * Interactive multi-hop network tree canvas:
 * Master Gateway (Root) -> 8 Sector Cluster Heads -> 241 Edge Sentinels.
 * Displays link RSSI, hop concentric rings, animated routing pulses, and failover tests.
 */

class TopologyGraphEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!canvasId || !this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.nodes = window.GEOMESH_NODES || [];

    this.simulatedFailures = new Set();
    this.hoveredNode = null;
    this.animTime = 0;
    this.pulses = [];

    this.initCanvasSize();
    this.buildTopologyHierarchy();
    this.initPulses();
    this.bindEvents();
    this.startRenderLoop();
  }

  initCanvasSize() {
    if (!this.canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.width = rect.width || 900;
    this.height = rect.height || 540;

    this.canvas.width = Math.floor(this.width * dpr);
    this.canvas.height = Math.floor(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  buildTopologyHierarchy() {
    this.cx = this.width / 2;
    this.cy = this.height / 2;

    // Gateway at center
    this.gwNode = {
      id: "Gateway-Prime",
      label: "MASTER GATEWAY",
      x: this.cx,
      y: this.cy,
      radius: 16,
      color: '#00f0ff',
      isGw: true
    };

    // 8 Cluster Heads on inner ring (radius R1)
    const r1 = Math.min(this.cx, this.cy) * 0.42;
    const sectorNames = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel"];
    this.clusterHeads = [];

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const headId = `Node ${sectorNames[i]}-1`;
      this.clusterHeads.push({
        id: headId,
        sectorCode: `SEC-0${i + 1}`,
        angle: angle,
        x: this.cx + Math.cos(angle) * r1,
        y: this.cy + Math.sin(angle) * r1,
        radius: 11,
        color: i === 3 ? '#ef4444' : (i === 1 ? '#f59e0b' : '#34d399'),
        parent: this.gwNode,
        isHead: true
      });
    }

    // Edge sentinels clustered around each head on outer ring
    this.leafNodes = [];
    this.clusterHeads.forEach((head, hIdx) => {
      const childCount = 14; // Representative subset of 241 nodes
      const spread = 0.35;
      const r2 = Math.min(this.cx, this.cy) * 0.78;

      for (let c = 0; c < childCount; c++) {
        const cAngle = head.angle + (c / (childCount - 1) - 0.5) * spread;
        const cDist = r2 + (Math.sin(c * 2.3 + hIdx) * 22);
        const childId = `Node ${sectorNames[hIdx]}-${c + 2}`;

        let statusColor = '#38bdf8';
        if (childId === 'Node Charlie-7') statusColor = '#ef4444';
        if (childId === 'Node Bravo-4') statusColor = '#f59e0b';

        this.leafNodes.push({
          id: childId,
          x: this.cx + Math.cos(cAngle) * cDist,
          y: this.cy + Math.sin(cAngle) * cDist,
          radius: 5,
          color: statusColor,
          parentHead: head
        });
      }
    });
  }

  initPulses() {
    this.pulses = [];
    for (let i = 0; i < 18; i++) {
      const leaf = this.leafNodes[Math.floor(Math.random() * this.leafNodes.length)];
      this.pulses.push({
        source: leaf,
        target: leaf.parentHead,
        progress: Math.random(),
        speed: 0.008 + Math.random() * 0.008,
        color: leaf.color
      });
    }
  }

  bindEvents() {
    window.addEventListener('resize', () => {
      this.initCanvasSize();
      this.buildTopologyHierarchy();
    });

    if (this.canvas) {
      this.canvas.addEventListener('mousemove', (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        this.checkHover(mx, my);
      });

      this.canvas.addEventListener('click', () => {
        if (this.hoveredNode && window.telemetryManager) {
          window.telemetryManager.selectNode(this.hoveredNode.id);
        }
      });
    }

    // Failover Simulation Button
    const btnSimFailover = document.getElementById('btnSimulateFailover');
    if (btnSimFailover) {
      btnSimFailover.addEventListener('click', () => {
        this.toggleSimulatedFailover();
      });
    }
  }

  toggleSimulatedFailover() {
    const headEcho = this.clusterHeads[4]; // Echo sector
    const isFailed = this.simulatedFailures.has(headEcho.id);

    if (isFailed) {
      this.simulatedFailures.delete(headEcho.id);
      headEcho.color = '#34d399';
      if (window.soundEngine) window.soundEngine.playClick();
      if (window.terminalEngine) {
        window.terminalEngine.addCustomEvent({
          node: headEcho.id,
          sector: "SEC-05",
          sev: "recov",
          desc: `Cluster Head Echo-1 recovered. LoRa mesh parent restored to Gateway-Prime directly.`
        });
      }
    } else {
      this.simulatedFailures.add(headEcho.id);
      headEcho.color = '#ef4444';
      if (window.soundEngine) window.soundEngine.playWarning();
      if (window.terminalEngine) {
        window.terminalEngine.addCustomEvent({
          node: headEcho.id,
          sector: "SEC-05",
          sev: "warn",
          desc: `Simulated Cluster Head failure at Echo-1: Dynamic Ad-hoc mesh rerouted 14 child sentinels to Delta-1 via 2-hop bypass (recovery in 2.8s).`
        });
      }
    }

    const btnSim = document.getElementById('btnSimulateFailover');
    if (btnSim) {
      btnSim.textContent = isFailed ? 'Simulate Cluster Head Failover' : 'Restore Cluster Head Echo-1';
      btnSim.classList.toggle('active', !isFailed);
    }
  }

  checkHover(mx, my) {
    let found = null;
    const all = [this.gwNode, ...this.clusterHeads, ...this.leafNodes];
    for (const n of all) {
      const d = Math.hypot(n.x - mx, n.y - my);
      if (d <= n.radius + 4) {
        found = n;
        break;
      }
    }
    this.hoveredNode = found;
    if (this.canvas) {
      this.canvas.style.cursor = found ? 'pointer' : 'default';
    }
  }

  startRenderLoop() {
    const loop = () => {
      this.animTime += 0.02;

      const topoWorkspace = document.getElementById('topologyWorkspace');
      if (topoWorkspace && topoWorkspace.classList.contains('active-workspace')) {
        this.render();
      }

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const isLight = document.body.classList.contains('light-theme');
    ctx.clearRect(0, 0, w, h);

    // Concentric Hop Rings
    const r1 = Math.min(this.cx, this.cy) * 0.42;
    const r2 = Math.min(this.cx, this.cy) * 0.78;

    [r1, r2].forEach((r, idx) => {
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = isLight ? 'rgba(2, 132, 199, 0.25)' : 'rgba(0, 240, 255, 0.08)';
      ctx.setLineDash([4, 6]);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = isLight ? 'rgba(2, 132, 199, 0.8)' : 'rgba(0, 240, 255, 0.35)';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillText(`HOP ${idx + 1} BOUNDARY`, this.cx - 38, this.cy - r - 4);
    });

    // Links: Gateway to Cluster Heads
    this.clusterHeads.forEach(head => {
      ctx.beginPath();
      ctx.moveTo(this.gwNode.x, this.gwNode.y);
      ctx.lineTo(head.x, head.y);
      ctx.strokeStyle = this.simulatedFailures.has(head.id) ? 
        'rgba(239, 68, 68, 0.3)' : 
        (isLight ? 'rgba(2, 132, 199, 0.45)' : 'rgba(0, 240, 255, 0.3)');
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Links: Cluster Heads to Edge Sentinels
    this.leafNodes.forEach(leaf => {
      ctx.beginPath();
      let targetHead = leaf.parentHead;
      // If parent failed, draw rerouted line to neighbor head
      if (this.simulatedFailures.has(targetHead.id)) {
        targetHead = this.clusterHeads[3]; // Reroute to Delta-1
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
        ctx.setLineDash([2, 3]);
      } else {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
        ctx.setLineDash([]);
      }
      ctx.moveTo(targetHead.x, targetHead.y);
      ctx.lineTo(leaf.x, leaf.y);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // Moving Data Pulses
    this.pulses.forEach(p => {
      p.progress += p.speed;
      if (p.progress >= 1) p.progress = 0;

      let target = p.target;
      if (this.simulatedFailures.has(target.id)) target = this.clusterHeads[3];

      const px = p.source.x + (target.x - p.source.x) * p.progress;
      const py = p.source.y + (target.y - p.source.y) * p.progress;

      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Draw Edge Sentinels
    this.leafNodes.forEach(leaf => {
      ctx.beginPath();
      ctx.arc(leaf.x, leaf.y, leaf.radius, 0, Math.PI * 2);
      ctx.fillStyle = leaf.color;
      ctx.fill();
    });

    // Draw Cluster Heads
    this.clusterHeads.forEach(head => {
      // Glow ring
      ctx.beginPath();
      ctx.arc(head.x, head.y, head.radius + 5 + Math.sin(this.animTime * 3) * 2, 0, Math.PI * 2);
      ctx.strokeStyle = head.color;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(head.x, head.y, head.radius, 0, Math.PI * 2);
      ctx.fillStyle = head.color;
      ctx.fill();

      // Label
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(head.sectorCode, head.x, head.y + head.radius + 14);
    });

    // Draw Gateway Prime (Root)
    const gwPulse = 18 + Math.sin(this.animTime * 4) * 4;
    ctx.beginPath();
    ctx.arc(this.gwNode.x, this.gwNode.y, gwPulse, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(this.gwNode.x, this.gwNode.y, this.gwNode.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#070a12';
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GW', this.gwNode.x, this.gwNode.y);

    ctx.fillStyle = '#00f0ff';
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.fillText('GATEWAY-PRIME', this.gwNode.x, this.gwNode.y - 24);

    // Hover Tooltip
    if (this.hoveredNode) {
      const n = this.hoveredNode;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.5)';
      ctx.lineWidth = 1;
      const boxW = 160;
      const boxH = 46;
      const bx = Math.min(w - boxW - 10, n.x + 10);
      const by = Math.min(h - boxH - 10, n.y - boxH - 5);
      ctx.fillRect(bx, by, boxW, boxH);
      ctx.strokeRect(bx, by, boxW, boxH);

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(n.id, bx + 8, by + 8);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(n.isGw ? 'Root Gateway (868.1MHz)' : (n.isHead ? `Cluster Head // ${n.sectorCode}` : 'Edge Sentinel Node'), bx + 8, by + 26);
    }
  }
}
