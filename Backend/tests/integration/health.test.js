import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';

describe('GET /health', () => {
  const app = createApp();

  it('returns 200 with an ok status and dependency info', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('uptimeSeconds');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body.dependencies).toHaveProperty('mongodb');
    expect(res.body.dependencies).toHaveProperty('kafka');
    expect(res.body.dependencies).toHaveProperty('timeseriesDb');
    expect(res.body.dependencies).toHaveProperty('aiService');
    expect(res.body.dependencies).toHaveProperty('routeService');
  });
});

describe('unmatched routes', () => {
  const app = createApp();

  it('returns a centralized 404 error shape', async () => {
    const res = await request(app).get('/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.status).toBe('error');
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
