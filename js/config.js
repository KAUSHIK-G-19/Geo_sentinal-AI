/**
 * GeoMesh Sentinel - Configuration and Node Database
 * Simulates 250 IoT Sentinel Nodes across 8 Sectors with real sensor parameters
 * (MPU6050 tilt, crack displacement, 1D Kalman filtering, LoRa multi-hop).
 */

const GEOMESH_CONFIG = {
  projectName: "GeoMesh Sentinel",
  version: "v2.4-TACTICAL",
  problemStatement: "SIH26025 - Mine Subsidence Monitoring & Early Warning",
  team: "Geosentinel AI",
  totalNodesTarget: 250,
  activeNodesTarget: 245,
  networkLatencyBase: 12, // ms
  meshArea: 450, // sq km
  sectors: [
    { id: 1, code: "SEC-01", name: "Alpha Sector (North Highwall)", center: { x: 0.28, y: 0.24 }, risk: "Low" },
    { id: 2, code: "SEC-02", name: "Bravo Sector (East Bench)", center: { x: 0.72, y: 0.28 }, risk: "Moderate" },
    { id: 3, code: "SEC-03", name: "Charlie Sector (Pit Bottom Basin)", center: { x: 0.50, y: 0.52 }, risk: "Low" },
    { id: 4, code: "SEC-04", name: "Delta Sector (Central Fissure Fault)", center: { x: 0.42, y: 0.68 }, risk: "CRITICAL" },
    { id: 5, code: "SEC-05", name: "Echo Sector (West Haulage Ramp)", center: { x: 0.20, y: 0.62 }, risk: "Moderate" },
    { id: 6, code: "SEC-06", name: "Foxtrot Sector (South Overburden Dump)", center: { x: 0.68, y: 0.74 }, risk: "Low" },
    { id: 7, code: "SEC-07", name: "Golf Sector (Underground Shaft Portal)", center: { x: 0.38, y: 0.38 }, risk: "Moderate" },
    { id: 8, code: "SEC-08", name: "Hotel Sector (Sub-station Boundary)", center: { x: 0.82, y: 0.50 }, risk: "Low" }
  ]
};

