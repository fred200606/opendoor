import axios from 'axios';
import { createCooldown } from '../lib/cooldown.js';

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

/**
 * Overpass with an optional second server (`fallbackUrl`). The main server is asked first; the
 * fallback is asked as well when the main one fails or has not answered after `hedgeMs`. The first
 * good answer wins and the other request is cancelled. A server that failed is skipped for
 * `cooldownMs`, so during its outage requests go straight to the other one.
 */
export function createOverpassClient({ url, fallbackUrl = null, timeoutMs, hedgeMs = Infinity, cooldownMs = 0, userAgent, log = console }) {
  const http = axios.create({ timeout: timeoutMs, headers: { 'User-Agent': userAgent, Accept: 'application/json' } });

  async function ask(serverUrl, body, signal) {
    let data;
    try {
      ({ data } = await http.post(serverUrl, body, { signal }));
    } catch (err) {
      // Cancelled because the other server answered first: this server is not down.
      if (axios.isCancel(err)) err.noCooldown = true;
      throw err;
    }
    if (!data || !Array.isArray(data.elements)) throw new Error('Overpass did not return JSON elements');
    if (typeof data.remark === 'string' && /error/i.test(data.remark)) {
      throw new Error(`Overpass: ${data.remark.slice(0, 200)}`);
    }
    return data.elements.map(trim).filter(Boolean);
  }

  const servers = [url, fallbackUrl].filter(Boolean).map((serverUrl) => {
    const host = new URL(serverUrl).host;
    return { host, ask: createCooldown(`Overpass ${host}`, cooldownMs)((body, signal) => ask(serverUrl, body, signal)) };
  });

  return {
    around(lat, lon, radiusM) {
      const body = new URLSearchParams({ data: overpassQuery(lat, lon, radiusM) });

      return new Promise((resolve, reject) => {
        const controllers = [];
        let next = 0;
        let running = 0;
        let settled = false;
        let hedge = null;

        const settle = (finish, value) => {
          settled = true;
          clearTimeout(hedge);
          finish(value);
        };

        const start = () => {
          if (settled || next >= servers.length) return;
          const server = servers[next++];
          const controller = new AbortController();
          controllers.push(controller);
          running += 1;
          clearTimeout(hedge);
          if (next < servers.length && Number.isFinite(hedgeMs)) hedge = setTimeout(start, hedgeMs);

          server.ask(body, controller.signal).then(
            (elements) => {
              if (settled) return;
              controllers.filter((other) => other !== controller).forEach((other) => other.abort());
              settle(resolve, elements);
            },
            (err) => {
              running -= 1;
              if (settled) return;
              // With one server, nearby.js logs the failure.
              if (servers.length > 1 && err.code !== 'COOLDOWN') {
                log.warn(JSON.stringify({ source: 'overpass', server: server.host, error: err.response?.status ?? err.code ?? err.message }));
              }
              if (next < servers.length) start();
              else if (running === 0) settle(reject, err);
            },
          );
        };

        start();
      });
    },
  };
}
