import nock from 'nock';
import { createCached } from '../src/cache/cached.js';
import { createMemoryStore } from '../src/cache/memoryStore.js';
import { addressHash, createGeocoder } from '../src/services/geocoder.js';
import { createNominatimClient } from '../src/sources/nominatim.js';
import { brokenStore, silentLog } from './helpers.js';

const DAY = 24 * 60 * 60 * 1000;
const QC = { address: '123 Quezon Ave.', place: 'Quezon City', psgcCode: '1381300000' };
const centroids = { '1381300000': { lat: 14.676, lon: 121.0437 } };
const hit = (lat, lon) => [{ place_id: 1, lat: String(lat), lon: String(lon), display_name: 'somewhere' }];

const nominatim = () => nock('http://nominatim.test');
const search = (q) => nominatim().get('/search').query({ q, countrycodes: 'ph', format: 'jsonv2', limit: '1' });

function build({ store = createMemoryStore(), contactEmail = 'team@opendoor.test', timeoutMs = 1_000, intervalMs = 0, maxWaitMs = 2_000, cooldownMs = 0 } = {}) {
  const log = silentLog();
  const client = contactEmail
    ? createNominatimClient({ baseUrl: 'http://nominatim.test', contactEmail, timeoutMs, intervalMs, maxWaitMs })
    : null;
  const geocode = createGeocoder({
    nominatim: client,
    cached: createCached(store, { log }),
    ttlMs: 30 * DAY,
    cooldownMs,
    centroids,
    log,
  });
  return { geocode, store, log };
}

beforeAll(() => nock.disableNetConnect());
afterEach(() => nock.cleanAll());
afterAll(() => nock.enableNetConnect());