// Generate realistic 250 nodes
function generateSentinelNodes() {
  const nodes = [];
  const sectorPrefixes = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel"];
  let idCounter = 1;

  // Master Gateway Node at center
  const gateway = {
    id: "Gateway-Prime",
    code: "GW-00",
    sector: "SEC-03 Central Pit",
    sectorCode: "SEC-03",
    sectorId: 3,
    x: 0.50,
    y: 0.50,
    elevation: 185,
    status: "healthy",
    statusLabel: "Master Gateway",
    battery: 100,
    batteryVoltage: 13.8, // Solar station
    signalDbm: -45,
    signalBars: 4,
    hops: 0,
    pitch: 0.01,
    roll: 0.02,
    crackDisp: 0.05,
    temp: 28.4,
    humidity: 52,
    kalmanNoise: 0.005,
    pinnRisk: 0.02,
    parent: null,
    isGateway: true
  };
  nodes.push(gateway);

  // Generate 249 edge nodes distributed around sector centers
  for (let s = 0; s < 8; s++) {
    const sector = GEOMESH_CONFIG.sectors[s];
    const prefix = sectorPrefixes[s];
    const countInSector = s === 3 ? 35 : (s === 1 ? 32 : 30); // delta & bravo have more nodes

    for (let i = 1; i <= countInSector; i++) {
      if (nodes.length >= 250) break;
      
      const nodeId = `Node ${prefix}-${i}`;
      // Radius around sector center with jitter
      const angle = (i / countInSector) * Math.PI * 2 + (Math.random() * 0.4 - 0.2);
      const dist = 0.04 + Math.random() * 0.12;
      const x = Math.min(0.92, Math.max(0.08, sector.center.x + Math.cos(angle) * dist));
      const y = Math.min(0.90, Math.max(0.10, sector.center.y + Math.sin(angle) * dist));

      // Calculate hops based on distance to gateway (0.5, 0.5)
      const distToGw = Math.hypot(x - 0.5, y - 0.5);
      const hops = Math.min(4, Math.max(1, Math.ceil(distToGw / 0.15)));

      // Signal RSSI based on hops and distance
      const baseRssi = -60 - Math.round(distToGw * 120) + (Math.random() * 8 - 4);

      // Default healthy metrics
      let status = "healthy";
      let statusLabel = "Healthy";
      let battery = Math.floor(65 + Math.random() * 34); // 65% - 99%
      let batteryVoltage = +(3.7 + (battery / 100) * 0.5).toFixed(2);
      let signalDbm = Math.min(-62, baseRssi);
      let pitch = +(Math.random() * 0.35 - 0.15).toFixed(2);
      let roll = +(Math.random() * 0.38 - 0.18).toFixed(2);
      let crackDisp = +(0.1 + Math.random() * 0.6).toFixed(2); // mm
      let pinnRisk = +(0.02 + Math.random() * 0.18).toFixed(2);

      // SPECIFIC KNOWN NODES FOR HIGHER FIDELITY:
      // Node Alpha-1: Healthy benchmark
      if (prefix === "Alpha" && i === 1) {
        battery = 96;
        batteryVoltage = 4.18;
        signalDbm = -68;
        pitch = 0.08;
        roll = 0.12;
        crackDisp = 0.24;
      }
      // Node Bravo-4: Low battery / Weak Signal warning
      else if (prefix === "Bravo" && i === 4) {
        status = "warning";
        statusLabel = "Low Battery";
        battery = 18;
        batteryVoltage = 3.41;
        signalDbm = -108;
        pitch = 1.15;
        roll = 0.94;
        crackDisp = 1.85;
      }
      // Node Charlie-7: Perimeter anomaly / Critical crack breach at Sector 4 fault
      else if ((prefix === "Charlie" && i === 7) || (prefix === "Delta" && i === 4)) {
        status = "alert";
        statusLabel = "CRITICAL ANOMALY";
        battery = 84;
        batteryVoltage = 4.02;
        signalDbm = -88;
        pitch = 3.82;
        roll = 4.15;
        crackDisp = 14.20; // 14.2 mm fissure expansion!
        pinnRisk = 0.94; // Severe subsidence hazard
      }
      // Delta-2: Secondary tilt breach
      else if (prefix === "Delta" && i === 2) {
        status = "alert";
        statusLabel = "CRITICAL ANOMALY";
        battery = 76;
        batteryVoltage = 3.92;
        signalDbm = -94;
        pitch = 4.45;
        roll = 3.90;
        crackDisp = 9.80;
        pinnRisk = 0.88;
      }
      // Additional warning nodes to reach ~7 total warnings
      else if ((prefix === "Echo" && i === 9) || (prefix === "Foxtrot" && i === 3) || 
               (prefix === "Golf" && i === 8) || (prefix === "Alpha" && i === 14) || 
               (prefix === "Hotel" && i === 5) || (prefix === "Bravo" && i === 11)) {
        status = "warning";
        const isWeakSig = i % 2 === 0;
        statusLabel = isWeakSig ? "Weak Signal" : "Low Battery";
        battery = isWeakSig ? 54 : 21;
        batteryVoltage = isWeakSig ? 3.75 : 3.44;
        signalDbm = isWeakSig ? -116 : -92;
        pitch = 1.42;
        roll = 1.18;
        crackDisp = 2.10;
        pinnRisk = 0.45;
      }
      // Offline nodes (5 nodes) to achieve exactly 245/250 active
      else if ((prefix === "Hotel" && i === 18) || (prefix === "Golf" && i === 22) || 
               (prefix === "Foxtrot" && i === 25) || (prefix === "Echo" && i === 27) || 
               (prefix === "Bravo" && i === 28)) {
        status = "offline";
        statusLabel = "Offline";
        battery = 0;
        batteryVoltage = 0.0;
        signalDbm = -135;
        pitch = 0.00;
        roll = 0.00;
        crackDisp = 0.00;
        pinnRisk = 0.00;
      }

      // Signal bars calculation
      let signalBars = 4;
      if (signalDbm < -110) signalBars = 1;
      else if (signalDbm < -98) signalBars = 2;
      else if (signalDbm < -82) signalBars = 3;
      if (status === "offline") signalBars = 0;

      nodes.push({
        id: nodeId,
        code: `${prefix.substring(0, 3).toUpperCase()}-${String(i).padStart(2, '0')}`,
        sector: sector.name,
        sectorCode: sector.code,
        sectorId: sector.id,
        x: +x.toFixed(4),
        y: +y.toFixed(4),
        elevation: Math.round(150 + (1 - y) * 220 + Math.sin(x * 6) * 40),
        status: status,
        statusLabel: statusLabel,
        battery: battery,
        batteryVoltage: batteryVoltage,
        signalDbm: Math.round(signalDbm),
        signalBars: signalBars,
        hops: hops,
        pitch: pitch,
        roll: roll,
        crackDisp: crackDisp,
        temp: +(26 + Math.random() * 7).toFixed(1),
        humidity: Math.round(45 + Math.random() * 25),
        kalmanNoise: +(0.008 + Math.random() * 0.015).toFixed(4),
        pinnRisk: pinnRisk,
        parent: hops === 1 ? "Gateway-Prime" : `Node ${prefix}-${Math.max(1, i - 1)}`,
        isGateway: false
      });
    }
  }

  return nodes;
}

window.GEOMESH_NODES = generateSentinelNodes();
