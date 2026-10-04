import request from 'supertest';
import { buildApp, deadUrl, json, startUpstream } from './helpers.js';

describe('upstream failures', () => {
  let upstreams = [];

  const start = async (handler) => {
    const upstream = await startUpstream(handler);
    upstreams.push(upstream);
    return upstream;
  };

  afterEach(async () => {
    await Promise.all(upstreams.map((upstream) => upstream.close()));
    upstreams = [];
  });

  test('Core not running → 503 SERVICE_UNAVAILABLE', async () => {
    const app = buildApp({ coreUrl: await deadUrl(), insightsUrl: await deadUrl() });

    const res = await request(app).get('/api/categories');

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(res.body.error.request_id).toBe(res.headers['x-request-id']);
  });

  test('slow Core → 504 UPSTREAM_TIMEOUT', async () => {
    const core = await start(() => {
      /* never answers */
    });
    const app = buildApp({ coreUrl: core.url, insightsUrl: core.url, timeouts: { core: 200 } });

    const res = await request(app).get('/api/job-postings');

    expect(res.status).toBe(504);
    expect(res.body.error.code).toBe('UPSTREAM_TIMEOUT');
  });

  test('slow Insights uses its own timeout and does not affect Core', async () => {
    const insights = await start(() => {
      /* never answers */
    });
    const core = await start((req, res) => json(res, 200, { ok: true }));
    const app = buildApp({ coreUrl: core.url, insightsUrl: insights.url, timeouts: { insights: 200 } });

    const slow = await request(app).get('/api/insights/job-postings/1');
    const fast = await request(app).get('/api/categories');

    expect(slow.status).toBe(504);
    expect(fast.status).toBe(200);
  });

  test('connection dropped mid-request → 502 UPSTREAM_ERROR', async () => {
    const core = await start((req) => req.socket.destroy());
    const app = buildApp({ coreUrl: core.url, insightsUrl: core.url });

    const res = await request(app).get('/api/categories');

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('UPSTREAM_ERROR');
  });
});

describe('rate limit', () => {
  test('requests over the per-minute limit get 429 RATE_LIMITED with Retry-After', async () => {
    const core = await startUpstream((req, res) => json(res, 200, { ok: true }));
    const app = buildApp({ coreUrl: core.url, insightsUrl: core.url, rateLimitPerMin: 3 });

    for (let i = 0; i < 3; i++) {
      expect((await request(app).get('/api/categories')).status).toBe(200);
    }
    const limited = await request(app).get('/api/categories');
    await core.close();

    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    expect(core.requests).toHaveLength(3);
  });
});

describe('/api/health', () => {
  test('ok when Core and Insights are up', async () => {
    const core = await startUpstream((req, res) => (req.url === '/up' ? json(res, 200, {}) : json(res, 404, {})));
    const insights = await startUpstream((req, res) => (req.url === '/health' ? json(res, 200, {}) : json(res, 404, {})));
    const app = buildApp({ coreUrl: core.url, insightsUrl: insights.url });

    const res = await request(app).get('/api/health');
    await core.close();
    await insights.close();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', services: { core: 'up', insights: 'up' } });
  });

  test('degraded (still 200) when a service is down, slow or unhealthy', async () => {
    const slowInsights = await startUpstream(() => {
      /* never answers */
    });
    const app = buildApp({ coreUrl: await deadUrl(), insightsUrl: slowInsights.url, timeouts: { health: 200 } });

    const res = await request(app).get('/api/health');
    await slowInsights.close();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'degraded', services: { core: 'down', insights: 'down' } });
  });
});
