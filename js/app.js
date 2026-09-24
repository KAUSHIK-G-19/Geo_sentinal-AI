/**
 * GeoMesh Sentinel - Main Application Coordinator & Command Engine
 * Orchestrates 6 operational workspaces, light/dark theme switcher,
 * real-time ECG telemetry pulse, live station uptime, LoRa throughput, and video wall mode.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 0. Setup Theme Toggle (Light Color by default)
  initThemeToggle();

  // 1. Initialize Map Canvas Engine
  window.mapEngine = new TopoMapEngine('topoCanvas');

  // 2. Initialize Telemetry Sidebar & Search
  window.telemetryManager = new TelemetryManager();

  // 3. Initialize Live Streaming Terminal
  window.terminalEngine = new TerminalStreamEngine();

  // 4. Initialize NOC Fleet Matrix (250 Nodes)
  window.fleetMatrix = new FleetMatrixEngine();

  // 5. Initialize Subsidence & PINN Analytics Lab
  window.analyticsLab = new AnalyticsLabEngine();

  // 6. Initialize LoRa Mesh Topology Visualizer
  window.topologyGraph = new TopologyGraphEngine('topoGraphCanvas');

  // 7. Setup Real-Time Digital Clocks & Station Uptime
  initClocksAndUptime();

  // 8. Setup Live Header ECG Telemetry Pulse Waveform
  initHeaderPulse();

  // 9. Setup LoRa Tx/Rx Throughput Packet Counter
  initThroughputCounters();

  // 10. Setup Interactive KPI Sparklines
  initKpiSparklines();

  // 11. Setup Multi-Workspace Navigation
  initWorkspaceNavigation();

  // 12. Setup Audio Toggle
  initAudioToggle();

  // 13. Setup Alert Bell & Triage Triggers
  initAlertBell();

  // 14. Setup Fullscreen Video Wall Toggle
  initVideoWallToggle();

  // 15. Setup KPI Micro-variations
  initKpiOscillations();
});

/**
 * 0. Theme Switcher (Defaults to Clean Light Color)
 */
function initThemeToggle() {
  const btnTheme = document.getElementById('btnThemeToggle');
  const savedTheme = localStorage.getItem('geomesh_theme') || 'light-theme';

  // Apply default or saved theme
  document.body.className = savedTheme;
  updateThemeButtonUI(savedTheme);

  if (btnTheme) {
    btnTheme.addEventListener('click', () => {
      const isLight = document.body.classList.contains('light-theme');
      const newTheme = isLight ? 'dark-theme' : 'light-theme';
      document.body.className = newTheme;
      localStorage.setItem('geomesh_theme', newTheme);
      updateThemeButtonUI(newTheme);

      if (window.soundEngine) window.soundEngine.playClick();

      // Refresh sparklines & views for updated theme
      initKpiSparklines();
      if (window.mapEngine) window.mapEngine.initCanvasSize();
      if (window.analyticsLab) window.analyticsLab.renderAll();
      if (window.topologyGraph) window.topologyGraph.initCanvasSize();
    });
  }
}

