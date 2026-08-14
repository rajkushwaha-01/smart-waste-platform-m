import { ConflictError, NotFoundError } from '../../shared/errors/AppError.js';
import * as binRepository from '../bins/bin.repository.js';
import { generateRoute } from '../route/route.service.js';
import * as taskRepository from '../tasks/collectionTask.repository.js';

/**
 * A malformed taskId (not a valid Mongo ObjectId) throws Mongoose's
 * CastError from findById — treated the same as "not found" rather
 * than surfacing an internal error, which is the conventional REST
 * behavior for a lookup-by-id that can't possibly match anything.
 */
async function findTaskOrThrow(taskId) {
  let task;
  try {
    task = await taskRepository.findById(taskId);
  } catch (err) {
    if (err.name === 'CastError') {
      throw new NotFoundError(`Collection task not found: ${taskId}`);
    }
    throw err;
  }

  if (!task) {
    throw new NotFoundError(`Collection task not found: ${taskId}`);
  }
  return task;
}

/** Every currently active (not completed/cancelled) collection task,
 * highest priority and oldest first. */
export async function getQueue() {
  return taskRepository.listQueue();
}

export async function assignTask(taskId) {
  const task = await findTaskOrThrow(taskId);

  if (task.status !== 'pending') {
    throw new ConflictError(
      `Task ${taskId} cannot be assigned from status "${task.status}" (must be "pending")`,
    );
  }

  return taskRepository.updateStatus(taskId, 'assigned');
}

export async function completeTask(taskId) {
  const task = await findTaskOrThrow(taskId);

  if (!['assigned', 'in_progress'].includes(task.status)) {
    throw new ConflictError(
      `Task ${taskId} cannot be completed from status "${task.status}" (must be "assigned" or "in_progress")`,
    );
  }

  return taskRepository.updateStatus(taskId, 'completed');
}

/**
 * Builds an optimized collection route from the current queue.
 *
 * This function does NOT compute the route itself — it only resolves
 * each pending task's bin location (CollectionTask stores binId, not
 * coordinates) and hands the enriched list to the route module, which
 * delegates the actual optimization to the external Route
 * Optimization Service. Tasks whose bin record can't be found are
 * skipped rather than failing the whole request.
 *
 * Throws whatever route.service.generateRoute() throws (a
 * RouteClientError subclass) on upstream failure — the controller
 * decides how to respond to the client when that happens.
 */
export async function getOptimizedRoute() {
  const tasks = await taskRepository.listQueue();
  if (tasks.length === 0) {
    return { routeId: null, stops: [], totalDistanceKm: 0, estimatedDurationMinutes: 0 };
  }

  const binIds = [...new Set(tasks.map((task) => task.binId))];
  const bins = await binRepository.findManyByBinIds(binIds);
  const binById = new Map(bins.map((bin) => [bin.binId, bin]));

  const routableTasks = tasks
    .filter((task) => binById.has(task.binId))
    .map((task) => {
      const bin = binById.get(task.binId);
      return {
        taskId: String(task._id),
        binId: task.binId,
        priority: task.priority,
        latitude: bin.location.latitude,
        longitude: bin.location.longitude,
      };
    });

  return generateRoute(routableTasks);
}
