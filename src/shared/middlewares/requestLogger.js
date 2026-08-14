import pinoHttp from 'pino-http';

import { logger } from '../logger/logger.js';

export const requestLogger = pinoHttp({
  logger,
  genReqId: (req) => req.id,
  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) {
      return 'error';
    }
    if (res.statusCode >= 400) {
      return 'warn';
    }
    return 'info';
  },
  // Health checks are noisy (load balancers/orchestrators poll them
  // frequently) and add little value to the log stream.
  autoLogging: {
    ignore: (req) => req.url === '/health',
  },
});
