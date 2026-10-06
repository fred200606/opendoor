import nock from 'nock';
import { createCached } from '../src/cache/cached.js';
import { createMemoryStore } from '../src/cache/memoryStore.js';
import { categoryOf, createNearby, haversineM, toNearby } from '../src/services/nearby.js';
import { createOverpassClient, overpassQuery } from '../src/sources/overpass.js';
import { brokenStore, silentLog } from './helpers.js';

const HOUR = 60 * 60 * 1000;
const ORIGIN = { lat: 14.633159, lon: 121.019342 };

/** A point `metres` north of ORIGIN (1° latitude ≈ 111 195 m with the mean Earth radius). */
const north = (metres) => ({ lat: ORIGIN.lat + metres / 111_195.08, lon: ORIGIN.lon });
const node = (id, metres, tags) => ({ type: 'node', id, ...north(metres), tags: { wheelchair: 'yes', ...tags } });

describe('haversineM', () => {
  test('one degree of latitude is about 111.2 km; a point to itself is 0', () => {
    expect(Math.round(haversineM({ lat: 0, lon: 0 }, { lat: 1, lon: 0 }))).toBe(111_195);
    expect(haversineM(ORIGIN, ORIGIN)).toBe(0);
  });

  test('Quezon Ave. MRT to Ayala MRT is about 10 km and symmetric', () => {
    const a = { lat: 14.6427, lon: 121.0388 };
    const b = { lat: 14.5491, lon: 121.0279 };
    expect(Math.round(haversineM(a, b) / 100) / 10).toBe(10.5);
    expect(haversineM(a, b)).toBeCloseTo(haversineM(b, a), 6);
  });
});

describe('categoryOf (first match wins)', () => {
  test.each([
    [{ public_transport: 'platform' }, 'transit_stops'],
    [{ public_transport: 'stop_position', amenity: 'toilets' }, 'transit_stops'],
    [{ highway: 'bus_stop' }, 'transit_stops'],
    [{ railway: 'station' }, 'transit_stops'],
    [{ railway: 'halt' }, 'transit_stops'],
    [{ railway: 'tram_stop' }, 'transit_stops'],
    [{ amenity: 'bus_station' }, 'transit_stops'],
    [{ railway: 'subway_entrance' }, 'other'],
    [{ amenity: 'toilets' }, 'toilets'],
    [{ amenity: 'restaurant', 'toilets:wheelchair': 'yes' }, 'toilets'],
    [{ amenity: 'restaurant', 'toilets:wheelchair': 'no' }, 'other'],
    [{ amenity: 'parking', 'capacity:disabled': '4' }, 'parking'],
    [{ amenity: 'parking', 'toilets:wheelchair': 'yes' }, 'toilets'],
    [{ amenity: 'bank' }, 'other'],
    [{}, 'other'],
  ])('%j → %s', (tags, category) => {
    expect(categoryOf(tags)).toBe(category);
  });
});

