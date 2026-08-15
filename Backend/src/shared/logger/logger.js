import pino from 'pino';

import { config } from '../../config/index.js';

export const logger = pino({
  level: config.isProduction ? 'info' : 'debug',
  base: { service: 'smart-waste-backend' },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token', '*.apiKey'],
    censor: '[REDACTED]',
  },
  transport: config.isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
});
