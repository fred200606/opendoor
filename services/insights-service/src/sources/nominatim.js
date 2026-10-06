import axios from 'axios';
import { createThrottle } from '../lib/throttle.js';

// Nominatim usage policy: identify the application with a contact address, at most 1 request/s.
// https://operations.osmfoundation.org/policies/nominatim/

const round6 = (value) => Number(Number(value).toFixed(6));
const SETTLEMENT_TYPES = ['city', 'town', 'municipality'];

/** "Davao City, Davao del Sur" → the names a component naming that city may have. */
function cityNames(query) {
  const name = query.split(',')[0].trim().toLowerCase().replace(/^city of\s+/, '').replace(/\s+city$/, '');
  return [name, `${name} city`, `city of ${name}`];
}

/**
 * A place search's match must be in the city: a city/town/municipality first, else the first
 * result whose address (after its own name) names the city. Free-text search often returns no
 * boundary for a city at all (Mandaue, Ormoc: only places inside it), and the bare name also
 * finds provinces ("Davao, Davao del Sur"), villages and streets of that name elsewhere
 * ("Lapu-Lapu" bus stop in Cebu City). Checked live on 2026-10-07.
 */
function placeMatch(results, query) {
  const names = cityNames(query);
  const inCity = (item) =>
    String(item.display_name ?? '')
      .split(',')
      .slice(1)
      .some((part) => names.includes(part.trim().toLowerCase()));
  return results.find((item) => SETTLEMENT_TYPES.includes(item.addresstype)) ?? results.find(inCity);
}

export function createNominatimClient({ baseUrl, contactEmail, timeoutMs, intervalMs, maxWaitMs }) {
  const http = axios.create({
    baseURL: baseUrl,
    timeout: timeoutMs,
    headers: { 'User-Agent': `OpenDoor/1.0 (${contactEmail})`, Accept: 'application/json' },
  });
  const schedule = createThrottle({ intervalMs, maxWaitMs });

  return {
    /**
     * First match in the Philippines → { lat, lon } (6 dp), or null when nothing matches.
     * `settlement: true` is a city search ("Makati, Metro Manila"): the top 5 are checked with
     * `placeMatch`.
     */
    async search(query, { settlement = false } = {}) {
      const { data } = await schedule(() =>
        http.get('/search', { params: { q: query, countrycodes: 'ph', format: 'jsonv2', limit: settlement ? 5 : 1 } }),
      );
      if (!Array.isArray(data)) throw new Error('Nominatim did not return a list');
      const match = settlement ? placeMatch(data, query) : data[0];
      if (!match) return null;

      const lat = round6(match.lat);
      const lon = round6(match.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error('Nominatim returned no coordinates');
      return { lat, lon };
    },
  };
}
