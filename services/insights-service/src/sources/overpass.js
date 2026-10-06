import axios from 'axios';

// Overpass API client: wheelchair-accessible OSM features around a point.
// A busy server answers 429/504 with an HTML page, or 200 with a "runtime error" remark and
// partial data; both count as failures so incomplete results are never cached.

// Tags the transform and the names need; everything else is dropped before caching.
const KEPT_TAGS = [
  'name',
  'name:en',
  'wheelchair',
  'public_transport',
  'highway',
  'railway',
  'amenity',
  'toilets:wheelchair',
  'capacity:disabled',
];

export function overpassQuery(lat, lon, radiusM) {
  const around = `around:${radiusM},${lat},${lon}`;
  return [
    '[out:json][timeout:8];',
    `( node(${around})["wheelchair"~"yes|limited"];`,
    `  way(${around})["wheelchair"~"yes|limited"]; );`,
    'out center tags 50;',
  ].join('\n');
}

/** Raw element → { type, id, lat, lon, tags } (ways use their centre), or null without a position. */
function trim(element) {
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const tags = {};
  for (const key of KEPT_TAGS) {
    if (typeof element.tags?.[key] === 'string') tags[key] = element.tags[key];
  }
  return { type: element.type, id: element.id, lat, lon, tags };
}

export function createOverpassClient({ url, timeoutMs, userAgent }) {
  const http = axios.create({ timeout: timeoutMs, headers: { 'User-Agent': userAgent, Accept: 'application/json' } });

  return {
    async around(lat, lon, radiusM) {
      const body = new URLSearchParams({ data: overpassQuery(lat, lon, radiusM) });
      const { data } = await http.post(url, body);

      if (!data || !Array.isArray(data.elements)) throw new Error('Overpass did not return JSON elements');
      if (typeof data.remark === 'string' && /error/i.test(data.remark)) {
        throw new Error(`Overpass: ${data.remark.slice(0, 200)}`);
      }
      return data.elements.map(trim).filter(Boolean);
    },
  };
}
