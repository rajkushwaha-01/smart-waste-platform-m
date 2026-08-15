import { Alert } from './alert.model.js';

export async function createAlert({ binId, type, severity, message }) {
  return Alert.create({ binId, type, severity, message, status: 'open' });
}

export async function findOpenAlert(binId, type) {
  return Alert.findOne({ binId, type, status: 'open' });
}

export async function resolveAlert(alertId) {
  return Alert.findByIdAndUpdate(alertId, { $set: { status: 'resolved' } }, { new: true });
}

export async function list({ status, severity } = {}) {
  const filter = {};
  if (status) {
    filter.status = status;
  }
  if (severity) {
    filter.severity = severity;
  }
  return Alert.find(filter).sort({ createdAt: -1 });
}

export async function countOpen() {
  return Alert.countDocuments({ status: 'open' });
}
