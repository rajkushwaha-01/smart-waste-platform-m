import { logger } from '../../shared/logger/logger.js';
import { applyDecisionState } from '../bins/bin.repository.js';
import { createAlert, findOpenAlert } from '../alerts/alert.repository.js';
import { createTask, findActiveTaskForBin } from '../tasks/collectionTask.repository.js';

// Fill-level thresholds and the battery threshold come directly from
// the product spec. Everything else below (temperature, the AI
// escalation thresholds, the "critical bin" fill threshold) was not
// specified — these are documented MVP defaults, exported so they're
// easy to find/tune from one place.
export const FULL_FILL_THRESHOLD = 80; // fillLevel >= 80 -> full / high priority
export const NEAR_FULL_FILL_THRESHOLD = 60; // fillLevel >= 60 -> near_full / medium priority
export const LOW_BATTERY_THRESHOLD = 20; // battery < 20 -> maintenanceRequired + alert

// Not specified by the product spec — chosen as a sensible MVP
// default for waste bins (heat/fire risk for organic/mixed waste).
export const HIGH_TEMPERATURE_THRESHOLD_CELSIUS = 45;

// Not specified by the product spec — thresholds for treating an AI
// prediction as a strong enough signal to escalate the decision, per
// the worked example (predictedFillLevel=95, overflowProbability=0.89
// -> HIGH priority, collectionRequired=true).
export const AI_PREDICTED_FULL_THRESHOLD = 80;
export const AI_HIGH_OVERFLOW_PROBABILITY_THRESHOLD = 0.8;

// Not specified by the product spec — a bin already at/above this
// fill level right now (as opposed to AI-predicted) is flagged with
// its own "critical_bin" alert, distinct from the AI-predicted
// overflow risk alert.
export const CRITICAL_FILL_THRESHOLD = 95;

const PRIORITY_BY_FILL_STATUS = { full: 'high', near_full: 'medium', normal: 'low' };

function deriveFillStatus(fillLevel) {
  if (fillLevel >= FULL_FILL_THRESHOLD) {
    return 'full';
  }
  if (fillLevel >= NEAR_FULL_FILL_THRESHOLD) {
    return 'near_full';
  }
  return 'normal';
}

/** True when the AI prediction alone is a strong enough overflow
 * signal to escalate the decision, independent of the current
 * fillLevel-based classification. */
function isAiOverflowSignal(prediction) {
  if (!prediction) {
    return false;
  }
  return (
    prediction.predictedFillLevel >= AI_PREDICTED_FULL_THRESHOLD &&
    prediction.overflowProbability >= AI_HIGH_OVERFLOW_PROBABILITY_THRESHOLD
  );
}

/**
 * Combines the current-telemetry fill classification with an AI
 * prediction. The AI prediction can only ever escalate the outcome
 * (bump fillStatus/priority up to full/high and require collection)
 * — it never downgrades a reading that's already telemetry-full.
 */
function deriveFillDecision({ event, prediction }) {
  const telemetryFillStatus = deriveFillStatus(event.fillLevel);
  const aiEscalated = telemetryFillStatus !== 'full' && isAiOverflowSignal(prediction);
  const fillStatus = aiEscalated ? 'full' : telemetryFillStatus;

  return {
    fillStatus,
    priority: PRIORITY_BY_FILL_STATUS[fillStatus],
    collectionRequired: fillStatus === 'full',
    aiEscalated,
  };
}

/**
 * Turns one telemetry reading (plus an AI prediction, which may be
 * `null` if the AI service call failed — the pipeline degrades to
 * telemetry-only thresholds rather than blocking) into concrete state
 * changes: bin fill status/priority/maintenance flag, alerts, and
 * collection tasks.
 *
 * Decision rules (see thresholds above):
 *  - fillLevel >= 80          -> full / HIGH priority
 *  - fillLevel >= 60          -> near_full / MEDIUM priority
 *  - fillLevel < 60           -> normal / LOW priority
 *  - battery < 20             -> maintenanceRequired + battery_low alert
 *  - temperature too high     -> temperature_anomaly alert
 *  - AI prediction strongly indicates overflow (predictedFillLevel
 *    >= 80 and overflowProbability >= 0.8) -> escalates to full/HIGH
 *    and collectionRequired = true, even if the current fillLevel
 *    alone wouldn't have crossed the full threshold, plus its own
 *    overflow alert
 *  - fillLevel already at/above the critical threshold right now
 *    -> critical_bin alert (distinct from the AI-predicted case)
 *
 * This module has no knowledge of HTTP or Kafka — it only takes
 * plain telemetry/prediction/bin objects and repository functions,
 * so it's independently unit-testable and reusable from any caller.
 *
 * Alert/task creation is idempotent at the data layer (the unique
 * open-alert-per-type and unique-active-task-per-bin indexes), so
 * evaluating the same bin/telemetry more than once is always safe —
 * it just no-ops on the second call instead of duplicating state.
 */
