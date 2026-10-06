import { createHash } from 'node:crypto';
import { createCooldown } from '../lib/cooldown.js';

const normalize = (query) => query.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Place part of a Nominatim query: "Makati, Metro Manila", "Cebu, Cebu". OSM names drop PSGC's
 * "City of" prefix, and region names ("National Capital Region (NCR)") only confuse the search.
 */
export function placeQuery({ city, province }) {
  return [city.replace(/^City of\s+/i, '').trim(), province ?? 'Metro Manila'].join(', ');
}
export const addressHash = (query) => createHash('sha256').update(normalize(query)).digest('hex');

/**
 * Geocodes a workplace for the snapshot.
 *
 * 1. `geocode_cache` (30 days), keyed by the hash of "address, place"
 * 2. Nominatim "address, place" → precision "street"; no match → Nominatim "place" → precision "city"
 *    (stored under the same key, so the next snapshot needs no request)
 * 3. Nominatim failed: an expired cache entry (stale), else the bundled city centroid for the PSGC
 *    code (precision "city"), else no coordinates
 *
 * `nominatim` is null when no contact email is configured (the policy requires one): then only
 * the cache and the bundled centroids are used.
 *
 * @returns {Promise<{ lat: number|null, lon: number|null, precision: 'street'|'city'|null,
 *   source: 'ok'|'cached'|'stale'|'unavailable' }>}
 */
export function createGeocoder({ nominatim, cached, ttlMs, cooldownMs, centroids, log = console }) {
  const search = nominatim ? createCooldown('Nominatim', cooldownMs)((query) => nominatim.search(query)) : null;

  function centroid(psgcCode, source) {
    const point = psgcCode ? centroids[psgcCode] : undefined;
    return point ? { lat: point.lat, lon: point.lon, precision: 'city', source } : { lat: null, lon: null, precision: null, source };
  }

  return async function geocode({ address, place, psgcCode }) {
    const query = [address, place].filter(Boolean).join(', ');
    if (!query) return centroid(psgcCode, 'unavailable');

    const fetch = async () => {
      if (!search) throw Object.assign(new Error('Nominatim is not configured (NOMINATIM_CONTACT_EMAIL)'), { code: 'DISABLED' });

      const street = address ? await search(query) : null;
      if (street) return { query, ...street, precision: 'street' };

      const city = place ? await search(place) : null;
      if (city) return { query, ...city, precision: 'city' };

      throw Object.assign(new Error('Nominatim found no match'), { code: 'NO_MATCH' });
    };

    try {
      const { value, source } = await cached({ table: 'geocode_cache', key: addressHash(query), ttlMs, fetch });
      return { lat: value.lat, lon: value.lon, precision: value.precision, source };
    } catch (err) {
      // Nominatim answered but knows neither the street nor the place: the source itself is fine.
      if (err.code === 'NO_MATCH') return centroid(psgcCode, 'ok');
      if (err.code !== 'DISABLED') log.error(JSON.stringify({ source: 'nominatim', error: err.code ?? err.message }));
      return centroid(psgcCode, 'unavailable');
    }
  };
}
