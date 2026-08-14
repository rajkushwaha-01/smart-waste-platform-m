import axios from 'axios';

/**
 * Mock IoT simulator — a DEVELOPMENT CLIENT ONLY.
 *
 * This script knows nothing about Kafka, MongoDB, the AI service, the
 * decision engine, or any other backend internals. It behaves exactly
 * like a real IoT device would: it POSTs telemetry readings to the
 * one official ingestion endpoint and nothing else. The backend has
 * no special-cased "mock mode" anywhere — this script's traffic is
 * architecturally indistinguishable from a real sensor's:
 *
 *   Real IoT  \
 *              > POST /api/v1/telemetry -> Kafka -> normal pipeline
 *   Mock IoT  /
 *
 * Run with `npm run mock:iot`.
 */

const TARGET_URL = process.env.MOCK_IOT_TARGET_URL ?? 'http://localhost:4000/api/v1/telemetry';
const INTERVAL_MS = Number(process.env.MOCK_IOT_INTERVAL_MS ?? 5000);
const BIN_COUNT = 10;

// Arbitrary demo anchor point; bins are scattered a small, fixed
// offset around it so they land at distinct map locations.
const CITY_CENTER = { latitude: 23.2599, longitude: 77.4126 };

// Unique per simulator run, so eventIds stay globally unique even
// across restarts (rather than only within a single run's counter) —
// belt-and-braces on top of the backend's own eventId idempotency.
const RUN_ID = Date.now().toString(36);

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

/**
 * One simulated device's persistent, evolving state. Keeping this
 * across ticks (rather than re-rolling random values every time) is
 * what produces gradual, realistic sequences like
 * 70 -> 73 -> 76 -> 79 -> 82 instead of noisy jumps.
 */
function createBinState(index) {
  const binId = `BIN-${String(index + 1).padStart(3, '0')}`;
  return {
    binId,
    eventSeq: 0,
    fillLevel: Math.round(randomBetween(10, 35)),
    battery: Math.round(randomBetween(70, 100)),
    temperature: randomBetween(22, 30),
    location: {
      latitude: CITY_CENTER.latitude + (index - BIN_COUNT / 2) * 0.01,
      longitude: CITY_CENTER.longitude + (index % 3) * 0.01,
    },
  };
}

/** Advances one bin's state by a single realistic tick and returns
 * the telemetry payload for it. */
function stepBinState(state) {
  // Fill level climbs gradually (~+2..+4 per tick). Once it's
  // effectively full, a "collection" empties it back out — a
  // realistic fill/empty cycle rather than climbing forever.
  if (state.fillLevel >= 97) {
    state.fillLevel = Math.round(randomBetween(5, 15));
  } else {
    state.fillLevel = clamp(Math.round(state.fillLevel + randomBetween(2, 4)), 0, 100);
  }

  // Battery drains slowly; very occasionally "serviced" back to full,
  // the way a technician swapping/recharging it in the field would.
  if (state.battery <= 3) {
    state.battery = 100;
  } else {
    state.battery = clamp(round1(state.battery - randomBetween(0.1, 0.4)), 0, 100);
  }

  // Small random walk around the current temperature, with a rare
  // spike so the high-temperature alert path gets exercised too.
  const spike = Math.random() < 0.03 ? randomBetween(8, 15) : 0;
  state.temperature = clamp(round1(state.temperature + randomBetween(-0.6, 0.6) + spike), -10, 70);

  state.eventSeq += 1;

  return {
    eventId: `${state.binId}-${RUN_ID}-${String(state.eventSeq).padStart(6, '0')}`,
    binId: state.binId,
    fillLevel: state.fillLevel,
    battery: state.battery,
    temperature: state.temperature,
    latitude: state.location.latitude,
    longitude: state.location.longitude,
    timestamp: new Date().toISOString(),
  };
}

async function sendTelemetry(client, payload) {
  try {
    const res = await client.post(TARGET_URL, payload);
    console.log(
      `[mock-iot] ${payload.binId} fill=${payload.fillLevel}% battery=${payload.battery}% temp=${payload.temperature}C -> ${res.status}`,
    );
  } catch (err) {
    // A real device fleet doesn't stop when one sensor's upload
    // fails or the network is briefly down — neither does this: log
    // and keep ticking, the next reading is sent on the next tick.
    if (err.response) {
      console.error(
        `[mock-iot] ${payload.binId} rejected: ${err.response.status} ${JSON.stringify(err.response.data)}`,
      );
    } else {
      console.error(`[mock-iot] ${payload.binId} request failed: ${err.message}`);
    }
  }
}

function main() {
  const client = axios.create({ timeout: 5000 });
  const bins = Array.from({ length: BIN_COUNT }, (_, index) => createBinState(index));

  console.log(
    `[mock-iot] simulating ${BIN_COUNT} bins -> ${TARGET_URL} every ${INTERVAL_MS}ms (Ctrl+C to stop)`,
  );

  const tick = () => {
    // Each bin is an independent device — its request isn't
    // serialized against the others.
    for (const bin of bins) {
      sendTelemetry(client, stepBinState(bin));
    }
  };

  tick();
  const intervalHandle = setInterval(tick, INTERVAL_MS);

  const stop = () => {
    clearInterval(intervalHandle);
    console.log('[mock-iot] stopped');
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main();
