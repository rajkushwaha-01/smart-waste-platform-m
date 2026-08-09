import { logger } from '../../shared/logger/logger.js';
import { updatePriority } from '../bins/bin.repository.js';
import { createAlert, findOpenAlert } from '../alerts/alert.repository.js';
import { createTask, findActiveTaskForBin } from '../tasks/collectionTask.repository.js';

// Not specified by the product spec — chosen as sensible MVP
// defaults. Exported so they're easy to find/tune from one place
// rather than buried in the logic below.
export const OVERFLOW_FILL_THRESHOLD = 90;
export const HIGH_FILL_THRESHOLD = 75;
export const LOW_BATTERY_THRESHOLD = 15;
export const HIGH_OVERFLOW_RISK_THRESHOLD = 0.7;

function derivePriority({ event, prediction }) {
  const predictedRisk = prediction?.overflowRiskScore ?? 0;

  if (event.fillLevel >= OVERFLOW_FILL_THRESHOLD || predictedRisk >= HIGH_OVERFLOW_RISK_THRESHOLD) {
    return 'critical';
  }
  if (event.fillLevel >= HIGH_FILL_THRESHOLD) {
    return 'high';
  }
  if (event.battery <= LOW_BATTERY_THRESHOLD) {
    return 'medium';
  }
  return 'low';
}

function isOverflowing({ event, prediction }) {
  return (
    event.fillLevel >= OVERFLOW_FILL_THRESHOLD ||
    (prediction?.overflowRiskScore ?? 0) >= HIGH_OVERFLOW_RISK_THRESHOLD
  );
}

/**
 * Turns one telemetry reading (plus an AI prediction, which may be
 * `null` if the AI service call failed — the pipeline degrades to
 * telemetry-only thresholds rather than blocking) into concrete state
 * changes: bin priority, alerts, and collection tasks.
 *
 * Alert/task creation is idempotent at the data layer (the unique
 * open-alert-per-type and unique-active-task-per-bin indexes), so
 * evaluating the same bin/telemetry more than once is always safe —
 * it just no-ops on the second call instead of duplicating state.
 */
export async function evaluateTelemetry({
  event,
  prediction = null,
  bin = null,
  deps = {},
}) {
  const {
    updateBinPriority = updatePriority,
    createAlertRecord = createAlert,
    findOpenAlertRecord = findOpenAlert,
    createTaskRecord = createTask,
    findActiveTaskRecord = findActiveTaskForBin,
  } = deps;

  const priority = derivePriority({ event, prediction });
  const actions = [];

  if (!bin || bin.priority !== priority) {
    await updateBinPriority(event.binId, priority);
    actions.push('priority_updated');
  }

  if (isOverflowing({ event, prediction })) {
    const existingAlert = await findOpenAlertRecord(event.binId, 'overflow');
    if (!existingAlert) {
      await createAlertRecord({
        binId: event.binId,
        type: 'overflow',
        severity: 'critical',
        message: `Bin ${event.binId} overflow risk: fillLevel=${event.fillLevel}%, predictedRisk=${
          prediction?.overflowRiskScore ?? 'unavailable'
        }`,
      });
      actions.push('overflow_alert_created');
    }

    const activeTask = await findActiveTaskRecord(event.binId);
    if (!activeTask) {
      await createTaskRecord({
        binId: event.binId,
        priority: 'critical',
        reason: 'Overflow risk detected from telemetry/AI prediction',
      });
      actions.push('collection_task_created');
    }
  }

  if (event.battery <= LOW_BATTERY_THRESHOLD) {
    const existingAlert = await findOpenAlertRecord(event.binId, 'battery_low');
    if (!existingAlert) {
      await createAlertRecord({
        binId: event.binId,
        type: 'battery_low',
        severity: 'medium',
        message: `Bin ${event.binId} battery at ${event.battery}%`,
      });
      actions.push('battery_alert_created');
    }
  }

  logger.info(
    { binId: event.binId, priority, actions, hadPrediction: prediction !== null },
    'Decision engine evaluated telemetry',
  );

  return { priority, actions };
}
