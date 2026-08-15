import { requestRouteGeneration } from './route.client.js';

export {
  RouteClientError,
  RouteTimeoutError,
  RouteNetworkError,
  RouteRequestError,
  RouteServerError,
  RouteMalformedResponseError,
} from './route.client.js';

/**
 * ASSUMED CONTRACT (see route.client.js) — these two mapping
 * functions are the ONLY place that external shape is assumed.
 * `generateRoute()` below takes/returns the app's own domain shapes;
 * update these two functions (and ROUTE_GENERATE_PATH in
 * route.client.js) once the real contract is confirmed — no other
 * module needs to change.
 */
function toRouteRequest(collectionTasks) {
  return {
    tasks: collectionTasks.map((task) => ({
      taskId: task.taskId,
      binId: task.binId,
      latitude: task.latitude,
      longitude: task.longitude,
      priority: task.priority,
    })),
  };
}

function toDomainRoute(raw) {
  return {
    routeId: raw.routeId ?? null,
    stops: raw.stops.map((stop) => ({
      taskId: stop.taskId ?? null,
      binId: stop.binId,
      sequence: stop.sequence ?? null,
      latitude: stop.latitude ?? null,
      longitude: stop.longitude ?? null,
      estimatedArrival: stop.estimatedArrival ?? null,
    })),
    totalDistanceKm: raw.totalDistanceKm ?? null,
    estimatedDurationMinutes: raw.estimatedDurationMinutes ?? null,
  };
}

/**
 * Internal entry point the rest of the app should call to turn a set
 * of pending collection tasks into an optimized route. Takes/returns
 * the app's own domain shapes; the external Route Optimization
 * Service's request/response format is fully isolated inside this
 * module and route.client.js.
 *
 * IMPORTANT: this function does NOT perform any route optimization,
 * distance calculation, or geographic computation itself — it only
 * shapes the request, delegates to the external service via
 * route.client.js, and shapes the response. All actual optimization
 * happens in the external service.
 *
 * `collectionTasks` must already carry each task's bin location
 * (taskId, binId, latitude, longitude, priority) — resolving that
 * from the collection queue + bin records is the caller's job (see
 * modules/collection/collection.service.js), keeping this module
 * free of any MongoDB/task-repository dependency.
 *
 * Throws a RouteClientError (see route.client.js) on failure —
 * callers decide how to respond (e.g. the collection controller
 * returns 503) when that happens; the backend itself stays up.
 */
export async function generateRoute(collectionTasks) {
  if (!Array.isArray(collectionTasks) || collectionTasks.length === 0) {
    return { routeId: null, stops: [], totalDistanceKm: 0, estimatedDurationMinutes: 0 };
  }

  const requestPayload = toRouteRequest(collectionTasks);
  const raw = await requestRouteGeneration(requestPayload);
  return toDomainRoute(raw);
}
