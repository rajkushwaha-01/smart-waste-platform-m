import { ServiceUnavailableError } from '../../shared/errors/AppError.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { RouteClientError } from '../route/route.service.js';
import * as collectionService from './collection.service.js';

export const getQueue = asyncHandler(async (req, res) => {
  const tasks = await collectionService.getQueue();
  res.status(200).json({ status: 'ok', count: tasks.length, tasks });
});

/**
 * The route service being down, slow, or misbehaving must never
 * crash or hang this endpoint — any RouteClientError (timeout,
 * network failure, 4xx/5xx from the upstream service, or a malformed
 * response) is translated into a 503 the client can act on. Anything
 * else (e.g. a Mongo error) is left to propagate to the centralized
 * error handler as normal.
 */
export const getOptimizedRoute = asyncHandler(async (req, res) => {
  let route;
  try {
    route = await collectionService.getOptimizedRoute();
  } catch (err) {
    if (err instanceof RouteClientError) {
      throw new ServiceUnavailableError('Route optimization is temporarily unavailable', {
        reason: err.name,
        message: err.message,
      });
    }
    throw err;
  }

  res.status(200).json({ status: 'ok', route });
});

export const assignTask = asyncHandler(async (req, res) => {
  const task = await collectionService.assignTask(req.params.taskId);
  res.status(200).json({ status: 'ok', task });
});

export const completeTask = asyncHandler(async (req, res) => {
  const task = await collectionService.completeTask(req.params.taskId);
  res.status(200).json({ status: 'ok', task });
});
