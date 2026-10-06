import nock from 'nock';
import request from 'supertest';
import { brokenStore, buildApp, raw } from './helpers.js';

const DAY = 24 * 60 * 60 * 1000;
const psgc = () => nock('http://psgc.test').replyContentLength();

beforeAll(() => {
  nock.disableNetConnect();
  nock.enableNetConnect('127.0.0.1');
});
afterEach(() => nock.cleanAll());
afterAll(() => nock.enableNetConnect());

describe('GET /api/insights/locations/regions', () => {
  test('returns 10-digit codes with readable names, sorted by name, without the API code', async () => {
    psgc().get('/api/regions/').reply(200, raw.regions);
    const { app } = buildApp();

    const res = await request(app).get('/api/insights/locations/regions');

    expect(res.status).toBe(200);
    expect(res.headers['x-data-source']).toBe('ok');
    expect(res.body).toEqual([
      { code: '1900000000', name: 'Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)', level: 'region' },
      { code: '0100000000', name: 'Ilocos Region (Region I)', level: 'region' },
      { code: '1700000000', name: 'MIMAROPA Region', level: 'region' },
      { code: '1300000000', name: 'National Capital Region (NCR)', level: 'region' },
    ]);
  });

  test('the second request is answered from the cache', async () => {
    const scope = psgc().get('/api/regions/').once().reply(200, raw.regions);
    const { app } = buildApp();

    await request(app).get('/api/insights/locations/regions');
    const res = await request(app).get('/api/insights/locations/regions');

    expect(res.headers['x-data-source']).toBe('cached');
    expect(res.body).toHaveLength(4);
    expect(scope.isDone()).toBe(true);
  });

  test('a cache entry older than 7 days is refreshed', async () => {
    psgc().get('/api/regions/').reply(200, raw.regions);
    const { app, store } = buildApp();
    await store.put('psgc_cache', 'regions', [{ code: '9999999999', name: 'Old', level: 'region', ref: '999' }], new Date(Date.now() - 8 * DAY));

    const res = await request(app).get('/api/insights/locations/regions');

    expect(res.headers['x-data-source']).toBe('ok');
    expect(res.body).toHaveLength(4);
    expect((await store.get('psgc_cache', 'regions')).payload).toHaveLength(4);
  });

  test('concurrent requests share one PSGC call', async () => {
    const scope = psgc().get('/api/regions/').once().delay(50).reply(200, raw.regions);
    const { app } = buildApp();

    const answers = await Promise.all([1, 2, 3].map(() => request(app).get('/api/insights/locations/regions')));

    expect(answers.map((res) => res.status)).toEqual([200, 200, 200]);
    expect(scope.isDone()).toBe(true);
  });

  test('the parent parameter is ignored for regions', async () => {
    psgc().get('/api/regions/').reply(200, raw.regions);
    const { app } = buildApp();

    const res = await request(app).get('/api/insights/locations/regions?parent=abc');

    expect(res.status).toBe(200);
  });
});

describe('GET /api/insights/locations/provinces', () => {
  test('looks up the API code of the region instead of converting it (BARMM 1900000000 → 150000000)', async () => {
    psgc().get('/api/regions/').reply(200, raw.regions);
    psgc().get('/api/regions/150000000/provinces/').reply(200, raw.barmmProvinces);
    const { app } = buildApp();

    const res = await request(app).get('/api/insights/locations/provinces?parent=1900000000');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { code: '1903600000', name: 'Lanao Del Sur', level: 'province' },
      { code: '1906600000', name: 'Sulu', level: 'province' },
    ]);
  });

  test('an unknown region is 404', async () => {
    psgc().get('/api/regions/').reply(200, raw.regions);
    const { app } = buildApp();

    const res = await request(app).get('/api/insights/locations/provinces?parent=0900000000');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test.each([
    ['', 'The parent field is required.'],
    ['?parent=', 'The parent field is required.'],
    ['?parent=130000000', 'The parent must be a 10-digit PSGC code.'],
    ['?parent=13000000AB', 'The parent must be a 10-digit PSGC code.'],
    ['?parent=1300000000&parent=0100000000', 'The parent must be a 10-digit PSGC code.'],
  ])('parent %j is a 422 with the field error', async (query, message) => {
    const { app } = buildApp();

    const res = await request(app).get(`/api/insights/locations/provinces${query}`).set('X-Request-ID', '7f0c2d1e-4b5a-4c3d-9e8f-0a1b2c3d4e5f');

    expect(res.status).toBe(422);
    expect(res.body).toEqual({
      message: 'The given data was invalid.',
      error: { code: 'VALIDATION_FAILED', request_id: '7f0c2d1e-4b5a-4c3d-9e8f-0a1b2c3d4e5f' },
      errors: { parent: [message] },
    });
  });
});