describe('geocoder', () => {
  test('a street match is precision "street" and is sent with the policy User-Agent', async () => {
    const scope = search('123 Quezon Ave., Quezon City')
      .matchHeader('user-agent', 'OpenDoor/1.0 (team@opendoor.test)')
      .reply(200, hit('14.6331587', '121.0193421'));
    const { geocode } = build();

    const result = await geocode(QC);

    expect(result).toEqual({ lat: 14.633159, lon: 121.019342, precision: 'street', source: 'ok' });
    expect(scope.isDone()).toBe(true);
  });

  test('the second lookup comes from the cache (30 days), also with different spacing and case', async () => {
    search('123 Quezon Ave., Quezon City').once().reply(200, hit(14.6331, 121.0193));
    const { geocode, store } = build();

    await geocode(QC);
    const again = await geocode({ ...QC, address: '123  QUEZON Ave.' });

    expect(again).toEqual({ lat: 14.6331, lon: 121.0193, precision: 'street', source: 'cached' });
    const entry = await store.get('geocode_cache', addressHash('123 Quezon Ave., Quezon City'));
    expect(entry.payload).toEqual({ query: '123 Quezon Ave., Quezon City', lat: 14.6331, lon: 121.0193, precision: 'street' });
  });

  test('no street match → the place is searched → precision "city", cached under the full address', async () => {
    search('123 Quezon Ave., Quezon City').reply(200, []);
    search('Quezon City').reply(200, hit(14.65, 121.05));
    const { geocode, store } = build();

    const result = await geocode(QC);

    expect(result).toEqual({ lat: 14.65, lon: 121.05, precision: 'city', source: 'ok' });
    expect((await store.get('geocode_cache', addressHash('123 Quezon Ave., Quezon City'))).payload.precision).toBe('city');
  });

  test('without an address only the place is searched', async () => {
    const scope = search('Quezon City').reply(200, hit(14.65, 121.05));
    const { geocode } = build();

    const result = await geocode({ address: null, place: 'Quezon City', psgcCode: '1381300000' });

    expect(result.precision).toBe('city');
    expect(scope.isDone()).toBe(true);
  });

  test('nothing found → bundled city centroid, and Nominatim itself counts as ok', async () => {
    search('123 Quezon Ave., Quezon City').reply(200, []);
    search('Quezon City').reply(200, []);
    const { geocode, store } = build();

    const result = await geocode(QC);

    expect(result).toEqual({ lat: 14.676, lon: 121.0437, precision: 'city', source: 'ok' });
    expect(await store.get('geocode_cache', addressHash('123 Quezon Ave., Quezon City'))).toBeNull();
  });

  test.each([
    ['a server error', (scope) => scope.reply(503)],
    ['a refused connection', (scope) => scope.replyWithError(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }))],
    ['an answer that is not a list', (scope) => scope.reply(200, { error: 'Unable to geocode' })],
    ['a match without coordinates', (scope) => scope.reply(200, [{ lat: 'x', lon: 'y' }])],
  ])('%s → bundled centroid, source "unavailable", nothing cached', async (_, respond) => {
    respond(search('123 Quezon Ave., Quezon City'));
    const { geocode, store, log } = build();

    const result = await geocode(QC);

    expect(result).toEqual({ lat: 14.676, lon: 121.0437, precision: 'city', source: 'unavailable' });
    expect(await store.get('geocode_cache', addressHash('123 Quezon Ave., Quezon City'))).toBeNull();
    expect(log.lines.join('\n')).toContain('"source":"nominatim"');
  });

  test('a timeout counts as unavailable', async () => {
    search('123 Quezon Ave., Quezon City').delay(300).reply(200, hit(14.6, 121));
    const { geocode } = build({ timeoutMs: 50 });

    expect((await geocode(QC)).source).toBe('unavailable');
  });

  test('no centroid for the place → no coordinates', async () => {
    search('1 Main St., Somewhere').reply(500);
    const { geocode } = build();

    const result = await geocode({ address: '1 Main St.', place: 'Somewhere', psgcCode: '0999999000' });

    expect(result).toEqual({ lat: null, lon: null, precision: null, source: 'unavailable' });
  });

  test('an expired cache entry is used when Nominatim fails', async () => {
    search('123 Quezon Ave., Quezon City').reply(500);
    const { geocode, store } = build();
    const old = { query: '123 Quezon Ave., Quezon City', lat: 14.6331, lon: 121.0193, precision: 'street' };
    await store.put('geocode_cache', addressHash(old.query), old, new Date(Date.now() - 45 * DAY));

    expect(await geocode(QC)).toEqual({ lat: 14.6331, lon: 121.0193, precision: 'street', source: 'stale' });
  });

  test('without a contact email Nominatim is never called', async () => {
    const scope = search('123 Quezon Ave., Quezon City').reply(200, hit(14.6, 121));
    const { geocode, log } = build({ contactEmail: null });

    const result = await geocode(QC);

    expect(result).toEqual({ lat: 14.676, lon: 121.0437, precision: 'city', source: 'unavailable' });
    expect(scope.isDone()).toBe(false);
    expect(log.lines).toEqual([]);
  });

  test('after a failure Nominatim is skipped for the cooldown', async () => {
    search('123 Quezon Ave., Quezon City').reply(500);
    const later = search('9 Ayala Ave., City of Makati').reply(200, hit(14.55, 121.02));
    const { geocode } = build({ cooldownMs: 60_000 });

    await geocode(QC);
    const result = await geocode({ address: '9 Ayala Ave.', place: 'City of Makati', psgcCode: '1380300000' });

    expect(result.source).toBe('unavailable');
    expect(later.isDone()).toBe(false);
  });

  test('a broken cache database still geocodes', async () => {
    search('123 Quezon Ave., Quezon City').reply(200, hit(14.6331, 121.0193));
    const { geocode } = build({ store: brokenStore() });

    expect(await geocode(QC)).toMatchObject({ precision: 'street', source: 'ok' });
  });

  test('nothing to search → centroid only', async () => {
    const { geocode } = build();

    expect(await geocode({ address: '', place: null, psgcCode: '1381300000' })).toEqual({
      lat: 14.676,
      lon: 121.0437,
      precision: 'city',
      source: 'unavailable',
    });
  });
});

describe('Nominatim rate limit', () => {
  test('requests start at least the interval apart', async () => {
    const started = [];
    for (const q of ['1 A St., Quezon City', '2 B St., Quezon City', '3 C St., Quezon City']) {
      search(q).reply(() => {
        started.push(Date.now());
        return [200, hit(14.6, 121)];
      });
    }
    const { geocode } = build({ intervalMs: 150 });

    await Promise.all(['1 A St.', '2 B St.', '3 C St.'].map((address) => geocode({ ...QC, address })));

    expect(started).toHaveLength(3);
    expect(started[1] - started[0]).toBeGreaterThanOrEqual(140);
    expect(started[2] - started[1]).toBeGreaterThanOrEqual(140);
  });

  test('a request that would queue too long is not sent and does not start a cooldown', async () => {
    search('1 A St., Quezon City').reply(200, hit(14.6, 121));
    search('3 C St., Quezon City').reply(200, hit(14.7, 121));
    const { geocode } = build({ intervalMs: 300, maxWaitMs: 200, cooldownMs: 60_000 });

    const [first, second] = await Promise.all([geocode({ ...QC, address: '1 A St.' }), geocode({ ...QC, address: '2 B St.' })]);
    await new Promise((resolve) => setTimeout(resolve, 320));
    const third = await geocode({ ...QC, address: '3 C St.' });

    expect(first.source).toBe('ok');
    expect(second).toMatchObject({ precision: 'city', source: 'unavailable' });
    expect(third.source).toBe('ok');
  });
});
