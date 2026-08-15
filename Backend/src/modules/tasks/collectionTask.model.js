import mongoose from 'mongoose';

export const TASK_STATUS = ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'];
export const TASK_PRIORITY = ['low', 'medium', 'high', 'critical'];

// Statuses that count as "still active" for a bin — used both by the
// unique index below and by repository queries, so they stay in sync.
export const ACTIVE_TASK_STATUSES = ['pending', 'assigned', 'in_progress'];

const collectionTaskSchema = new mongoose.Schema(
  {
    binId: { type: String, required: true, trim: true },
    priority: { type: String, enum: TASK_PRIORITY, default: 'low' },
    reason: { type: String, required: true, trim: true },
    status: { type: String, enum: TASK_STATUS, default: 'pending' },
    assignedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }, // `createdAt` from the spec comes from this
);

collectionTaskSchema.index({ binId: 1, status: 1 });
collectionTaskSchema.index({ status: 1, priority: 1 });
collectionTaskSchema.index({ createdAt: -1 });

// Idempotency at the data layer: a bin can only have one ACTIVE
// collection task at a time. Combined with eventId-based telemetry
// dedup, this means even if the decision engine is asked twice to
// "create a task for bin X", only one active task ever exists.
collectionTaskSchema.index(
  { binId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ACTIVE_TASK_STATUSES } },
    name: 'uniq_active_task_per_bin',
  },
);

export const CollectionTask = mongoose.model('CollectionTask', collectionTaskSchema);
