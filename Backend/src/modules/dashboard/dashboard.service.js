import * as alertRepository from '../alerts/alert.repository.js';
import * as binRepository from '../bins/bin.repository.js';
import * as taskRepository from '../tasks/collectionTask.repository.js';

/**
 * The spec's "criticalBins" is this dashboard's label for the bin
 * fillStatus 'full' — the decision engine's most urgent fill
 * category (see BIN_FILL_STATUS in bin.model.js and the thresholds
 * in modules/decision/decisionEngine.js, which are the actual source
 * of truth for what "full" means). There is no separate, stricter
 * "critical" fill tier — full/critical are the same bin state, just
 * named differently between the internal model and this API.
 */
export async function getSummary() {
  const [binStats, activeAlerts, activeCollectionTasks] = await Promise.all([
    binRepository.getSummaryStats(),
    alertRepository.countOpen(),
    taskRepository.countActive(),
  ]);

  return {
    totalBins: binStats.totalBins,
    normalBins: binStats.normalBins,
    nearFullBins: binStats.nearFullBins,
    criticalBins: binStats.fullBins,
    activeCollectionTasks,
    activeAlerts,
    averageFillLevel: Math.round(binStats.averageFillLevel * 100) / 100,
  };
}
