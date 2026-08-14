import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { Bin } from '../bins/bin.model.js';
import { CollectionTask, ACTIVE_TASK_STATUSES } from '../tasks/collectionTask.model.js';
import { Alert } from '../alerts/alert.model.js';

export const summary = asyncHandler(async (req, res) => {
  const totalBins = await Bin.countDocuments();
  const normalBins = await Bin.countDocuments({ fillStatus: 'normal' });
  const nearFullBins = await Bin.countDocuments({ fillStatus: 'near_full' });
  const criticalBins = await Bin.countDocuments({ priority: 'critical' });
  const activeCollectionTasks = await CollectionTask.countDocuments({ status: { $in: ACTIVE_TASK_STATUSES } });
  const activeAlerts = await Alert.countDocuments({ status: 'open' });
  const avg = await Bin.aggregate([{ $group: { _id: null, avg: { $avg: '$currentFillLevel' } } }]);
  const averageFillLevel = avg && avg[0] && typeof avg[0].avg === 'number' ? Math.round(avg[0].avg * 100) / 100 : 0;

  res.json({ totalBins, normalBins, nearFullBins, criticalBins, activeCollectionTasks, activeAlerts, averageFillLevel });
});