export async function evaluateTelemetry({ event, prediction = null, bin = null, deps = {} }) {
  const {
    applyBinDecisionState = applyDecisionState,
    createAlertRecord = createAlert,
    findOpenAlertRecord = findOpenAlert,
    createTaskRecord = createTask,
    findActiveTaskRecord = findActiveTaskForBin,
  } = deps;

  const maintenanceRequired = event.battery < LOW_BATTERY_THRESHOLD;
  const { fillStatus, priority, collectionRequired, aiEscalated } = deriveFillDecision({
    event,
    prediction,
  });

  const actions = [];

  const stateChanged =
    !bin ||
    bin.fillStatus !== fillStatus ||
    bin.priority !== priority ||
    bin.maintenanceRequired !== maintenanceRequired ||
    bin.collectionRequired !== collectionRequired;

  if (stateChanged) {
    await applyBinDecisionState(event.binId, {
      fillStatus,
      priority,
      maintenanceRequired,
      collectionRequired,
    });
    actions.push('bin_state_updated');
  }

  // --- Collection task (fillLevel/AI-driven) ---
  if (collectionRequired) {
    const activeTask = await findActiveTaskRecord(event.binId);
    if (!activeTask) {
      await createTaskRecord({
        binId: event.binId,
        priority,
        reason: aiEscalated
          ? `AI-predicted overflow risk (predictedFillLevel=${prediction.predictedFillLevel}%, overflowProbability=${prediction.overflowProbability})`
          : `Bin fill level at ${event.fillLevel}% (full)`,
      });
      actions.push('collection_task_created');
    }
  }

  // --- Overflow risk alert (AI-predicted) ---
  if (isAiOverflowSignal(prediction)) {
    const existingAlert = await findOpenAlertRecord(event.binId, 'overflow');
    if (!existingAlert) {
      await createAlertRecord({
        binId: event.binId,
        type: 'overflow',
        severity: 'critical',
        message: `Bin ${event.binId} AI-predicted overflow risk: predictedFillLevel=${prediction.predictedFillLevel}%, overflowProbability=${prediction.overflowProbability}`,
      });
      actions.push('overflow_alert_created');
    }
  }

  // --- Critical bin alert (current, not predicted, extreme fill) ---
  if (event.fillLevel >= CRITICAL_FILL_THRESHOLD) {
    const existingAlert = await findOpenAlertRecord(event.binId, 'critical_bin');
    if (!existingAlert) {
      await createAlertRecord({
        binId: event.binId,
        type: 'critical_bin',
        severity: 'critical',
        message: `Bin ${event.binId} is critically full at ${event.fillLevel}%`,
      });
      actions.push('critical_bin_alert_created');
    }
  }

  // --- Low battery alert ---
  if (maintenanceRequired) {
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

  // --- High temperature alert ---
  if (event.temperature >= HIGH_TEMPERATURE_THRESHOLD_CELSIUS) {
    const existingAlert = await findOpenAlertRecord(event.binId, 'temperature_anomaly');
    if (!existingAlert) {
      await createAlertRecord({
        binId: event.binId,
        type: 'temperature_anomaly',
        severity: 'high',
        message: `Bin ${event.binId} temperature at ${event.temperature}°C`,
      });
      actions.push('temperature_alert_created');
    }
  }

  logger.info(
    {
      eventId: event.eventId,
      binId: event.binId,
      fillStatus,
      priority,
      maintenanceRequired,
      collectionRequired,
      aiEscalated,
      actions,
      hadPrediction: prediction !== null,
    },
    'Decision engine evaluated telemetry',
  );

  return { fillStatus, priority, maintenanceRequired, collectionRequired, actions };
}