describe('GET /api/insights/locations/cities', () => {
  test('NCR cities come straight from the region, with city/municipality levels', async () => {
    psgc().get('/api/regions/').reply(200, raw.regions);
    psgc().get('/api/regions/130000000/cities-municipalities/').reply(200, raw.ncrCities);
    const { app } = buildApp();

    const res = await request(app).get('/api/insights/locations/cities?parent=1300000000');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { code: '1380600000', name: 'City of Manila', level: 'city' },
      { code: '1381701000', name: 'Pateros', level: 'municipality' },
      { code: '1381300000', name: 'Quezon City', level: 'city' },
    ]);
  });

  test('cities of a province use the cached province list to find the API code', async () => {
    psgc().get('/api/regions/').reply(200, raw.regions);
    psgc().get('/api/regions/150000000/provinces/').reply(200, raw.barmmProvinces);
    psgc().get('/api/provinces/153600000/cities-municipalities/').reply(200, raw.lanaoDelSurCities);
    const { app } = buildApp();

    await request(app).get('/api/insights/locations/provinces?parent=1900000000');
    const res = await request(app).get('/api/insights/locations/cities?parent=1903600000');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { code: '1903601000', name: 'Bacolod-Kalawi', level: 'municipality' },
      { code: '1903617000', name: 'City of Marawi', level: 'city' },
    ]);
  });

  test('a province that is not in its region is 404', async () => {
    psgc().get('/api/regions/').reply(200, raw.regions);
    psgc().get('/api/regions/150000000/provinces/').reply(200, raw.barmmProvinces);
    const { app } = buildApp();

    const res = await request(app).get('/api/insights/locations/cities?parent=1909900000');

    expect(res.status).toBe(404);
  });

  test('a code whose region does not exist is 404', async () => {
    psgc().get('/api/regions/').reply(200, raw.regions);
    const { app } = buildApp();

    const res = await request(app).get('/api/insights/locations/cities?parent=0904100000');

    expect(res.status).toBe(404);
  });
});

describe('when PSGC fails', () => {
  const fallback = {
    regions: [{ code: '1300000000', name: 'National Capital Region (NCR)', level: 'region', ref: '130000000' }],
    'provinces:1300000000': [],
    'cities:1300000000': [{ code: '1381300000', name: 'Quezon City', level: 'city', ref: '137404000' }],
  };

  test('an expired cache entry is served as stale', async () => {
    psgc().get('/api/regions/').reply(500);
    const { app, store } = buildApp({ psgcFallback: fallback });
    const old = [{ code: '0100000000', name: 'Ilocos Region (Region I)', level: 'region', ref: '010000000' }];
    await store.put('psgc_cache', 'regions', old, new Date(Date.now() - 30 * DAY));

    const res = await request(app).get('/api/insights/locations/regions');

    expect(res.status).toBe(200);
    expect(res.headers['x-data-source']).toBe('stale');
    expect(res.body).toEqual([{ code: '0100000000', name: 'Ilocos Region (Region I)', level: 'region' }]);
  });

  test('without a cache entry the bundled fallback answers (NCR cities)', async () => {
    psgc().get('/api/regions/').replyWithError(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }));
    const { app, log } = buildApp({ psgcFallback: fallback });

    const res = await request(app).get('/api/insights/locations/cities?parent=1300000000');

    expect(res.status).toBe(200);
    expect(res.headers['x-data-source']).toBe('fallback');
    expect(res.body).toEqual([{ code: '1381300000', name: 'Quezon City', level: 'city' }]);
    expect(log.lines.join('\n')).toContain('"source":"psgc"');
  });

  test('a timeout counts as a failure', async () => {
    psgc().get('/api/regions/').delay(500).reply(200, raw.regions);
    const { app } = buildApp({ psgcFallback: fallback, timeouts: { psgc: 50 } });

    const res = await request(app).get('/api/insights/locations/regions');

    expect(res.headers['x-data-source']).toBe('fallback');
    expect(res.body).toHaveLength(1);
  });

  test('an answer that is not a list counts as a failure', async () => {
    psgc().get('/api/regions/').reply(200, '<html>maintenance</html>', { 'Content-Type': 'text/html' });
    const { app } = buildApp({ psgcFallback: fallback });

    const res = await request(app).get('/api/insights/locations/regions');

    expect(res.headers['x-data-source']).toBe('fallback');
  });

  test('a list that is not bundled is 503 SERVICE_UNAVAILABLE', async () => {
    psgc().get('/api/regions/').reply(200, raw.regions);
    psgc().get('/api/regions/150000000/provinces/').reply(502);
    const { app } = buildApp({ psgcFallback: fallback });

    const res = await request(app).get('/api/insights/locations/provinces?parent=1900000000');

    expect(res.status).toBe(503);
    expect(res.body.error).toEqual({
      code: 'SERVICE_UNAVAILABLE',
      message: 'The service is temporarily unavailable. Please try again shortly.',
      request_id: expect.any(String),
    });
  });

  test('after a failure PSGC is skipped for the cooldown, so one request waits for one timeout at most', async () => {
    const regions = psgc().get('/api/regions/').delay(500).reply(200, raw.regions);
    const cities = psgc().get('/api/regions/130000000/cities-municipalities/').reply(200, raw.ncrCities);
    const { app } = buildApp({ psgcFallback: fallback, timeouts: { psgc: 50 }, cooldowns: { psgc: 60_000 } });

    const res = await request(app).get('/api/insights/locations/cities?parent=1300000000');
    const again = await request(app).get('/api/insights/locations/regions');

    expect(res.headers['x-data-source']).toBe('fallback');
    expect(again.headers['x-data-source']).toBe('fallback');
    expect(regions.isDone()).toBe(true);
    expect(cities.isDone()).toBe(false);
  });

  test('a failed source is not cached', async () => {
    psgc().get('/api/regions/').reply(500);
    psgc().get('/api/regions/').reply(200, raw.regions);
    const { app } = buildApp({ psgcFallback: fallback });

    await request(app).get('/api/insights/locations/regions');
    const res = await request(app).get('/api/insights/locations/regions');

    expect(res.headers['x-data-source']).toBe('ok');
    expect(res.body).toHaveLength(4);
  });
});

test('a broken cache database does not break the lists', async () => {
  psgc().get('/api/regions/').reply(200, raw.regions);
  const { app, log } = buildApp({ store: brokenStore() });

  const res = await request(app).get('/api/insights/locations/regions');

  expect(res.status).toBe(200);
  expect(res.headers['x-data-source']).toBe('ok');
  expect(log.lines.join('\n')).toContain('ECONNREFUSED');
});
