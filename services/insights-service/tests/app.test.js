import { readFileSync } from 'node:fs';
import request from 'supertest';
import { loadConfig } from '../src/config.js';
import { brokenStore, buildApp } from './helpers.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('app', () => {
  test('GET /health is 200 and reports the cache', async () => {
    const res = await request(buildApp().app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', cache: 'up' });
  });

  test('GET /health stays 200 when the cache database is down', async () => {
    const res = await request(buildApp({ store: brokenStore() }).app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', cache: 'down' });
  });

  test('unknown paths get the error envelope with a new request ID', async () => {
    const res = await request(buildApp().app).get('/api/insights/nothing');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.request_id).toMatch(UUID);
    expect(res.headers['x-request-id']).toBe(res.body.error.request_id);
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  test('the gateway request ID is reused', async () => {
    const id = '0b7a9c55-3c1e-4c55-8f0a-6f2d0e9b1a22';

    const res = await request(buildApp().app).get('/api/insights/locations/towns').set('X-Request-ID', id);

    expect(res.status).toBe(404);
    expect(res.headers['x-request-id']).toBe(id);
    expect(res.body.error.request_id).toBe(id);
  });

  test('unexpected errors are a generic 500 without details', async () => {
    const store = {
      ...brokenStore(),
      get: async () => null,
      put: async () => {},
    };
    // A fallback that is not a list makes the location service throw a TypeError.
    const { app, log } = buildApp({ store, psgcFallback: { regions: 'oops' }, timeouts: { psgc: 1 } });

    const res = await request(app).get('/api/insights/locations/regions');

    expect(res.status).toBe(500);
    expect(res.body.error).toEqual({
      code: 'SERVER_ERROR',
      message: 'Something went wrong. Please try again later.',
      request_id: expect.any(String),
    });
    expect(log.lines.join('\n')).toContain('"error"');
  });
});

describe('config', () => {
  test('defaults to port 8002, the public PSGC API and no cache database', () => {
    const config = loadConfig({});

    expect(config.port).toBe(8002);
    expect(config.psgcUrl).toBe('https://psgc.gitlab.io/api');
    expect(config.cacheDb).toBeNull();
  });

  test('reads the cache database settings', () => {
    const config = loadConfig({ CACHE_DB_USER: 'insights', CACHE_DB_PASSWORD: 'x', CACHE_DB_PORT: '3307' });

    expect(config.cacheDb).toEqual({ host: '127.0.0.1', port: 3307, database: 'insights_cache', user: 'insights', password: 'x' });
  });

  test('rejects URLs without a scheme', () => {
    expect(() => loadConfig({ PSGC_URL: 'psgc.gitlab.io/api' })).toThrow(/PSGC_URL must be an http\(s\) URL/);
  });
});

describe('bundled PSGC fallback', () => {
  const fallback = JSON.parse(readFileSync(new URL('../src/data/psgc-fallback.json', import.meta.url), 'utf8'));
  const items = Object.values(fallback).flat();

  test('has every region with its province list, and NCR cities', () => {
    expect(fallback.regions.length).toBeGreaterThanOrEqual(17);
    for (const region of fallback.regions) {
      expect(fallback).toHaveProperty([`provinces:${region.code}`]);
    }
    const ncr = fallback['cities:1300000000'];
    expect(ncr.map((city) => city.name)).toEqual(expect.arrayContaining(['Quezon City', 'City of Manila', 'City of Makati']));
    expect(ncr.length).toBeGreaterThanOrEqual(17);
  });

  test('uses 10-digit codes and known levels everywhere', () => {
    for (const item of items) {
      expect(item.code).toMatch(/^\d{10}$/);
      expect(['region', 'province', 'city', 'municipality']).toContain(item.level);
    }
  });
});
