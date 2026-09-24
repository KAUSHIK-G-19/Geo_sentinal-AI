/**
 * GeoMesh Sentinel - Node Telemetry Sidebar & Search Controller
 * Handles the 30% Right Panel structured node list, status filters,
 * real-time search lookup, and bidirectional map interaction.
 */

class TelemetryManager {
  constructor() {
    this.nodes = window.GEOMESH_NODES || [];
    this.filteredNodes = [...this.nodes];
    this.currentFilter = 'all'; // all, healthy, warning, alert, offline
    this.searchQuery = '';
    this.selectedNodeId = null;

    this.container = document.getElementById('telemetryNodeList');
    this.counterEl = document.getElementById('telemetryCounter');
    this.searchInput = document.getElementById('nodeSearchInput');
    this.clearSearchBtn = document.getElementById('clearSearchBtn');
    this.dropdownEl = document.getElementById('searchResultsDropdown');

    this.bindEvents();
    this.renderList();
  }

  bindEvents() {
    // Filter pills
    const filterPills = document.querySelectorAll('.filter-pill');
    filterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        filterPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.currentFilter = pill.dataset.filter;
        this.applyFilters();
        if (window.soundEngine) window.soundEngine.playClick();
      });
    });

    // Top Header Search Bar
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim();
        this.applyFilters();
        this.renderSearchDropdown(this.searchQuery);
        if (this.clearSearchBtn) {
          this.clearSearchBtn.classList.toggle('visible', this.searchQuery.length > 0);
        }
      });

      this.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const firstMatch = this.filteredNodes[0];
          if (firstMatch) {
            this.selectNode(firstMatch.id);
            this.closeDropdown();
          }
        } else if (e.key === 'Escape') {
          this.closeDropdown();
        }
      });
    }

    if (this.clearSearchBtn) {
      this.clearSearchBtn.addEventListener('click', () => {
        this.searchInput.value = '';
        this.searchQuery = '';
        this.clearSearchBtn.classList.remove('visible');
        this.closeDropdown();
        this.applyFilters();
      });
    }

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
      if (this.dropdownEl && !this.searchInput.contains(e.target) && !this.dropdownEl.contains(e.target)) {
        this.closeDropdown();
      }
    });

    // Close button on floating inspector HUD
    const hudCloseBtn = document.getElementById('hudCloseBtn');
    if (hudCloseBtn) {
      hudCloseBtn.addEventListener('click', () => {
        const hud = document.getElementById('nodeInspectorHud');
        if (hud) hud.classList.remove('active');
      });
    }
  }

  closeDropdown() {
    if (this.dropdownEl) {
      this.dropdownEl.classList.remove('open');
      this.dropdownEl.innerHTML = '';
    }
  }

  renderSearchDropdown(query) {
    if (!this.dropdownEl) return;
    if (!query || query.length < 1) {
      this.closeDropdown();
      return;
    }

    const q = query.toLowerCase();
    const matches = this.nodes.filter(n => 
      n.id.toLowerCase().includes(q) || 
      n.code.toLowerCase().includes(q) || 
      n.sector.toLowerCase().includes(q)
    ).slice(0, 6);

    if (matches.length === 0) {
      this.dropdownEl.innerHTML = `<div class="search-result-item" style="color:var(--text-muted);">No Sentinel Node matches "${query}"</div>`;
      this.dropdownEl.classList.add('open');
      return;
    }

    this.dropdownEl.innerHTML = matches.map(node => `
      <div class="search-result-item" data-node-id="${node.id}">
        <span style="font-weight:700;">${node.id} <span style="color:var(--text-muted);font-weight:normal;">[${node.sectorCode}]</span></span>
        <span class="status-tag tag-${node.status === 'alert' ? 'alert' : (node.status === 'warning' ? 'warning' : (node.status === 'offline' ? 'offline' : 'healthy'))}">
          ${node.statusLabel}
        </span>
      </div>
    `).join('');

    this.dropdownEl.classList.add('open');

    // Attach click listeners to dropdown items
    this.dropdownEl.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', () => {
        const nodeId = item.dataset.nodeId;
        if (nodeId) {
          this.selectNode(nodeId);
          this.closeDropdown();
        }
      });
    });
  }

  applyFilters() {
    const q = this.searchQuery.toLowerCase();
    this.filteredNodes = this.nodes.filter(node => {
      // Status filter
      if (this.currentFilter !== 'all') {
        if (this.currentFilter === 'alert' && node.status !== 'alert') return false;
        if (this.currentFilter === 'warning' && node.status !== 'warning') return false;
        if (this.currentFilter === 'healthy' && node.status !== 'healthy') return false;
        if (this.currentFilter === 'offline' && node.status !== 'offline') return false;
      }

      // Search text filter
      if (q) {
        return node.id.toLowerCase().includes(q) || 
               node.code.toLowerCase().includes(q) || 
               node.sector.toLowerCase().includes(q);
      }

      return true;
    });

    this.renderList();
  }

  renderList() {
    if (!this.container) return;

    if (this.counterEl) {
      this.counterEl.textContent = `${this.filteredNodes.length} NODES`;
    }

    if (this.filteredNodes.length === 0) {
      this.container.innerHTML = `
        <div style="text-align:center;padding:30px 10px;color:var(--text-muted);font-family:var(--font-mono);">
          NO NODES MATCH CRITERIA
        </div>
      `;
      return;
    }

    const html = this.filteredNodes.map(node => {
      const isSelected = this.selectedNodeId === node.id;
      
      // Signal CSS class
      let sigClass = 'signal-strong';
      if (node.signalBars === 3) sigClass = 'signal-medium';
      else if (node.signalBars === 2) sigClass = 'signal-weak';
      else if (node.signalBars <= 1) sigClass = 'signal-none';

      // Battery CSS class
      let batClass = '';
      if (node.battery < 25) batClass = 'battery-low';
      if (node.battery <= 5) batClass = 'battery-crit';

      const statusTagClass = node.status === 'alert' ? 'tag-alert' : 
                             (node.status === 'warning' ? 'tag-warning' : 
                             (node.status === 'offline' ? 'tag-offline' : 'tag-healthy'));

      return `
        <div class="node-card status-${node.status} ${isSelected ? 'selected' : ''}" data-node-id="${node.id}">
          <div class="node-card-top">
            <div class="node-id-block">
              <span class="node-name">${node.id}</span>
              <span class="node-sector">${node.sectorCode || 'SEC-03'}</span>
            </div>
            <span class="status-tag ${statusTagClass}">${node.statusLabel}</span>
          </div>

          <div class="node-card-mid">
            <div class="signal-wrap ${sigClass}">
              <div class="signal-bars">
                <div class="signal-bar"></div>
                <div class="signal-bar"></div>
                <div class="signal-bar"></div>
                <div class="signal-bar"></div>
              </div>
              <span class="signal-dbm">${node.signalDbm} dBm</span>
            </div>

            <div class="battery-wrap ${batClass}">
              <div class="battery-icon">
                <div class="battery-fill" style="width:${Math.max(4, node.battery)}%"></div>
              </div>
              <span>${node.battery}%</span>
            </div>
          </div>

          <div class="node-card-bot">
            <div class="metric-span">Tilt: <span class="val">${node.pitch}° / ${node.roll}°</span></div>
            <div class="metric-span">Fissure: <span class="val">${node.crackDisp}mm</span></div>
            <div class="metric-span">Hops: <span class="val">${node.hops}</span></div>
          </div>
        </div>
      `;
    }).join('');

    this.container.innerHTML = html;

    // Attach click listeners
    this.container.querySelectorAll('.node-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.nodeId;
        this.selectNode(id);
      });
    });
  }

  selectNode(nodeId) {
    this.selectedNodeId = nodeId;

    // Update list card selected state
    this.container.querySelectorAll('.node-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.nodeId === nodeId);
    });

    // Notify Map Engine
    if (window.mapEngine) {
      window.mapEngine.focusNodeById(nodeId);
    }
  }

  highlightNodeInList(nodeId) {
    this.selectedNodeId = nodeId;
    if (!this.container) return;

    this.container.querySelectorAll('.node-card').forEach(card => {
      const match = card.dataset.nodeId === nodeId;
      card.classList.toggle('selected', match);
      if (match) {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }
}

window.TelemetryManager = TelemetryManager;
