import { ACTIVE_TASK_STATUSES, CollectionTask } from './collectionTask.model.js';

// Not a data-layer concept (priority is just a string enum in the
// schema) — this is purely how the collection queue orders its
// output, kept here since it's the one place that needs it.
const QUEUE_PRIORITY_WEIGHT = { critical: 4, high: 3, medium: 2, low: 1 };

export async function createTask({ binId, priority, reason }) {
  return CollectionTask.create({ binId, priority, reason, status: 'pending' });
}

export async function findById(taskId) {
  return CollectionTask.findById(taskId);
}

export async function findActiveTaskForBin(binId) {
  return CollectionTask.findOne({ binId, status: { $in: ACTIVE_TASK_STATUSES } });
}

export async function updateStatus(taskId, status) {
  const update = { status };
  if (status === 'assigned') update.assignedAt = new Date();
  if (status === 'completed') update.completedAt = new Date();
  return CollectionTask.findByIdAndUpdate(taskId, { $set: update }, { new: true });
}

/**
 * The collection queue: every active (not yet completed/cancelled)
 * task, highest priority first and oldest-first within the same
 * priority (FIFO). Sorted in-memory rather than via a Mongo query
 * sort — priority is a string enum ('low'..'critical') that doesn't
 * sort correctly lexicographically, and the active-task set is small
 * by construction (at most one per bin, see the model's unique
 * active-task-per-bin index).
 */
export async function listQueue() {
  const tasks = await CollectionTask.find({ status: { $in: ACTIVE_TASK_STATUSES } }).lean();

  return tasks.sort((a, b) => {
    const weightDiff =
      (QUEUE_PRIORITY_WEIGHT[b.priority] ?? 0) - (QUEUE_PRIORITY_WEIGHT[a.priority] ?? 0);
    if (weightDiff !== 0) return weightDiff;
    return new Date(a.createdAt) - new Date(b.createdAt);
  });
}

export async function list({ status, priority } = {}) {
  const filter = {};
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  return CollectionTask.find(filter).sort({ createdAt: -1 });
}
