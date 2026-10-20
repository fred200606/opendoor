import nock from 'nock';
import request from 'supertest';
import { buildApp, raw, TEST_ENV } from './helpers.js';

const KEY = TEST_ENV.SERVICE_KEY_INSIGHTS;
const psgc = () => nock('http://psgc.test').replyContentLength();
const searchPlace = (q) => nock('http://nominatim.test').get('/search').query({ q, countrycodes: 'ph', format: 'jsonv2', limit: '5' });
const town = (lat, lon) => [{ place_id: 2, lat: String(lat), lon: String(lon), addresstype: 'city', display_name: 'a place' }];

/** NCR has no provinces: its cities come from the region. */
function ncrLists() {
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

describe('GET /internal/places/{code}', () => {
  test('a city with its region and centre point (Nominatim "City, Metro Manila")', async () => {
    ncrLists();
    searchPlace('Quezon City, Metro Manila').reply(200, town(14.6507, 121.0495));
    const { app } = buildApp();

    const res = await request(app).get('/internal/places/1381300000').set('X-Service-Key', KEY);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      code: '1381300000',
      city: 'Quezon City',
      province: null,
      region: 'National Capital Region (NCR)',
      province_code: null,
      region_code: '1300000000',
      lat: 14.6507,
      lon: 121.0495,
      precision: 'city',
      sources: { psgc: 'ok', geocode: 'ok' },
    });
  });

  test('a province city gets its province code, also for a city outside the province prefix', async () => {
    psgc().get('/api/regions/').reply(200, raw.regions);
    psgc().get('/api/regions/150000000/provinces/').reply(200, raw.barmmProvinces);
    psgc().get('/api/provinces/153600000/cities-municipalities/').reply(200, raw.lanaoDelSurCities);
    searchPlace('Marawi, Lanao Del Sur').reply(200, town(7.9986, 124.2928));
    const { app } = buildApp();

    const res = await request(app).get('/internal/places/1903617000').set('X-Service-Key', KEY);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ city: 'City of Marawi', province: 'Lanao Del Sur', province_code: '1903600000', region_code: '1900000000', lat: 7.9986 });
  });

  test('without a Nominatim match the bundled centroid is used; unknown everywhere → no point', async () => {
    ncrLists();
    searchPlace('Pateros, Metro Manila').reply(200, []);
    searchPlace('Quezon City, Metro Manila').reply(200, []);
    const { app } = buildApp({ centroids: { 1381701000: { lat: 14.5446, lon: 121.0687 } } });

    const pateros = await request(app).get('/internal/places/1381701000').set('X-Service-Key', KEY);
    const quezon = await request(app).get('/internal/places/1381300000').set('X-Service-Key', KEY);

    expect(pateros.body).toMatchObject({ lat: 14.5446, lon: 121.0687, precision: 'city', sources: { psgc: 'ok', geocode: 'ok' } });
    expect(quezon.status).toBe(200);
    expect(quezon.body).toMatchObject({ lat: null, lon: null, precision: null, sources: { psgc: 'cached', geocode: 'ok' } });
  });

  test('an unknown code is 404 and a malformed one too', async () => {
    ncrLists();
    const { app } = buildApp();

    expect((await request(app).get('/internal/places/1389999000').set('X-Service-Key', KEY)).status).toBe(404);
    expect((await request(app).get('/internal/places/13813').set('X-Service-Key', KEY)).status).toBe(404);
  });

  test('PSGC down without a cache or fallback list is 503', async () => {
    psgc().get('/api/regions/').reply(500);
    const { app } = buildApp({ timeouts: { psgc: 200 } });

    const res = await request(app).get('/internal/places/1381300000').set('X-Service-Key', KEY);

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
  });

  test('a missing or wrong service key is 401, and no key configured refuses every call', async () => {
    const { app } = buildApp();
    expect((await request(app).get('/internal/places/1381300000')).status).toBe(401);
    const wrong = await request(app).get('/internal/places/1381300000').set('X-Service-Key', 'nope');
    expect(wrong.status).toBe(401);
    expect(wrong.body.error).toMatchObject({ code: 'UNAUTHENTICATED', message: 'A valid service key is required.' });

    const { app: keyless } = buildApp({ env: { SERVICE_KEY_INSIGHTS: '' } });
    expect((await request(keyless).get('/internal/places/1381300000').set('X-Service-Key', '')).status).toBe(401);
  });
});
