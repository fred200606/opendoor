import nock from 'nock';
import request from 'supertest';
import { placeQuery } from '../src/services/geocoder.js';
import { DISCLAIMER, manilaTimestamp } from '../src/services/snapshot.js';
import { buildApp, raw } from './helpers.js';

const QC = { lat: 14.633159, lon: 121.019342 };
const north = (metres) => ({ lat: QC.lat + metres / 111_195.08, lon: QC.lon });

const core = () => nock('http://core.test');
const psgc = () => nock('http://psgc.test');
const nominatim = (q) =>
  nock('http://nominatim.test').get('/search').query({ q, countrycodes: 'ph', format: 'jsonv2', limit: '1' });
const overpass = () => nock('http://overpass.test').post('/api/interpreter');

const networkError = (code) => Object.assign(new Error(`connect ${code}`), { code });
const hit = (lat, lon) => [{ place_id: 1, lat: String(lat), lon: String(lon), display_name: 'Somewhere' }];
const overpassAnswer = {
  version: 0.6,
  elements: [
    { type: 'node', id: 11, ...north(220), tags: { railway: 'station', name: 'Quezon Ave. MRT Station', wheelchair: 'yes' } },
    { type: 'way', id: 22, center: north(80), tags: { amenity: 'parking', wheelchair: 'limited' } },
  ],
};

const summary = (overrides = {}) => ({
  id: 42,
  address: '123 Quezon Ave.',
  psgc_code: '1381300000',
  location_label: 'Quezon City, National Capital Region (NCR)',
  accommodations: [
    { id: 3, name: 'Screen reader software', group: 'assistive_technology' },
    { id: 1, name: 'Wheelchair-accessible entrance', group: 'physical_access' },
    { id: 2, name: 'Accessible restroom', group: 'physical_access' },
  ],
  trust_score: {
    published: true,
    score: 86,
    based_on: 5,
    breakdown: [{ accommodation_id: 1, name: 'Wheelchair-accessible entrance', delivered: 4, partial: 1, not_delivered: 0, of: 5 }],
  },
  ...overrides,
});

/** PSGC answers for Quezon City (NCR has no provinces). */
function psgcForQuezonCity() {
  psgc().get('/api/regions/').reply(200, raw.regions);
  psgc().get('/api/regions/130000000/provinces/').reply(200, []);
  psgc().get('/api/regions/130000000/cities-municipalities/').reply(200, raw.ncrCities);
}

beforeAll(() => {
  nock.disableNetConnect();
  nock.enableNetConnect('127.0.0.1');
});
afterEach(() => nock.cleanAll());
afterAll(() => nock.enableNetConnect());

