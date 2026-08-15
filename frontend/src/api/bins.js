import { apiClient } from './client.js';

/** GET /api/v1/bins?status=&priority= -> { status, count, bins } */
export async function fetchBins({ status, priority } = {}) {
  const { data } = await apiClient.get('/bins', { params: { status, priority } });
  return data.bins;
}

/** GET /api/v1/bins/:binId -> { status, bin } */
export async function fetchBin(binId) {
  const { data } = await apiClient.get(`/bins/${encodeURIComponent(binId)}`);
  return data.bin;
}

/** GET /api/v1/bins/:binId/telemetry?from=&to=&limit= -> { status, binId, count, telemetry } */
export async function fetchBinTelemetry(binId, { from, to, limit } = {}) {
  const { data } = await apiClient.get(`/bins/${encodeURIComponent(binId)}/telemetry`, {
    params: { from, to, limit },
  });
  return data.telemetry;
}
