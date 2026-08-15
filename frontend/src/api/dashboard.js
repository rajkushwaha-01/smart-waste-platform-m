import { apiClient } from './client.js';

/** GET /api/v1/dashboard/summary -> the summary object directly
 * (this one endpoint has no {status, ...} envelope). */
export async function fetchDashboardSummary() {
  const { data } = await apiClient.get('/dashboard/summary');
  return data;
}
