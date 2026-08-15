import mongoose from 'mongoose';

import { config } from '../../config/index.js';
import { logger } from '../logger/logger.js';

mongoose.set('strictQuery', true);

let listenersAttached = false;

function attachConnectionListeners() {
  if (listenersAttached) {
    return;
  }
  listenersAttached = true;

  mongoose.connection.on('connected', () => logger.info('MongoDB connection established'));
  mongoose.connection.on('error', (err) => logger.error({ err }, 'MongoDB connection error'));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
}

/**
 * Connects to MongoDB. Fails fast (throws) on the initial connection
 * attempt so the process can exit cleanly if the primary operational
 * datastore is unreachable at boot — after that, the driver manages
 * reconnection automatically and connection-state changes are logged.
 */
export async function connectMongo() {
  attachConnectionListeners();

  await mongoose.connect(config.mongo.uri, {
    serverSelectionTimeoutMS: 5000,
  });

  return mongoose.connection;
}

export async function disconnectMongo() {
  await mongoose.disconnect();
}

/**
 * Mongoose connection readyState mapped to a human-readable string:
 * 0 disconnected, 1 connected, 2 connecting, 3 disconnecting.
 */
export function getMongoConnectionStatus() {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return states[mongoose.connection.readyState] ?? 'unknown';
}
