import { apiClient } from './client.js';

/** GET /api/v1/alerts?status=&severity= -> { status, count, alerts } */
export async function fetchAlerts({ status, severity } = {}) {
  const { data } = await apiClient.get('/alerts', { params: { status, severity } });
  return data.alerts;
}