describe('GET /api/insights/job-postings/{id}', () => {
  test('combines Core, PSGC, Nominatim and Overpass', async () => {
    const coreScope = core()
      .get('/internal/job-postings/42/summary')
      .matchHeader('x-service-key', 'test-service-key')
      .matchHeader('x-request-id', '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b')
      .reply(200, summary());
    psgcForQuezonCity();
    nominatim('123 Quezon Ave., Quezon City, Metro Manila').reply(200, hit(QC.lat, QC.lon));
    overpass().reply(200, overpassAnswer);
    const { app } = buildApp();

    const res = await request(app).get('/api/insights/job-postings/42').set('X-Request-ID', '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b');

    expect(res.status).toBe(200);
    expect(coreScope.isDone()).toBe(true);
    expect(res.body).toEqual({
      job_posting_id: 42,
      location: {
        psgc_code: '1381300000',
        label: 'Quezon City, National Capital Region (NCR)',
        lat: QC.lat,
        lon: QC.lon,
        precision: 'street',
      },
      employer_claims: {
        assistive_technology: ['Screen reader software'],
        physical_access: ['Wheelchair-accessible entrance', 'Accessible restroom'],
      },
      community_verification: {
        trust_score: 86,
        based_on: 5,
        breakdown: [{ accommodation_id: 1, name: 'Wheelchair-accessible entrance', delivered: 4, partial: 1, not_delivered: 0, of: 5 }],
      },
      nearby_accessible: {
        radius_m: 500,
        transit_stops: [{ name: 'Quezon Ave. MRT Station', wheelchair: 'yes', distance_m: 220 }],
        toilets: [],
        parking: [{ name: null, wheelchair: 'limited', distance_m: 80 }],
        other: [],
      },
      sources: { core: 'ok', psgc: 'ok', nominatim: 'ok', overpass: 'ok' },
      disclaimer: DISCLAIMER,
      generated_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+08:00$/),
    });
  });

  test('a second snapshot of the same posting uses the caches but asks Core again', async () => {
    const coreScope = core().get('/internal/job-postings/42/summary').twice().reply(200, summary());
    psgcForQuezonCity();
    nominatim('123 Quezon Ave., Quezon City, Metro Manila').once().reply(200, hit(QC.lat, QC.lon));
    overpass().once().reply(200, overpassAnswer);
    const { app } = buildApp();

    await request(app).get('/api/insights/job-postings/42');
    const res = await request(app).get('/api/insights/job-postings/42');

    expect(res.body.sources).toEqual({ core: 'ok', psgc: 'cached', nominatim: 'cached', overpass: 'cached' });
    expect(res.body.nearby_accessible.transit_stops).toHaveLength(1);
    expect(coreScope.isDone()).toBe(true);
  });

  test('an unpublished trust score gives community_verification null', async () => {
    core()
      .get('/internal/job-postings/42/summary')
      .reply(200, summary({ trust_score: { published: false, score: null, based_on: 2, breakdown: [] } }));
    psgcForQuezonCity();
    nominatim('123 Quezon Ave., Quezon City, Metro Manila').reply(200, hit(QC.lat, QC.lon));
    overpass().reply(200, overpassAnswer);
    const { app } = buildApp();

    const res = await request(app).get('/api/insights/job-postings/42');

    expect(res.status).toBe(200);
    expect(res.body.community_verification).toBeNull();
  });

  test('a highly urbanized city is found under its province although the codes differ (Cebu City)', async () => {
    const centralVisayas = { code: '070000000', name: 'Region VII', regionName: 'Central Visayas', psgc10DigitCode: '0700000000' };
    core()
      .get('/internal/job-postings/7/summary')
      .reply(200, summary({ id: 7, address: 'Osmeña Blvd.', psgc_code: '0730600000', location_label: 'City of Cebu, Cebu, Central Visayas (Region VII)' }));
    psgc().get('/api/regions/').reply(200, [...raw.regions, centralVisayas]);
    psgc().get('/api/regions/070000000/provinces/').reply(200, [
      { code: '071200000', name: 'Bohol', psgc10DigitCode: '0701200000' },
      { code: '072200000', name: 'Cebu', psgc10DigitCode: '0702200000' },
    ]);
    psgc().get('/api/provinces/071200000/cities-municipalities/').reply(200, [
      { code: '071242000', name: 'City of Tagbilaran', isCity: true, psgc10DigitCode: '0701242000' },
    ]);
    psgc().get('/api/provinces/072200000/cities-municipalities/').reply(200, [
      { code: '072217000', name: 'City of Cebu', isCity: true, psgc10DigitCode: '0730600000' },
    ]);
    nominatim('Osmeña Blvd., Cebu, Cebu').reply(200, hit(10.2966, 123.8977));
    overpass().reply(200, { version: 0.6, elements: [] });
    const { app } = buildApp();

    const res = await request(app).get('/api/insights/job-postings/7');

    expect(res.status).toBe(200);
    expect(res.body.location).toMatchObject({ label: 'City of Cebu, Cebu, Central Visayas (Region VII)', lat: 10.2966, precision: 'street' });
    expect(res.body.sources.psgc).toBe('ok');
  });

  describe('Core', () => {
    test('404 from Core is 404 and no other source is asked', async () => {
      core().get('/internal/job-postings/42/summary').reply(404, { error: { code: 'NOT_FOUND' } });
      const { app } = buildApp();

      const res = await request(app).get('/api/insights/job-postings/42');

      expect(res.status).toBe(404);
      expect(res.body.error).toMatchObject({ code: 'NOT_FOUND', request_id: expect.any(String) });
      expect(nock.pendingMocks()).toEqual([]);
    });

    test.each([
      ['down', (scope) => scope.replyWithError(networkError('ECONNREFUSED'))],
      ['a server error', (scope) => scope.reply(500, { error: { code: 'SERVER_ERROR' } })],
      ['refusing the service key (401)', (scope) => scope.reply(401, { error: { code: 'UNAUTHENTICATED' } })],
      ['an unexpected answer', (scope) => scope.reply(200, '<html>login</html>', { 'Content-Type': 'text/html' })],
      ['too slow', (scope) => scope.delay(300).reply(200, summary())],
    ])('Core %s → 503 SERVICE_UNAVAILABLE', async (_, respond) => {
      respond(core().get('/internal/job-postings/42/summary'));
      const { app, log } = buildApp({ timeouts: { core: 100 } });

      const res = await request(app).get('/api/insights/job-postings/42');

      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
      expect(log.lines.join('\n')).toContain('"source":"core"');
    });

    test.each(['abc', '0', '-1', '1.5', '2147483648', '12345678901'])('id "%s" is 404 without asking Core', async (id) => {
      const { app } = buildApp();

      const res = await request(app).get(`/api/insights/job-postings/${id}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('each other source failing still gives 200', () => {
    test('PSGC down: the label stored in Core is used for the label and the geocoding query', async () => {
      core()
        .get('/internal/job-postings/7/summary')
        .reply(200, summary({ id: 7, address: 'Osmeña Blvd.', psgc_code: '0730600000', location_label: 'City of Cebu, Cebu, Central Visayas (Region VII)' }));
      psgc().get('/api/regions/').reply(503);
      nominatim('Osmeña Blvd., Cebu, Cebu').reply(200, hit(10.2966, 123.8977));
      overpass().reply(200, { version: 0.6, elements: [] });
      const { app } = buildApp();

      const res = await request(app).get('/api/insights/job-postings/7');

      expect(res.status).toBe(200);
      expect(res.body.location).toMatchObject({ label: 'City of Cebu, Cebu, Central Visayas (Region VII)', precision: 'street' });
      expect(res.body.sources).toEqual({ core: 'ok', psgc: 'unavailable', nominatim: 'ok', overpass: 'ok' });
    });

    test('PSGC down: the bundled fallback lists still give the names (reported as stale)', async () => {
      core().get('/internal/job-postings/42/summary').reply(200, summary({ location_label: null }));
      psgc().get('/api/regions/').reply(503);
      nominatim('123 Quezon Ave., Quezon City, Metro Manila').reply(200, hit(QC.lat, QC.lon));
      overpass().reply(200, overpassAnswer);
      const regions = [{ code: '1300000000', name: 'National Capital Region (NCR)', level: 'region', ref: '130000000' }];
      const { app } = buildApp({
        psgcFallback: {
          regions,
          'provinces:1300000000': [],
          'cities:1300000000': [{ code: '1381300000', name: 'Quezon City', level: 'city', ref: '137404000' }],
        },
      });

      const res = await request(app).get('/api/insights/job-postings/42');

      expect(res.body.location.label).toBe('Quezon City, National Capital Region (NCR)');
      expect(res.body.sources.psgc).toBe('stale');
    });

    test('Nominatim down: the bundled city centroid is used (precision city)', async () => {
      core().get('/internal/job-postings/42/summary').reply(200, summary());
      psgcForQuezonCity();
      nominatim('123 Quezon Ave., Quezon City, Metro Manila').reply(503);
      overpass().reply(200, overpassAnswer);
      const { app } = buildApp({ centroids: { '1381300000': QC } });

      const res = await request(app).get('/api/insights/job-postings/42');

      expect(res.status).toBe(200);
      expect(res.body.location).toMatchObject({ lat: QC.lat, lon: QC.lon, precision: 'city' });
      expect(res.body.sources).toEqual({ core: 'ok', psgc: 'ok', nominatim: 'unavailable', overpass: 'ok' });
      expect(res.body.nearby_accessible.transit_stops).toHaveLength(1);
    });

    test('Nominatim down and no centroid: no coordinates, so Overpass is not asked', async () => {
      core().get('/internal/job-postings/42/summary').reply(200, summary());
      psgcForQuezonCity();
      nominatim('123 Quezon Ave., Quezon City, Metro Manila').replyWithError(networkError('ECONNRESET'));
      const { app } = buildApp();

      const res = await request(app).get('/api/insights/job-postings/42');

      expect(res.status).toBe(200);
      expect(res.body.location).toMatchObject({ lat: null, lon: null, precision: null });
      expect(res.body.nearby_accessible).toBeNull();
      expect(res.body.sources).toEqual({ core: 'ok', psgc: 'ok', nominatim: 'unavailable', overpass: 'unavailable' });
    });

    test('no contact email: Nominatim is never called', async () => {
      core().get('/internal/job-postings/42/summary').reply(200, summary());
      psgcForQuezonCity();
      overpass().reply(200, overpassAnswer);
      const { app } = buildApp({ env: { NOMINATIM_CONTACT_EMAIL: '' }, centroids: { '1381300000': QC } });

      const res = await request(app).get('/api/insights/job-postings/42');

      expect(res.body.location.precision).toBe('city');
      expect(res.body.sources.nominatim).toBe('unavailable');
    });

    test('Overpass down: nearby_accessible is null', async () => {
      core().get('/internal/job-postings/42/summary').reply(200, summary());
      psgcForQuezonCity();
      nominatim('123 Quezon Ave., Quezon City, Metro Manila').reply(200, hit(QC.lat, QC.lon));
      overpass().reply(504, '<html>The server is probably too busy</html>', { 'Content-Type': 'text/html' });
      const { app } = buildApp();

      const res = await request(app).get('/api/insights/job-postings/42');

      expect(res.status).toBe(200);
      expect(res.body.nearby_accessible).toBeNull();
      expect(res.body.location.precision).toBe('street');
      expect(res.body.sources).toEqual({ core: 'ok', psgc: 'ok', nominatim: 'ok', overpass: 'unavailable' });
    });

    test('every outside source down: Core data only', async () => {
      core().get('/internal/job-postings/42/summary').reply(200, summary());
      psgc().get('/api/regions/').replyWithError(networkError('ETIMEDOUT'));
      nominatim('123 Quezon Ave., Quezon City, Metro Manila').reply(500);
      const { app } = buildApp();

      const res = await request(app).get('/api/insights/job-postings/42');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        location: { psgc_code: '1381300000', label: 'Quezon City, National Capital Region (NCR)', lat: null, lon: null, precision: null },
        employer_claims: { physical_access: ['Wheelchair-accessible entrance', 'Accessible restroom'] },
        community_verification: { trust_score: 86 },
        nearby_accessible: null,
        sources: { core: 'ok', psgc: 'unavailable', nominatim: 'unavailable', overpass: 'unavailable' },
      });
    });

    test('a posting without a PSGC code is geocoded from its address and label', async () => {
      core()
        .get('/internal/job-postings/42/summary')
        .reply(200, summary({ psgc_code: null, location_label: 'Quezon City, National Capital Region (NCR)' }));
      nominatim('123 Quezon Ave., Quezon City, Metro Manila').reply(200, hit(QC.lat, QC.lon));
      overpass().reply(200, overpassAnswer);
      const { app } = buildApp();

      const res = await request(app).get('/api/insights/job-postings/42');

      expect(res.body.location).toMatchObject({ psgc_code: null, precision: 'street' });
      expect(res.body.sources).toEqual({ core: 'ok', psgc: 'unavailable', nominatim: 'ok', overpass: 'ok' });
    });
  });

  describe('time budget', () => {
    test('a source still running at the deadline is unavailable; its answer still fills the cache', async () => {
      core().get('/internal/job-postings/42/summary').twice().reply(200, summary());
      psgcForQuezonCity();
      nominatim('123 Quezon Ave., Quezon City, Metro Manila').reply(200, hit(QC.lat, QC.lon));
      const slow = overpass().once().delay(400).reply(200, overpassAnswer);
      const { app } = buildApp({ budgetMs: 200, timeouts: { overpass: 2_000 } });

      const started = Date.now();
      const first = await request(app).get('/api/insights/job-postings/42');

      expect(first.status).toBe(200);
      expect(Date.now() - started).toBeLessThan(400);
      expect(first.body.nearby_accessible).toBeNull();
      expect(first.body.sources).toEqual({ core: 'ok', psgc: 'ok', nominatim: 'ok', overpass: 'unavailable' });

      await new Promise((resolve) => setTimeout(resolve, 400));
      expect(slow.isDone()).toBe(true);

      const second = await request(app).get('/api/insights/job-postings/42');
      expect(second.body.sources.overpass).toBe('cached');
      expect(second.body.nearby_accessible.transit_stops).toHaveLength(1);
    });

    test('nothing new is started once the budget is used up', async () => {
      core().get('/internal/job-postings/42/summary').delay(150).reply(200, summary());
      psgcForQuezonCity();
      const { app } = buildApp({ budgetMs: 100 });

      const res = await request(app).get('/api/insights/job-postings/42');

      expect(res.status).toBe(200);
      expect(res.body.sources).toEqual({ core: 'ok', psgc: 'unavailable', nominatim: 'unavailable', overpass: 'unavailable' });
      expect(nock.pendingMocks()).toHaveLength(3);
    });
  });
});

describe('placeQuery', () => {
  test.each([
    [{ city: 'Quezon City', province: null }, 'Quezon City, Metro Manila'],
    [{ city: 'City of Makati', province: null }, 'Makati, Metro Manila'],
    [{ city: 'City of Cebu', province: 'Cebu' }, 'Cebu, Cebu'],
    [{ city: 'Bacolod-Kalawi', province: 'Lanao Del Sur' }, 'Bacolod-Kalawi, Lanao Del Sur'],
  ])('%j → %s', (place, query) => {
    expect(placeQuery(place)).toBe(query);
  });
});

describe('manilaTimestamp', () => {
  test('is the Manila wall-clock time with +08:00', () => {
    expect(manilaTimestamp(new Date('2026-10-07T02:05:40.123Z'))).toBe('2026-10-07T10:05:40+08:00');
    expect(manilaTimestamp(new Date('2026-12-31T20:00:00Z'))).toBe('2027-01-01T04:00:00+08:00');
  });
});