describe('toNearby', () => {
  test('keeps the nearest 3 per category, sorted by distance, with integer metres', () => {
    const elements = [
      node(1, 400, { highway: 'bus_stop', name: 'Far stop' }),
      node(2, 100, { highway: 'bus_stop', name: 'Near stop' }),
      node(3, 250.4, { railway: 'station', name: 'Quezon Ave. MRT Station' }),
      node(4, 300, { public_transport: 'platform', name: 'Platform' }),
      node(5, 50, { amenity: 'toilets', wheelchair: 'limited' }),
    ];

    expect(toNearby(elements, ORIGIN, 500)).toEqual({
      radius_m: 500,
      transit_stops: [
        { name: 'Near stop', wheelchair: 'yes', distance_m: 100 },
        { name: 'Quezon Ave. MRT Station', wheelchair: 'yes', distance_m: 250 },
        { name: 'Platform', wheelchair: 'yes', distance_m: 300 },
      ],
      toilets: [{ name: null, wheelchair: 'limited', distance_m: 50 }],
      parking: [],
      other: [],
    });
  });

  test('drops duplicates, other wheelchair values and ways whose centre is outside the radius', () => {
    const elements = [
      node(1, 100, { amenity: 'parking' }),
      node(1, 100, { amenity: 'parking' }),
      { type: 'way', id: 1, ...north(120), tags: { wheelchair: 'yes ', amenity: 'parking', 'name:en': 'SM North Parking' } },
      node(2, 150, { amenity: 'parking', wheelchair: 'no' }),
      node(3, 160, { amenity: 'parking', wheelchair: 'yes;limited' }),
      { type: 'way', id: 9, ...north(650), tags: { wheelchair: 'yes', amenity: 'parking', name: 'Big lot' } },
    ];

    expect(toNearby(elements, ORIGIN, 500).parking).toEqual([
      { name: null, wheelchair: 'yes', distance_m: 100 },
      { name: 'SM North Parking', wheelchair: 'yes', distance_m: 120 },
    ]);
  });

  test('unnamed places are left out of "other" only', () => {
    const elements = [
      node(1, 40, { entrance: 'main' }),
      node(2, 60, { shop: 'convenience', name: 'Lawson' }),
      node(3, 70, { highway: 'bus_stop' }),
    ];

    const result = toNearby(elements, ORIGIN, 500);

    expect(result.other).toEqual([{ name: 'Lawson', wheelchair: 'yes', distance_m: 60 }]);
    expect(result.transit_stops).toEqual([{ name: null, wheelchair: 'yes', distance_m: 70 }]);
  });

  test('nothing around → empty lists, not null', () => {
    expect(toNearby([], ORIGIN, 500)).toEqual({ radius_m: 500, transit_stops: [], toilets: [], parking: [], other: [] });
  });
});

