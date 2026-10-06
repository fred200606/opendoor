import axios from 'axios';
import { createThrottle } from '../lib/throttle.js';

// Nominatim usage policy: identify the application with a contact address, at most 1 request/s.
// https://operations.osmfoundation.org/policies/nominatim/

const round6 = (value) => Number(Number(value).toFixed(6));

export function createNominatimClient({ baseUrl, contactEmail, timeoutMs, intervalMs, maxWaitMs }) {
  const http = axios.create({
    baseURL: baseUrl,
    timeout: timeoutMs,
    headers: { 'User-Agent': `OpenDoor/1.0 (${contactEmail})`, Accept: 'application/json' },
  });
  const schedule = createThrottle({ intervalMs, maxWaitMs });

  return {
    /** First match in the Philippines → { lat, lon } (6 dp), or null when nothing matches. */
    async search(query) {
      const { data } = await schedule(() =>
        http.get('/search', { params: { q: query, countrycodes: 'ph', format: 'jsonv2', limit: 1 } }),
      );
      if (!Array.isArray(data)) throw new Error('Nominatim did not return a list');
      if (data.length === 0) return null;

      const lat = round6(data[0].lat);
      const lon = round6(data[0].lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error('Nominatim returned no coordinates');
      return { lat, lon };
    },
  };
}
