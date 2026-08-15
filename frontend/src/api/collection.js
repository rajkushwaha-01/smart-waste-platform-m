import { apiClient } from './client.js';

/** GET /api/v1/collection/queue -> { status, count, tasks } */
export async function fetchQueue() {
  const { data } = await apiClient.get('/collection/queue');
  return data.tasks;
}

/** GET /api/v1/collection/route -> { status, route } (503 if the
 * external route service is unavailable — callers should expect this
 * to throw and handle it, not treat it as a bug). */
export async function fetchOptimizedRoute() {
  const { data } = await apiClient.get('/collection/route');
  return data.route;
}

/** POST /api/v1/collection/tasks/:taskId/assign -> { status, task } */
export async function assignTask(taskId) {
  const { data } = await apiClient.post(`/collection/tasks/${encodeURIComponent(taskId)}/assign`);
  return data.task;
}

/** POST /api/v1/collection/tasks/:taskId/complete -> { status, task } */
export async function completeTask(taskId) {
  const { data } = await apiClient.post(`/collection/tasks/${encodeURIComponent(taskId)}/complete`);
  return data.task;
}
