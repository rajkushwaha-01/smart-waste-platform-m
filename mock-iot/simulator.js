import axios from 'axios';

const API_BASE = process.env.API_BASE || 'http://localhost:3000';
const TELEMETRY_PATH = `${API_BASE}/api/v1/telemetry`;

const bins = Array.from({ length: 10 }, (_, i) => `BIN-${String(i + 1).padStart(3, '0')}`);
const fillLevels = bins.map(() => 50 + Math.floor(Math.random() * 10));

function makeEvent(binId, fillLevel) {
  return {
    eventId: `${Date.now()}-${binId}-${Math.random().toString(36).slice(2, 8)}`,
    binId,
    timestamp: new Date().toISOString(),
    fillLevel,
    battery: 80 + Math.floor(Math.random() * 20),
    temperature: 18 + Math.floor(Math.random() * 8),
    latitude: 0,
    longitude: 0,
  };
}

async function sendEvent(evt) {
  try {
    const res = await axios.post(TELEMETRY_PATH, evt, { timeout: 5000 });
    console.log(`sent ${evt.binId} ${evt.fillLevel} -> ${res.status}`);
  } catch (err) {
    console.error('send failed', err?.response?.status || err.message);
  }
}

async function tick() {
  for (let i = 0; i < bins.length; i++) {
    // Gradual increase with small variability
    fillLevels[i] = Math.min(100, fillLevels[i] + 3 + Math.floor(Math.random() * 2));
    const evt = makeEvent(bins[i], fillLevels[i]);
    // fire-and-forget but await to avoid overwhelming the API
    // send in serial with small delay
    await sendEvent(evt);
    await new Promise((r) => setTimeout(r, 100));
  }
}

console.log('Mock IoT simulator starting, sending to', TELEMETRY_PATH);
tick();
const interval = setInterval(tick, 5000);

process.on('SIGINT', () => {
  clearInterval(interval);
  console.log('Simulator exiting');
  process.exit(0);
});
