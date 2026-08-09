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