describe('nearby (Overpass + cache)', () => {
  const overpass = () => nock('http://overpass.test');
  const answer = (elements, extra = {}) => ({ version: 0.6, generator: 'Overpass API', elements, ...extra });
  const raw = [
    { type: 'node', id: 11, ...north(220), tags: { railway: 'station', name: 'Quezon Ave. MRT Station', wheelchair: 'yes', operator: 'DOTr' } },
    { type: 'way', id: 22, center: north(80), tags: { amenity: 'parking', wheelchair: 'limited', building: 'yes' } },
    { type: 'relation', id: 33, tags: { amenity: 'toilets', wheelchair: 'yes' } },
  ];

  function build({ store = createMemoryStore(), timeoutMs = 1_000, cooldownMs = 0 } = {}) {
    const log = silentLog();
    const nearby = createNearby({
      overpass: createOverpassClient({ url: 'http://overpass.test/api/interpreter', timeoutMs, userAgent: 'OpenDoor/1.0 (team@opendoor.test)' }),
      cached: createCached(store, { log }),
      ttlMs: 24 * HOUR,
      cooldownMs,
      radiusM: 500,
      log,
    });
    return { nearby, store, log };
  }

  beforeAll(() => nock.disableNetConnect());
  afterEach(() => nock.cleanAll());
  afterAll(() => nock.enableNetConnect());

  test('POSTs the documented query around the rounded point and transforms the answer', async () => {
    let sent;
    overpass()
      .post('/api/interpreter', (body) => {
        sent = body.data;
        return true;
      })
      .matchHeader('user-agent', 'OpenDoor/1.0 (team@opendoor.test)')
      .reply(200, answer(raw));
    const { nearby } = build();

    const result = await nearby(ORIGIN);

    expect(sent).toBe(overpassQuery(14.6332, 121.0193, 500));
    expect(sent).toBe(
      '[out:json][timeout:8];\n( node(around:500,14.6332,121.0193)["wheelchair"~"yes|limited"];\n  way(around:500,14.6332,121.0193)["wheelchair"~"yes|limited"]; );\nout center tags 50;',
    );
    expect(result).toEqual({
      source: 'ok',
      nearby: {
        radius_m: 500,
        transit_stops: [{ name: 'Quezon Ave. MRT Station', wheelchair: 'yes', distance_m: 220 }],
        toilets: [],
        parking: [{ name: null, wheelchair: 'limited', distance_m: 80 }],
        other: [],
      },
    });
  });

  test('caches trimmed elements for 24 h under the rounded point; distances use the exact point', async () => {
    const scope = overpass().post('/api/interpreter').once().reply(200, answer(raw));
    const { nearby, store } = build();

    await nearby(ORIGIN);
    const again = await nearby({ lat: ORIGIN.lat + 0.00002, lon: ORIGIN.lon });

    expect(scope.isDone()).toBe(true);
    expect(again.source).toBe('cached');
    expect(again.nearby.transit_stops[0].distance_m).toBe(218);
    const entry = await store.get('overpass_cache', '14.6332,121.0193,500');
    expect(entry.payload[0]).toEqual({
      type: 'node',
      id: 11,
      ...north(220),
      tags: { railway: 'station', name: 'Quezon Ave. MRT Station', wheelchair: 'yes' },
    });
    expect(entry.payload).toHaveLength(2);
  });

  test('an entry older than 24 h is refreshed', async () => {
    overpass().post('/api/interpreter').reply(200, answer([]));
    const { nearby, store } = build();
    await store.put('overpass_cache', '14.6332,121.0193,500', [raw[0]], new Date(Date.now() - 25 * HOUR));

    const result = await nearby(ORIGIN);

    expect(result.source).toBe('ok');
    expect(result.nearby.transit_stops).toEqual([]);
  });

  test.each([
    ['a busy server (504 HTML)', (scope) => scope.reply(504, '<html>The server is probably too busy</html>', { 'Content-Type': 'text/html' })],
    ['too many requests (429)', (scope) => scope.reply(429, 'rate_limited')],
    ['a runtime error remark with partial data', (scope) => scope.reply(200, answer([raw[0]], { remark: 'runtime error: Query timed out in "query" at line 2 after 8 seconds.' }))],
    ['an answer without elements', (scope) => scope.reply(200, { version: 0.6 })],
    ['a refused connection', (scope) => scope.replyWithError(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }))],
  ])('%s → null and "unavailable", nothing cached', async (_, respond) => {
    respond(overpass().post('/api/interpreter'));
    const { nearby, store, log } = build();

    expect(await nearby(ORIGIN)).toEqual({ nearby: null, source: 'unavailable' });
    expect(await store.get('overpass_cache', '14.6332,121.0193,500')).toBeNull();
    expect(log.lines.join('\n')).toContain('"source":"overpass"');
  });

  test('a timeout counts as unavailable', async () => {
    overpass().post('/api/interpreter').delay(300).reply(200, answer(raw));
    const { nearby } = build({ timeoutMs: 50 });

    expect((await nearby(ORIGIN)).source).toBe('unavailable');
  });

  test('an expired entry is served as stale when Overpass fails', async () => {
    overpass().post('/api/interpreter').reply(504);
    const { nearby, store } = build();
    await store.put('overpass_cache', '14.6332,121.0193,500', [raw[0]], new Date(Date.now() - 72 * HOUR));

    const result = await nearby(ORIGIN);

    expect(result.source).toBe('stale');
    expect(result.nearby.transit_stops).toHaveLength(1);
  });

  test('after a failure Overpass is skipped for the cooldown', async () => {
    overpass().post('/api/interpreter').reply(504);
    const second = overpass().post('/api/interpreter').reply(200, answer(raw));
    const { nearby } = build({ cooldownMs: 60_000 });

    await nearby(ORIGIN);
    const result = await nearby({ lat: 14.5547, lon: 121.0244 });

    expect(result.source).toBe('unavailable');
    expect(second.isDone()).toBe(false);
  });

  test('no coordinates → no request', async () => {
    const scope = overpass().post('/api/interpreter').reply(200, answer(raw));
    const { nearby } = build();

    expect(await nearby({ lat: null, lon: null })).toEqual({ nearby: null, source: 'unavailable' });
    expect(scope.isDone()).toBe(false);
  });

  test('a broken cache database still answers', async () => {
    overpass().post('/api/interpreter').reply(200, answer(raw));
    const { nearby } = build({ store: brokenStore() });

    expect((await nearby(ORIGIN)).source).toBe('ok');
  });
});