function updateThemeButtonUI(theme) {
  const btnTheme = document.getElementById('btnThemeToggle');
  if (!btnTheme) return;
  const isLight = theme === 'light-theme';
  btnTheme.title = isLight ? "Switch to Tactical Dark Mode" : "Switch to Clean Light Mode";
  btnTheme.innerHTML = isLight ? 
    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>` : 
    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
}

/**
 * 1. Zulu Clock, Local IST Date & Station Uptime Counter
 */
function initClocksAndUptime() {
  const utcEl = document.getElementById('headerUtcTime');
  const dateEl = document.getElementById('headerLocalDate');
  const uptimeEl = document.getElementById('headerUptimeVal');

  // Station start timestamp (simulated 184 days ago)
  const stationStartTime = Date.now() - (184 * 86400000 + 6 * 3600000 + 42 * 60000 + 19000);

  function update() {
    const now = new Date();
    // UTC Zulu military time
    const zHours = String(now.getUTCHours()).padStart(2, '0');
    const zMins = String(now.getUTCMinutes()).padStart(2, '0');
    const zSecs = String(now.getUTCSeconds()).padStart(2, '0');
    if (utcEl) {
      utcEl.textContent = `${zHours}:${zMins}:${zSecs} ZULU`;
    }

    if (dateEl) {
      const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
      dateEl.textContent = now.toLocaleDateString('en-US', options).toUpperCase();
    }

    // Live running uptime counter
    if (uptimeEl) {
      const diffMs = Date.now() - stationStartTime;
      const days = Math.floor(diffMs / 86400000);
      const hours = String(Math.floor((diffMs % 86400000) / 3600000)).padStart(2, '0');
      const mins = String(Math.floor((diffMs % 3600000) / 60000)).padStart(2, '0');
      const secs = String(Math.floor((diffMs % 60000) / 1000)).padStart(2, '0');
      uptimeEl.textContent = `${days}d ${hours}h ${mins}m ${secs}s`;
    }
  }

  update();
  setInterval(update, 1000);
}

/**
 * 2. Live Header ECG Heartbeat Waveform Oscilloscope
 */
function initHeaderPulse() {
  const canvas = document.getElementById('headerPulseCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width = 110;
  const h = canvas.height = 28;

  let offset = 0;
  function draw() {
    ctx.clearRect(0, 0, w, h);
    offset += 1.8;
    if (offset > w) offset = 0;

    const isLight = document.body.classList.contains('light-theme');
    const pulseColor = isLight ? '#0284c7' : '#00f0ff';

    ctx.strokeStyle = pulseColor;
    ctx.lineWidth = 1.6;
    ctx.beginPath();

    for (let x = 0; x < w; x += 2) {
      const pos = (x + offset) % w;
      let y = h / 2;

      // ECG heartbeat spike at specific position in cycle
      if (pos > 45 && pos < 50) y = h / 2 - 3;
      else if (pos >= 50 && pos < 55) y = h / 2 + 10;
      else if (pos >= 55 && pos < 62) y = h / 2 - 12; // R peak
      else if (pos >= 62 && pos < 68) y = h / 2 + 4;
      else if (pos >= 68 && pos < 78) y = h / 2 - 4; // T wave

      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Pulse head glow
    ctx.beginPath();
    ctx.arc(w - 6, h / 2, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = pulseColor;
    ctx.shadowColor = pulseColor;
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;

    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
}

/**
 * 3. LoRa Tx/Rx Throughput Packet Counter
 */
function initThroughputCounters() {
  const txEl = document.getElementById('statTxCount');
  const rxEl = document.getElementById('statRxCount');
  let tx = 1842;
  let rx = 1838;

  setInterval(() => {
    tx += Math.floor(Math.random() * 4) + 1;
    rx += Math.floor(Math.random() * 4) + 1;
    if (txEl) txEl.textContent = `${tx.toLocaleString()} pkts/m`;
    if (rxEl) rxEl.textContent = `${rx.toLocaleString()} pkts/m`;
  }, 2200);
}

/**
 * 4. Interactive KPI Sparkline Graphs (24-Hour Historical Trends)
 */
function initKpiSparklines() {
  const isLight = document.body.classList.contains('light-theme');
  const sparkConfigs = [
    { id: 'sparkActiveNodes', data: [94, 95, 96, 95, 97, 98, 97, 98, 98, 98], color: isLight ? '#0284c7' : '#00f0ff' },
    { id: 'sparkLatency', data: [16, 15, 14, 13, 14, 12, 13, 12, 11, 12], color: isLight ? '#059669' : '#10b981' },
    { id: 'sparkSubsidence', data: [2.1, 3.4, 4.8, 6.2, 8.5, 10.9, 12.4, 13.8, 14.2], color: isLight ? '#dc2626' : '#ef4444' },
    { id: 'sparkPinnRisk', data: [12, 18, 25, 42, 60, 78, 88, 92, 94], color: isLight ? '#d97706' : '#f59e0b' },
    { id: 'sparkSolarFleet', data: [95, 94, 92, 91, 93, 89, 88, 90, 89], color: isLight ? '#0284c7' : '#38bdf8' }
  ];

  sparkConfigs.forEach(cfg => {
    const el = document.getElementById(cfg.id);
    if (!el) return;

    const w = 110;
    const h = 32;
    const max = Math.max(...cfg.data);
    const min = Math.min(...cfg.data);
    const range = max - min || 1;

    const points = cfg.data.map((val, idx) => {
      const x = (idx / (cfg.data.length - 1)) * (w - 12) + 6;
      const y = h - 6 - ((val - min) / range) * (h - 12);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    const lastVal = cfg.data[cfg.data.length - 1];
    const lastX = w - 6;
    const lastY = h - 6 - ((lastVal - min) / range) * (h - 12);

    el.innerHTML = `
      <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
        <polyline fill="none" stroke="${cfg.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="${points}" />
        <circle cx="${lastX}" cy="${lastY}" r="3" fill="${cfg.color}" />
      </svg>
    `;
  });
}

/**
 * 5. Multi-Workspace Switcher & Executive Tab Controller
 * Seamlessly transitions between the 6 command center operational segments.
 */
window.switchWorkspace = function(view) {
  const workspaces = {
    'map': document.getElementById('mapWorkspace'),
    'fleet': document.getElementById('fleetWorkspace'),
    'analytics': document.getElementById('analyticsWorkspace'),
    'alerts': document.getElementById('alertsWorkspace'),
    'topography': document.getElementById('topologyWorkspace'),
    'settings': document.getElementById('settingsWorkspace')
  };

  if (!workspaces[view]) return;

  // Sync active states on sidebar nav items
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.view === view);
  });

  // Sync active states on top segmented tab buttons
  document.querySelectorAll('.nav-tab-btn').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.view === view);
  });

  // Hide all workspaces, activate selected
  Object.values(workspaces).forEach(ws => {
    if (ws) ws.classList.remove('active-workspace');
  });
  workspaces[view].classList.add('active-workspace');

  if (window.soundEngine) window.soundEngine.playClick();

  // Trigger workspace-specific layout refresh
  if (view === 'fleet' && window.fleetMatrix) {
    window.fleetMatrix.render();
  } else if (view === 'analytics' && window.analyticsLab) {
    setTimeout(() => window.analyticsLab.renderAll(), 60);
  } else if (view === 'topography' && window.topologyGraph) {
    setTimeout(() => {
      window.topologyGraph.initCanvasSize();
      window.topologyGraph.buildTopologyHierarchy();
    }, 60);
  } else if (view === 'map' && window.mapEngine) {
    setTimeout(() => window.mapEngine.initCanvasSize(), 60);
  } else if (view === 'settings' && window.terminalEngine) {
    if (window.terminalEngine.scrollContainer) {
      window.terminalEngine.scrollContainer.scrollTop = window.terminalEngine.scrollContainer.scrollHeight;
    }
  }
};

function initWorkspaceNavigation() {
  // Bind sidebar nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      if (item.dataset.view) window.switchWorkspace(item.dataset.view);
    });
  });

  // Bind top segmented tab bar buttons
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.view) window.switchWorkspace(btn.dataset.view);
    });
  });

  // Bind direct segment jump buttons
  const btnLogs = document.getElementById('btnOpenFullLogs');
  if (btnLogs) {
    btnLogs.addEventListener('click', () => window.switchWorkspace('settings'));
  }

  const btnFleet = document.getElementById('btnGoToFleetMatrix');
  if (btnFleet) {
    btnFleet.addEventListener('click', () => window.switchWorkspace('fleet'));
  }
}

/**
 * 6. Audio Toggle & Volume Controller
 */
function initAudioToggle() {
  const audioBtn = document.getElementById('audioToggleBtn');
  if (!audioBtn) return;

  audioBtn.addEventListener('click', () => {
    const isMuted = window.soundEngine.toggleMute();
    audioBtn.classList.toggle('muted', isMuted);
    audioBtn.dataset.tooltip = isMuted ? 'Sound FX: Muted' : 'Sound FX: Enabled';
    audioBtn.innerHTML = isMuted ? 
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/></svg>' : 
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
  });
}

/**
 * 7. Alert Bell & Emergency Triage Drawer
 */
function initAlertBell() {
  const bellBtn = document.getElementById('alertBellBtn');
  const alertNav = document.querySelector('.nav-item[data-view="alerts"]');

  if (bellBtn) {
    bellBtn.addEventListener('click', () => {
      if (alertNav) alertNav.click();
      if (window.soundEngine) window.soundEngine.playWarning();
    });
  }

  // Acknowledge all alerts button
  const ackBtn = document.getElementById('btnAckAllAlerts');
  const alertBadge = document.getElementById('unreadAlertBadge');
  if (ackBtn) {
    ackBtn.addEventListener('click', () => {
      if (alertBadge) alertBadge.style.display = 'none';
      ackBtn.textContent = 'ALL ALERTS ACKNOWLEDGED BY COMMAND';
      ackBtn.disabled = true;
      ackBtn.style.opacity = '0.6';
      if (window.soundEngine) window.soundEngine.playClick();
      if (window.terminalEngine) {
        window.terminalEngine.addCustomEvent({
          node: "COMMAND-CENTRAL",
          sector: "NOC",
          sev: "info",
          desc: "Mine Safety Officer acknowledged all active Tier-4 Subsidence & Low-Power warnings."
        });
      }
    });
  }

  // Evacuation Siren Test Button
  const btnSirenTest = document.getElementById('btnTriggerSirenTest');
  if (btnSirenTest) {
    btnSirenTest.addEventListener('click', () => {
      if (window.soundEngine) window.soundEngine.playAlertStrobe();
      btnSirenTest.textContent = 'SIREN AUDIBLE TEST ACTIVE (10s)';
      btnSirenTest.classList.add('active');
      setTimeout(() => {
        btnSirenTest.textContent = 'TEST 110dB EVACUATION SIREN';
        btnSirenTest.classList.remove('active');
      }, 10000);
    });
  }
}

/**
 * 8. Fullscreen Video Wall Mode Toggle
 */
function initVideoWallToggle() {
  const btnFullscreen = document.getElementById('btnFullscreenToggle');
  if (!btnFullscreen) return;

  btnFullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.log(err));
      btnFullscreen.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>';
      btnFullscreen.title = "Exit Video Wall Mode";
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      btnFullscreen.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
      btnFullscreen.title = "Toggle 4K Video Wall Mode";
    }
  });
}

/**
 * 9. KPI Micro-variations
 */
function initKpiOscillations() {
  const latencyEl = document.getElementById('kpiLatencyVal');
  if (!latencyEl) return;

  setInterval(() => {
    const jitter = (11.8 + Math.random() * 1.6).toFixed(1);
    latencyEl.innerHTML = `${jitter}<span class="kpi-unit">ms</span>`;
  }, 4000);
}
