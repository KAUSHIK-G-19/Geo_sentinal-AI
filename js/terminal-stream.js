/**
 * GeoMesh Sentinel - Live Streaming Data Terminal & Event Generator
 * Emits real-time LoRa mesh packets, edge Kalman filter updates,
 * sensor threshold events, and critical mine subsidence alerts.
 */

class TerminalStreamEngine {
  constructor() {
    this.tableBody = document.getElementById('terminalTableBody');
    this.scrollContainer = document.getElementById('terminalScrollContainer');
    this.isPaused = false;
    this.autoScroll = true;
    this.severityFilter = 'all'; // all, crit, warn, info
    this.events = [];
    this.maxEvents = 150;

    this.sampleEventTemplates = [
      {
        node: "Node Charlie-7",
        sector: "SEC-04",
        sev: "crit",
        desc: "Perimeter anomaly detected at Sector 4: Fissure displacement +14.2mm exceeded threshold"
      },
      {
        node: "Node Charlie-7",
        sector: "SEC-04",
        sev: "recov",
        desc: "Node C-7 connection restored - self-healing mesh rerouted via Bravo-2"
      },
      {
        node: "Node Alpha-1",
        sector: "SEC-01",
        sev: "info",
        desc: "LoRa multi-hop telemetry uplink received - SNR +9.2dB, RSSI -68dBm"
      },
      {
        node: "Node Bravo-4",
        sector: "SEC-02",
        sev: "warn",
        desc: "Battery voltage dipped to 3.41V (18%) - solar charge suboptimal due to dust cover"
      },
      {
        node: "Node Delta-2",
        sector: "SEC-04",
        sev: "crit",
        desc: "MPU6050 Ground Tilt angular shift detected: Pitch +4.45°, Roll +3.90°"
      },
      {
        node: "Gateway-Prime",
        sector: "SEC-03",
        sev: "info",
        desc: "ST-GNN AI spatial-temporal deformation sync complete across 245 active nodes"
      },
      {
        node: "Node Echo-9",
        sector: "SEC-05",
        sev: "warn",
        desc: "LoRa RF packet loss 4.2% - switching dynamic hop route to Cluster Head E-1"
      },
      {
        node: "Node Foxtrot-3",
        sector: "SEC-06",
        sev: "info",
        desc: "1D Kalman filter stabilized MPU6050 vibration noise caused by heavy dump truck"
      },
      {
        node: "Node Golf-8",
        sector: "SEC-07",
        sev: "warn",
        desc: "Weak LoRa signal (-116 dBm) at Underground Shaft Portal entrance"
      },
      {
        node: "Gateway-Prime",
        sector: "SEC-04",
        sev: "info",
        desc: "Physics-Informed Neural Network (PINN): Knothe subsidence curve recalculated"
      },
      {
        node: "Node Hotel-1",
        sector: "SEC-08",
        sev: "info",
        desc: "Autonomous heartbeat ACK received - BME280 Temp 29.1°C, Humidity 48%"
      },
      {
        node: "Node Delta-5",
        sector: "SEC-04",
        sev: "warn",
        desc: "Linear potentiometer micro-crack movement detected: +1.64mm in last 60m"
      }
    ];

    this.bindEvents();
    this.seedInitialEvents();
    this.startStreamingLoop();
  }

