import request from 'supertest';
import { buildApp, json, startUpstream } from './helpers.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('routing', () => {
  let core;
  let insights;
  let app;

  beforeEach(async () => {
    core = await startUpstream((req, res) => json(res, 200, { from: 'core', url: req.url }));
    insights = await startUpstream((req, res) => json(res, 200, { from: 'insights', url: req.url }));
    app = buildApp({ coreUrl: core.url, insightsUrl: insights.url });
  });

  afterEach(async () => {
    await core.close();
    await insights.close();
  });

  test('/api/* goes to Core with the path and query unchanged', async () => {
    const res = await request(app).get('/api/job-postings?match=1&page=2');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ from: 'core', url: '/api/job-postings?match=1&page=2' });
    expect(insights.requests).toHaveLength(0);
  });

  test('/api/insights/* goes to the Insights Service', async () => {
    const res = await request(app).get('/api/insights/job-postings/7');

    expect(res.body).toEqual({ from: 'insights', url: '/api/insights/job-postings/7' });
    expect(core.requests).toHaveLength(0);
  });

  test('a path that only starts with "insights" still goes to Core', async () => {
    const res = await request(app).get('/api/insightsful');

    expect(res.body.from).toBe('core');
  });

  test('Authorization and JSON bodies are forwarded unchanged', async () => {
    await request(app)
      .post('/api/login')
      .set('Authorization', 'Bearer abc|123')
      .send({ email: 'a@example.com', password: 'secret-password' });

    const forwarded = core.requests[0];
    expect(forwarded.method).toBe('POST');
    expect(forwarded.headers.authorization).toBe('Bearer abc|123');
    expect(JSON.parse(forwarded.body)).toEqual({ email: 'a@example.com', password: 'secret-password' });
    expect(forwarded.headers['x-forwarded-for']).toBeDefined();
  });

  test('multipart uploads stream through untouched', async () => {
    await request(app)
      .post('/api/candidate/resume')
      .attach('resume', Buffer.from('%PDF-1.4 fake'), { filename: 'cv.pdf', contentType: 'application/pdf' });

    const forwarded = core.requests[0];
    expect(forwarded.headers['content-type']).toMatch(/^multipart\/form-data; boundary=/);
    expect(forwarded.body).toContain('%PDF-1.4 fake');
  });

  test('upstream status codes and error envelopes pass through', async () => {
    await core.close();
    core = await startUpstream((req, res) =>
      json(res, 409, { error: { code: 'ALREADY_APPLIED', message: 'You have already applied.', request_id: req.headers['x-request-id'] } }),
    );
    app = buildApp({ coreUrl: core.url, insightsUrl: insights.url });

    const res = await request(app).post('/api/job-postings/1/applications');

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_APPLIED');
    expect(res.body.error.request_id).toBe(res.headers['x-request-id']);
  });

  test('/internal/* is never routed', async () => {
    const res = await request(app).get('/internal/job-postings/1/summary').set('X-Service-Key', 'guess');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(core.requests).toHaveLength(0);
  });

  test('paths outside /api return a 404 envelope', async () => {
    const res = await request(app).get('/wp-login.php');

    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: expect.any(String), request_id: expect.stringMatching(UUID) });
    expect(core.requests).toHaveLength(0);
  });

  describe('X-Request-ID', () => {
    test('is created when missing and forwarded upstream', async () => {
      const res = await request(app).get('/api/categories');

      expect(res.headers['x-request-id']).toMatch(UUID);
      expect(core.requests[0].headers['x-request-id']).toBe(res.headers['x-request-id']);
    });

    test('a valid incoming id is reused', async () => {
      const id = '0b6f3c1e-7a8d-4c2b-9e5f-1a2b3c4d5e6f';
      const res = await request(app).get('/api/categories').set('X-Request-ID', id);

      expect(res.headers['x-request-id']).toBe(id);
      expect(core.requests[0].headers['x-request-id']).toBe(id);
    });

    test('an invalid incoming id is replaced', async () => {
      const res = await request(app).get('/api/categories').set('X-Request-ID', 'drop table users');

      expect(res.headers['x-request-id']).toMatch(UUID);
      expect(core.requests[0].headers['x-request-id']).toBe(res.headers['x-request-id']);
    });
  });

  describe('CORS', () => {
    test('allows the React origin and exposes X-Request-ID', async () => {
      const res = await request(app)
        .options('/api/login')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'authorization,content-type');

      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(res.headers['access-control-allow-credentials']).toBeUndefined();
      expect(core.requests).toHaveLength(0);

      const get = await request(app).get('/api/categories').set('Origin', 'http://localhost:5173');
      expect(get.headers['access-control-expose-headers']).toContain('X-Request-ID');
    });

    test("upstream CORS headers (Laravel's allow-all default) are dropped", async () => {
      await core.close();
      core = await startUpstream((req, res) => json(res, 200, { ok: true }, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Max-Age': '0' }));
      app = buildApp({ coreUrl: core.url, insightsUrl: insights.url });

      const evil = await request(app).get('/api/categories').set('Origin', 'https://evil.example');
      const allowed = await request(app).get('/api/categories').set('Origin', 'http://localhost:5173');

      expect(evil.headers['access-control-allow-origin']).toBeUndefined();
      expect(evil.headers['access-control-max-age']).toBeUndefined();
      expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });

    test('the upstream X-Powered-By header (stack and version) is not passed on', async () => {
      await core.close();
      core = await startUpstream((req, res) => json(res, 200, { ok: true }, { 'X-Powered-By': 'PHP/8.4.0' }));
      app = buildApp({ coreUrl: core.url, insightsUrl: insights.url });

      const res = await request(app).get('/api/categories');

      expect(res.status).toBe(200);
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    test('does not allow other origins', async () => {
      const res = await request(app).get('/api/categories').set('Origin', 'https://evil.example');

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});
