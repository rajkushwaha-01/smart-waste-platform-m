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
 * Queries historical telemetry points for a bin from the time-series DB.
 * Returns an array of points with fields and a `timestamp` (ms since epoch).
 */
export async function queryTelemetry(timeseriesClient, { binId, from, to, limit = 1000 } = {}) {
  if (!timeseriesClient) throw new Error('timeseriesClient is required');

  const where = [];
  if (binId) where.push(`\"binId\"='${String(binId).replace(/'/g, "\\'")}'`);
  if (from) where.push(`time >= ${Number(new Date(from).getTime())}`);
  if (to) where.push(`time <= ${Number(new Date(to).getTime())}`);

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const q = `SELECT time, eventId, fillLevel, battery, temperature, latitude, longitude FROM ${MEASUREMENT} ${whereClause} ORDER BY time ASC LIMIT ${Number(
    limit,
  )}`;

  const res = await timeseriesClient.http.get('/query', {
    params: { db: timeseriesClient.dbName, q, epoch: 'ms' },
  });

  const results = res?.data?.results ?? [];
  if (!results.length || !results[0].series) return [];

  const series = results[0].series[0];
  const { columns, values } = series;
  return values.map((row) => {
    const obj = {};
    columns.forEach((col, idx) => {
      if (col === 'time') obj.timestamp = row[idx];
      else obj[col] = row[idx];
    });
    return obj;
  });
}
