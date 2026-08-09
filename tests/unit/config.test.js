import { describe, expect, it } from 'vitest';

import { config } from '../../src/config/index.js';

describe('config', () => {
  it('exposes a validated, grouped configuration object', () => {
    expect(config.server.port).toBeTypeOf('number');
    expect(config.mongo.uri).toBeTypeOf('string');
    expect(config.kafka.brokers).toBeInstanceOf(Array);
    expect(config.kafka.brokers.length).toBeGreaterThan(0);
    expect(config.timeseries.url).toBeTypeOf('string');
    expect(config.aiService.timeoutMs).toBeTypeOf('number');
    expect(config.routeService.timeoutMs).toBeTypeOf('number');
    expect(config.cors.origin).toBeInstanceOf(Array);
  });

  it('flags production mode correctly', () => {
    expect(config.isProduction).toBe(config.env === 'production');
  });
});