  bindEvents() {
    const btnPause = document.getElementById('btnPauseTerminal');
    const btnClear = document.getElementById('btnClearTerminal');
    const btnTrigger = document.getElementById('btnTriggerAnomaly');
    const btnExport = document.getElementById('btnExportLogs');

    if (btnPause) {
      btnPause.addEventListener('click', () => {
        this.isPaused = !this.isPaused;
        btnPause.innerHTML = this.isPaused ? 
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Resume' : 
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause';
        btnPause.classList.toggle('active', this.isPaused);
        if (window.soundEngine) window.soundEngine.playClick();
      });
    }

    if (btnClear) {
      btnClear.addEventListener('click', () => {
        this.events = [];
        this.renderTable();
        if (window.soundEngine) window.soundEngine.playClick();
      });
    }

    if (btnTrigger) {
      btnTrigger.addEventListener('click', () => {
        this.triggerSimulatedAnomaly();
      });
    }

    if (btnExport) {
      btnExport.addEventListener('click', () => {
        this.exportLogs();
      });
    }

    // Filter by severity buttons
    const filterBtns = document.querySelectorAll('.term-filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.severityFilter = btn.dataset.sev;
        this.renderTable();
        if (window.soundEngine) window.soundEngine.playClick();
      });
    });

    // Dock collapse/expand toggle
    const btnDock = document.getElementById('btnToggleTerminalDock');
    const termSection = document.getElementById('terminalSection');
    const dockText = document.getElementById('terminalDockText');
    const dockIcon = document.getElementById('terminalDockIcon');

    if (btnDock && termSection) {
      btnDock.addEventListener('click', (e) => {
        e.stopPropagation();
        const isCollapsed = termSection.classList.toggle('collapsed');
        if (dockText) dockText.textContent = isCollapsed ? 'Expand' : 'Collapse';
        if (dockIcon) {
          dockIcon.innerHTML = isCollapsed ? 
            '<polyline points="18 15 12 9 6 15"></polyline>' : 
            '<polyline points="6 9 12 15 18 9"></polyline>';
        }
        if (window.soundEngine) window.soundEngine.playClick();
        setTimeout(() => {
          if (window.mapEngine) window.mapEngine.initCanvasSize();
        }, 320);
      });
    }

    // Detect user scrolling to disable autoScroll temporarily
    if (this.scrollContainer) {
      this.scrollContainer.addEventListener('scroll', () => {
        const atBottom = this.scrollContainer.scrollHeight - this.scrollContainer.scrollTop - this.scrollContainer.clientHeight < 30;
        this.autoScroll = atBottom;
      });
    }
  }

  seedInitialEvents() {
    const now = new Date();
    // Seed with prompt required events:
    // "13:05 - Node C-7 connection restored", "13:07 - Perimeter anomaly detected at Sector 4"
    const seeds = [
      {
        time: this.formatTimeOffset(now, -6),
        sev: "info",
        node: "Gateway-Prime",
        sector: "SEC-03",
        desc: "Mesh network self-healing routine initialized on 868.1 MHz channel"
      },
      {
        time: "13:05:12",
        sev: "recov",
        node: "Node C-7",
        sector: "SEC-04",
        desc: "Node C-7 connection restored - self-healing mesh link active"
      },
      {
        time: this.formatTimeOffset(now, -4),
        sev: "info",
        node: "Node Alpha-1",
        sector: "SEC-01",
        desc: "Telemetry sync: MPU6050 nominal, battery 96%, LoRa RSSI -68dBm"
      },
      {
        time: this.formatTimeOffset(now, -3),
        sev: "warn",
        node: "Node Bravo-4",
        sector: "SEC-02",
        desc: "Low battery threshold reached: 18% remaining, switching to low-power beacon"
      },
      {
        time: "13:07:44",
        sev: "crit",
        node: "Node Charlie-7",
        sector: "SEC-04",
        desc: "Perimeter anomaly detected at Sector 4: Fissure displacement +14.2mm exceeded safety threshold"
      },
      {
        time: this.formatTimeOffset(now, -1),
        sev: "info",
        node: "Node Foxtrot-3",
        sector: "SEC-06",
        desc: "1D Kalman noise filtering confirmed stable on ESP32 edge node"
      }
    ];

    this.events = seeds;
    this.renderTable();
  }

  formatTimeOffset(baseDate, minuteOffset) {
    const d = new Date(baseDate.getTime() + minuteOffset * 60000);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  }

  getNowTime() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  }

  startStreamingLoop() {
    const emit = () => {
      if (!this.isPaused) {
        const randTemplate = this.sampleEventTemplates[Math.floor(Math.random() * this.sampleEventTemplates.length)];
        const newEvt = {
          time: this.getNowTime(),
          sev: randTemplate.sev,
          node: randTemplate.node,
          sector: randTemplate.sector,
          desc: randTemplate.desc
        };

        this.addEvent(newEvt);
      }

      // Next event in 2.5 to 5.0 seconds
      const delay = 2500 + Math.random() * 2500;
      setTimeout(emit, delay);
    };

    setTimeout(emit, 3000);
  }

  addEvent(event) {
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }
    this.renderTable();

    // Update the live activity ticker on Overview Map
    const tickerEl = document.getElementById('mapLatestEventText');
    if (tickerEl) {
      const color = event.sev === 'crit' ? '#dc2626' : (event.sev === 'warn' ? '#d97706' : '#0284c7');
      tickerEl.innerHTML = `${event.time} IST · ${event.sector} · <strong style="color:${color};">${event.node}</strong>: ${event.desc}`;
    }

    if (event.sev === 'crit' && window.soundEngine) {
      window.soundEngine.playWarning();
    }
  }

  addCustomEvent(evt) {
    if (!evt.time) evt.time = this.getNowTime();
    this.addEvent(evt);
  }

  setSpeed(speed) {
    this.streamSpeed = speed;
    if (this.streamInterval) clearInterval(this.streamInterval);
    if (!this.isPaused) {
      const delay = speed === 5 ? 650 : (speed === 0 ? 999999 : 2800);
      this.streamInterval = setInterval(() => this.emitRandomTelemetryEvent(), delay);
    }
  }

  triggerSimulatedAnomaly() {
    const alertEvent = {
      time: this.getNowTime(),
      sev: "crit",
      node: "Node Charlie-7",
      sector: "SEC-04",
      desc: "CRITICAL BREACH: Subsidence fissure expansion detected (+16.8mm). Knothe PINN alarm fired. Emergency SMS dispatched to site engineers."
    };

    this.addEvent(alertEvent);

    if (window.soundEngine) {
      window.soundEngine.playAlertStrobe();
    }

    // Focus on node Charlie-7 on the map
    if (window.mapEngine) {
      window.mapEngine.focusNodeById("Node Charlie-7");
    }

    // Flash header status
    const statusBadge = document.getElementById('headerMeshStatus');
    if (statusBadge) {
      statusBadge.style.backgroundColor = 'rgba(239, 68, 68, 0.3)';
      statusBadge.style.borderColor = '#ef4444';
      statusBadge.querySelector('span:last-child').textContent = 'Mesh Alert: Sector 4 Breach';
      setTimeout(() => {
        statusBadge.style.backgroundColor = '';
        statusBadge.style.borderColor = '';
        statusBadge.querySelector('span:last-child').textContent = 'Mesh Status: Optimal';
      }, 5000);
    }
  }

  exportLogs() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.events, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `geomesh_sentinel_logs_${Date.now()}.json`);
    dlAnchorElem.click();
  }

  renderTable() {
    if (!this.tableBody) return;

    const visibleEvents = this.events.filter(e => {
      if (this.severityFilter === 'all') return true;
      if (this.severityFilter === 'crit' && e.sev !== 'crit') return false;
      if (this.severityFilter === 'warn' && (e.sev !== 'warn' && e.sev !== 'crit')) return false;
      if (this.severityFilter === 'info' && e.sev !== 'info' && e.sev !== 'recov') return false;
      return true;
    });

    this.tableBody.innerHTML = visibleEvents.map(e => {
      let sevClass = 'sev-info';
      let sevLabel = 'INFO';
      if (e.sev === 'crit') { sevClass = 'sev-crit'; sevLabel = 'CRITICAL'; }
      else if (e.sev === 'warn') { sevClass = 'sev-warn'; sevLabel = 'WARNING'; }
      else if (e.sev === 'recov') { sevClass = 'sev-recov'; sevLabel = 'RECOVERY'; }

      return `
        <tr class="terminal-row" onclick="window.telemetryManager && window.telemetryManager.selectNode('${e.node}')" style="cursor:pointer;">
          <td class="terminal-time">${e.time}</td>
          <td><span class="sev-badge ${sevClass}">${sevLabel}</span></td>
          <td class="terminal-node">${e.node}</td>
          <td class="terminal-sector">${e.sector}</td>
          <td class="terminal-desc">${e.desc}</td>
        </tr>
      `;
    }).join('');

    if (this.autoScroll && this.scrollContainer) {
      this.scrollContainer.scrollTop = this.scrollContainer.scrollHeight;
    }
  }
}

window.TerminalStreamEngine = TerminalStreamEngine;
