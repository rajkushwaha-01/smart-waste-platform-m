const MEASUREMENT = 'telemetry';

/**
 * Records one historical telemetry reading to the time-series store.
 * Takes the client as a parameter (rather than importing the
 * singleton directly) so this repository — and anything that calls
 * it — stays decoupled from how/where that client is constructed,
 * and easy to unit test with a fake client.
 */
export async function recordTelemetry(
  timeseriesClient,
  { eventId, binId, fillLevel, battery, temperature, latitude, longitude, timestamp },
) {
  await timeseriesClient.writePoint(MEASUREMENT, {
    tags: { binId },
    fields: { eventId, fillLevel, battery, temperature, latitude, longitude },
    timestamp: timestamp ?? Date.now(),
  });
}

/**
 * Reads historical telemetry for one bin, optionally bounded by a
 * time range, newest first. Mongo never holds this history (see
 * upsertFromTelemetry, which only keeps the bin's latest snapshot) —
 * it's read straight from the time-series store on every request.
 */
export async function queryTelemetryHistory(timeseriesClient, { binId, from, to, limit }) {
  return timeseriesClient.query(MEASUREMENT, { tags: { binId }, from, to, limit });
}
