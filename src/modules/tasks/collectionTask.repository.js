import { ACTIVE_TASK_STATUSES, CollectionTask } from './collectionTask.model.js';

export async function createTask({ binId, priority, reason }) {
  return CollectionTask.create({ binId, priority, reason, status: 'pending' });
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

export async function list({ status, priority } = {}) {
  const filter = {};
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  return CollectionTask.find(filter).sort({ createdAt: -1 });
}
