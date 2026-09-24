/**
 * GeoMesh Sentinel - NOC Fleet Matrix Engine
 * High-density industrial monitoring grid displaying all 250 Sentinel Nodes.
 * Features real-time sensor metrics, multi-parameter sorting, sector filters,
 * instant search, and edge node control actions.
 */

class FleetMatrixEngine {
  constructor() {
    this.nodes = window.GEOMESH_NODES || [];
    this.filteredNodes = [...this.nodes];
    this.container = document.getElementById('fleetMatrixContainer');
    this.tableBody = document.getElementById('fleetTableBody');
    this.counterEl = document.getElementById('fleetNodeCount');
    
    this.searchTerm = '';
    this.statusFilter = 'all';
    this.sectorFilter = 'all';
    this.sortColumn = 'id';
    this.sortAsc = true;
    this.viewMode = 'table'; // 'table' or 'cards'

    this.bindEvents();
    this.startTelemetryJitter();
  }

  bindEvents() {
    // Search input
    const searchInput = document.getElementById('fleetSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchTerm = e.target.value.toLowerCase().trim();
        this.applyFilters();
      });
    }

    // Status filter buttons
    const statusBtns = document.querySelectorAll('.fleet-status-filter');
    statusBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        statusBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.statusFilter = btn.dataset.status;
        this.applyFilters();
        if (window.soundEngine) window.soundEngine.playClick();
      });
    });

    // Sector dropdown filter
    const sectorSelect = document.getElementById('fleetSectorSelect');
    if (sectorSelect) {
      sectorSelect.addEventListener('change', (e) => {
        this.sectorFilter = e.target.value;
        this.applyFilters();
      });
    }

    // View mode toggle (Table vs Cards)
    const btnTableView = document.getElementById('btnFleetTableView');
    const btnCardView = document.getElementById('btnFleetCardView');
    if (btnTableView && btnCardView) {
      btnTableView.addEventListener('click', () => {
        this.viewMode = 'table';
        btnTableView.classList.add('active');
        btnCardView.classList.remove('active');
        this.render();
      });
      btnCardView.addEventListener('click', () => {
        this.viewMode = 'cards';
        btnCardView.classList.add('active');
        btnTableView.classList.remove('active');
        this.render();
      });
    }

    // Table header sort
    const headers = document.querySelectorAll('.fleet-sortable-th');
    headers.forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.sort;
        if (this.sortColumn === col) {
          this.sortAsc = !this.sortAsc;
        } else {
          this.sortColumn = col;
          this.sortAsc = true;
        }
        headers.forEach(h => h.classList.remove('sorted-asc', 'sorted-desc'));
        th.classList.add(this.sortAsc ? 'sorted-asc' : 'sorted-desc');
        this.sortNodes();
        this.render();
        if (window.soundEngine) window.soundEngine.playClick();
      });
    });
  }

  applyFilters() {
    this.filteredNodes = this.nodes.filter(node => {
      // Status filter
      if (this.statusFilter !== 'all') {
        if (this.statusFilter === 'healthy' && node.status !== 'healthy') return false;
        if (this.statusFilter === 'warning' && node.status !== 'warning') return false;
        if (this.statusFilter === 'alert' && node.status !== 'alert') return false;
        if (this.statusFilter === 'offline' && node.status !== 'offline') return false;
      }

      // Sector filter
      if (this.sectorFilter !== 'all') {
        if (`SEC-0${node.sectorId}` !== this.sectorFilter && String(node.sectorId) !== this.sectorFilter) {
          return false;
        }
      }

      // Search term
      if (this.searchTerm) {
        const idMatch = node.id.toLowerCase().includes(this.searchTerm);
        const sectorMatch = (node.sector || '').toLowerCase().includes(this.searchTerm);
        const statusMatch = (node.statusLabel || '').toLowerCase().includes(this.searchTerm);
        if (!idMatch && !sectorMatch && !statusMatch) return false;
      }

      return true;
    });

    this.sortNodes();
    this.render();
  }

  sortNodes() {
    this.filteredNodes.sort((a, b) => {
      let valA = a[this.sortColumn];
      let valB = b[this.sortColumn];

      if (this.sortColumn === 'id') {
        // Natural string compare
        return this.sortAsc ? valA.localeCompare(valB, undefined, { numeric: true }) : valB.localeCompare(valA, undefined, { numeric: true });
      }

      if (valA === undefined) valA = 0;
      if (valB === undefined) valB = 0;

      if (valA < valB) return this.sortAsc ? -1 : 1;
      if (valA > valB) return this.sortAsc ? 1 : -1;
      return 0;
    });
  }

  render() {
    if (this.counterEl) {
      this.counterEl.textContent = `${this.filteredNodes.length} / ${this.nodes.length} NODES DISPLAYED`;
    }

    if (this.viewMode === 'table') {
      this.renderTable();
    } else {
      this.renderCards();
    }
  }

  renderTable() {
    const tableWrap = document.getElementById('fleetTableWrap');
    const cardsWrap = document.getElementById('fleetCardsWrap');
    if (tableWrap) tableWrap.style.display = 'block';
    if (cardsWrap) cardsWrap.style.display = 'none';

    if (!this.tableBody) return;

    if (this.filteredNodes.length === 0) {
      this.tableBody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align: center; padding: 40px; color: var(--text-muted); font-family: var(--font-mono);">
            NO SENTINEL NODES MATCH THE SELECTED FILTER CRITERIA
          </td>
        </tr>
      `;
      return;
    }

    this.tableBody.innerHTML = this.filteredNodes.map(node => {
      const statusColor = node.status === 'alert' ? '#ef4444' : 
                         (node.status === 'warning' ? '#f59e0b' : 
                         (node.status === 'offline' ? '#64748b' : '#10b981'));
      
      const battColor = node.battery > 60 ? '#10b981' : (node.battery > 25 ? '#f59e0b' : '#ef4444');
      const crackColor = node.crackDisp > 10 ? '#ef4444' : (node.crackDisp > 2 ? '#f59e0b' : '#38bdf8');
      const tiltColor = Math.abs(node.pitch) > 3.0 || Math.abs(node.roll) > 3.0 ? '#ef4444' : '#94a3b8';

      return `
        <tr class="fleet-row ${node.status}" data-node-id="${node.id}">
          <td class="col-id">
            <span class="fleet-node-link" onclick="window.fleetMatrix.inspectNode('${node.id}')">
              <strong>${node.id}</strong>
              ${node.isGateway ? '<span class="gateway-tag">GW</span>' : ''}
            </span>
          </td>
          <td class="col-sector">SEC-0${node.sectorId || 1}</td>
          <td class="col-status">
            <span class="status-pill status-${node.status}">
              <span class="status-pulse" style="background: ${statusColor}"></span>
              ${node.statusLabel}
            </span>
          </td>
          <td class="col-signal">
            <div class="signal-meter" title="${node.signalDbm} dBm">
              <div class="signal-bars">
                <span class="bar ${node.signalBars >= 1 ? 'active' : ''}"></span>
                <span class="bar ${node.signalBars >= 2 ? 'active' : ''}"></span>
                <span class="bar ${node.signalBars >= 3 ? 'active' : ''}"></span>
                <span class="bar ${node.signalBars >= 4 ? 'active' : ''}"></span>
              </div>
              <span class="signal-val">${node.signalDbm} dBm</span>
            </div>
          </td>
          <td class="col-battery">
            <div class="batt-cell">
              <div class="batt-bar-wrap">
                <div class="batt-bar-fill" style="width: ${node.battery}%; background: ${battColor}"></div>
              </div>
              <span class="batt-val" style="color: ${battColor}">${node.battery}% <small>(${node.batteryVoltage}V)</small></span>
            </div>
          </td>
          <td class="col-tilt" style="color: ${tiltColor}; font-family: var(--font-mono);">
            ${node.pitch > 0 ? '+' : ''}${node.pitch.toFixed(2)}° / ${node.roll > 0 ? '+' : ''}${node.roll.toFixed(2)}°
          </td>
          <td class="col-crack" style="color: ${crackColor}; font-weight: 700; font-family: var(--font-mono);">
            ${node.crackDisp.toFixed(2)} mm
          </td>
          <td class="col-hops">
            <span class="hops-badge">${node.hops} Hop${node.hops !== 1 ? 's' : ''}</span>
          </td>
          <td class="col-kalman">
            <span class="kalman-tag ${node.status !== 'offline' ? 'active' : ''}">1D-KALMAN OK</span>
          </td>
          <td class="col-actions">
            <div class="fleet-action-btns">
              <button class="node-act-btn" title="Ping Node" onclick="window.fleetMatrix.pingNode('${node.id}')">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              </button>
              <button class="node-act-btn" title="Calibrate MPU6050" onclick="window.fleetMatrix.calibrateNode('${node.id}')">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              </button>
              <button class="node-act-btn" title="Locate on Map" onclick="window.fleetMatrix.locateOnMap('${node.id}')">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  renderCards() {
    const tableWrap = document.getElementById('fleetTableWrap');
    const cardsWrap = document.getElementById('fleetCardsWrap');
    if (tableWrap) tableWrap.style.display = 'none';
    if (cardsWrap) cardsWrap.style.display = 'grid';

    if (!cardsWrap) return;

    if (this.filteredNodes.length === 0) {
      cardsWrap.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted); font-family: var(--font-mono);">
          NO SENTINEL NODES MATCH THE SELECTED FILTER CRITERIA
        </div>
      `;
      return;
    }

    cardsWrap.innerHTML = this.filteredNodes.map(node => {
      const statusColor = node.status === 'alert' ? '#ef4444' : 
                         (node.status === 'warning' ? '#f59e0b' : 
                         (node.status === 'offline' ? '#64748b' : '#10b981'));
      
      const battColor = node.battery > 60 ? '#10b981' : (node.battery > 25 ? '#f59e0b' : '#ef4444');
      const crackColor = node.crackDisp > 10 ? '#ef4444' : (node.crackDisp > 2 ? '#f59e0b' : '#38bdf8');

      return `
        <div class="fleet-card card-${node.status}" onclick="window.fleetMatrix.inspectNode('${node.id}')">
          <div class="fcard-header">
            <div class="fcard-id">
              <strong>${node.id}</strong>
              <span class="fcard-sec">SEC-0${node.sectorId}</span>
            </div>
            <span class="status-pill status-${node.status}" style="font-size: 10px;">
              <span class="status-pulse" style="background: ${statusColor}"></span>
              ${node.statusLabel}
            </span>
          </div>

          <div class="fcard-metrics">
            <div class="fcard-metric">
              <span class="fcard-lbl">BATTERY</span>
              <span class="fcard-val" style="color: ${battColor}">${node.battery}%</span>
            </div>
            <div class="fcard-metric">
              <span class="fcard-lbl">SIGNAL</span>
              <span class="fcard-val">${node.signalDbm} dBm</span>
            </div>
            <div class="fcard-metric">
              <span class="fcard-lbl">GROUND TILT</span>
              <span class="fcard-val">${node.pitch.toFixed(1)}° / ${node.roll.toFixed(1)}°</span>
            </div>
            <div class="fcard-metric">
              <span class="fcard-lbl">DISPLACEMENT</span>
              <span class="fcard-val" style="color: ${crackColor}">${node.crackDisp.toFixed(2)} mm</span>
            </div>
          </div>

          <div class="fcard-footer">
            <span class="hops-badge">${node.hops} Hops</span>
            <div class="fcard-btns" onclick="event.stopPropagation()">
              <button class="node-act-btn" onclick="window.fleetMatrix.pingNode('${node.id}')" title="Ping">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              </button>
              <button class="node-act-btn" onclick="window.fleetMatrix.locateOnMap('${node.id}')" title="View on Map">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  inspectNode(nodeId) {
    if (window.telemetryManager) {
      window.telemetryManager.selectNode(nodeId);
    }
  }

  locateOnMap(nodeId) {
    // Switch to map view and focus on node
    const mapNav = document.querySelector('.nav-item[data-view="map"]');
    if (mapNav) mapNav.click();
    setTimeout(() => {
      if (window.mapEngine) window.mapEngine.focusOnNode(nodeId);
      this.inspectNode(nodeId);
    }, 100);
  }

  pingNode(nodeId) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (window.soundEngine) window.soundEngine.playTelemetryPing();
    if (window.terminalEngine) {
      window.terminalEngine.addCustomEvent({
        node: node.id,
        sector: `SEC-0${node.sectorId}`,
        sev: 'info',
        desc: `Autonomous Ping Uplink Request dispatched to ${node.id} -> ACK in 14.2ms (SNR: +8.4dB)`
      });
    }
    this.showQuickToast(`Ping ACK received from ${node.id}: 14.2ms`);
  }

  calibrateNode(nodeId) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (window.soundEngine) window.soundEngine.playClick();
    node.pitch = 0.00;
    node.roll = 0.00;
    this.render();
    if (window.terminalEngine) {
      window.terminalEngine.addCustomEvent({
        node: node.id,
        sector: `SEC-0${node.sectorId}`,
        sev: 'recov',
        desc: `MPU6050 6-Axis accelerometer zero-drift calibrated on ${node.id} via ESP32 1D-Kalman`
      });
    }
    this.showQuickToast(`Zero-point calibrated for ${node.id}`);
  }

  showQuickToast(msg) {
    let toast = document.getElementById('fleetQuickToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'fleetQuickToast';
      toast.className = 'fleet-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  startTelemetryJitter() {
    // Realistic micro-oscillations every 3.5s for live monitor feel
    setInterval(() => {
      // Pick 5 random nodes to slightly jitter
      for (let k = 0; k < 5; k++) {
        const idx = Math.floor(Math.random() * this.nodes.length);
        const node = this.nodes[idx];
        if (node && node.status !== 'offline') {
          node.pitch = +(node.pitch + (Math.random() * 0.06 - 0.03)).toFixed(2);
          node.roll = +(node.roll + (Math.random() * 0.06 - 0.03)).toFixed(2);
          if (node.id === "Node Charlie-7") {
            // Sector 4 fault line slight movement
            node.crackDisp = +(node.crackDisp + 0.01).toFixed(2);
          }
        }
      }
      // Re-render if fleet view is visible
      const fleetWorkspace = document.getElementById('fleetWorkspace');
      if (fleetWorkspace && fleetWorkspace.classList.contains('active-workspace')) {
        this.render();
      }
    }, 3500);
  }
}
