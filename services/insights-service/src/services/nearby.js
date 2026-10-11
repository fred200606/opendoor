import { createCooldown } from '../lib/cooldown.js';

const EARTH_RADIUS_M = 6_371_008.8;
const PER_CATEGORY = 3;
const CATEGORIES = ['transit_stops', 'toilets', 'parking', 'other'];
const toRad = (deg) => (deg * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversineM(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** OSM tags → snapshot category; checked top to bottom, first match wins (SIA doc 4.5). */
export function categoryOf(tags) {
  if (
    tags.public_transport !== undefined ||
    tags.highway === 'bus_stop' ||
    ['station', 'halt', 'tram_stop'].includes(tags.railway) ||
    tags.amenity === 'bus_station'
  ) {
    return 'transit_stops';
  }
  if (tags.amenity === 'toilets' || tags['toilets:wheelchair'] === 'yes') return 'toilets';
  if (tags.amenity === 'parking') return 'parking';
  return 'other';
}

/**
 * Trimmed Overpass elements → { radius_m, transit_stops, toilets, parking, other }, each list the
 * nearest 3 places within the radius ({ name, wheelchair, distance_m }), de-duplicated by OSM id.
 */
export function toNearby(elements, origin, radiusM) {
  const seen = new Set();
  const lists = Object.fromEntries(CATEGORIES.map((category) => [category, []]));

  for (const element of elements) {
    const id = `${element.type}/${element.id}`;
    const wheelchair = element.tags.wheelchair?.trim();
    if (seen.has(id) || !['yes', 'limited'].includes(wheelchair)) continue;
    seen.add(id);

    // A way is found when any part is in range, but its centre can lie outside.
    const distance = Math.round(haversineM(origin, element));
    if (distance > radiusM) continue;

    const category = categoryOf(element.tags);
    const name = element.tags.name ?? element.tags['name:en'] ?? null;
    // An unnamed stop, toilet or car park is still useful; an unnamed "other" point (often an
    // entrance or kerb) would only read as "Unnamed place".
    if (category === 'other' && !name) continue;

    lists[category].push({ name, wheelchair, distance_m: distance });
  }

  const nearest = (a, b) => a.distance_m - b.distance_m || (a.name ?? '').localeCompare(b.name ?? '');
  return {
    radius_m: radiusM,
    ...Object.fromEntries(CATEGORIES.map((category) => [category, lists[category].sort(nearest).slice(0, PER_CATEGORY)])),
  };
}

// Places waiting for a background retry at the same time (each one holds a timer).
const MAX_RETRYING = 50;

/**
 * Accessible places around a point. The Overpass answer is cached 24 h under the point rounded
 * to 4 dp (~11 m) plus the radius; distances are always measured from the exact point.
 *
 * When Overpass fails (nothing or only an expired entry to show), the place is fetched again in
 * the background after each of `retryDelaysMs` until the cache is filled, so a later visitor gets
 * the places without waiting. One retry chain per place; kept in memory only.
 *
 * @returns {Promise<{ nearby: object|null, source: 'ok'|'cached'|'stale'|'unavailable' }>}
 *   `nearby` is null without coordinates or when Overpass fails with nothing cached.
 */
export function createNearby({ overpass, cached, ttlMs, cooldownMs, radiusM, retryDelaysMs = [], log = console }) {
  const around = createCooldown('Overpass', cooldownMs)((lat, lon) => overpass.around(lat, lon, radiusM));
  const retrying = new Set();

  const lookup = (rLat, rLon, key) => cached({ table: 'overpass_cache', key, ttlMs, fetch: () => around(rLat, rLon) });

  function retryLater(rLat, rLon, key) {
    if (retryDelaysMs.length === 0 || retrying.has(key) || retrying.size >= MAX_RETRYING) return;
    retrying.add(key);

    const attempt = (n) => {
      const timer = setTimeout(async () => {
        const source = await lookup(rLat, rLon, key).then(
          (result) => result.source,
          () => 'unavailable',
        );
        if (source === 'ok' || source === 'cached') {
          retrying.delete(key);
          log.log(JSON.stringify({ source: 'overpass', key, retry: n + 1, result: 'cache filled' }));
        } else if (n + 1 < retryDelaysMs.length) {
          attempt(n + 1);
        } else {
          retrying.delete(key);
          log.error(JSON.stringify({ source: 'overpass', key, retry: n + 1, result: 'gave up' }));
        }
      }, retryDelaysMs[n]);
      // A pending retry must not keep the process alive at shutdown.
      timer.unref?.();
    };
    attempt(0);
  }

  return async function nearby({ lat, lon }) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { nearby: null, source: 'unavailable' };

    const rLat = Number(lat.toFixed(4));
    const rLon = Number(lon.toFixed(4));
    const key = `${rLat.toFixed(4)},${rLon.toFixed(4)},${radiusM}`;
    try {
      const { value, source } = await lookup(rLat, rLon, key);
      if (source === 'stale') retryLater(rLat, rLon, key);
      return { nearby: toNearby(value, { lat, lon }, radiusM), source };
    } catch (err) {
      log.error(JSON.stringify({ source: 'overpass', error: err.code ?? err.message }));
      retryLater(rLat, rLon, key);
      return { nearby: null, source: 'unavailable' };
    }
  };
}
