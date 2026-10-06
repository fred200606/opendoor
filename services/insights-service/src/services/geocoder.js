import { createHash } from 'node:crypto';
import { createCooldown } from '../lib/cooldown.js';

const normalize = (query) => query.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Place searches for a city, best first: "Makati, Metro Manila", then for PSGC's "City of X" also
 * "X City, Province" and "X City" alone. The bare name can only find a province of the same name
 * ("Davao, Davao del Sur"), and an independent city can lie outside its province's OSM boundary
 * (Zamboanga City), so the later forms are tried when the first finds no city or town.
 * Checked live on 2026-10-07. NCR has no province: "Metro Manila".
 */
export function placeQueries({ city, province }) {
  const area = province ?? 'Metro Manila';
  const name = city.trim();
  const bare = name.replace(/^City of\s+/i, '');
  if (bare === name) return [`${name}, ${area}`];
  return [`${bare}, ${area}`, `${bare} City, ${area}`, `${bare} City`];
}

export const addressHash = (query) => createHash('sha256').update(normalize(query)).digest('hex');

/**
 * Geocodes a workplace for the snapshot.
 *
 * 1. `geocode_cache` (30 days), keyed by the hash of "address, place" (the first place query)
 * 2. Nominatim "address, place" → precision "street"; no match → the place queries in order, each
 *    accepting only a city/town/municipality → precision "city" (stored under the same key, so
 *    the next snapshot needs no request). `place` is one query or a list (`placeQueries`).
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
  const search = nominatim ? createCooldown('Nominatim', cooldownMs)((query, options) => nominatim.search(query, options)) : null;

  function centroid(psgcCode, source) {
    const point = psgcCode ? centroids[psgcCode] : undefined;
    return point ? { lat: point.lat, lon: point.lon, precision: 'city', source } : { lat: null, lon: null, precision: null, source };
  }

  return async function geocode({ address, place, psgcCode }) {
    const places = [place ?? []].flat().filter(Boolean);
    const query = [address, places[0]].filter(Boolean).join(', ');
    if (!query) return centroid(psgcCode, 'unavailable');

    const fetch = async () => {
      if (!search) throw Object.assign(new Error('Nominatim is not configured (NOMINATIM_CONTACT_EMAIL)'), { code: 'DISABLED' });

      const street = address ? await search(query) : null;
      if (street) return { query, ...street, precision: 'street' };

      for (const candidate of places) {
        const city = await search(candidate, { settlement: true });
        if (city) return { query, ...city, precision: 'city' };
      }

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
