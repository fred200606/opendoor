// Builds src/data/city-centroids.json: { "<10-digit PSGC code>": { lat, lon } } for every city in
// the bundled PSGC fallback (NCR + the cities of each province), geocoded once with Nominatim.
// The geocoder uses it when Nominatim is down and the workplace is not cached (precision "city").
//
// Usage (needs NOMINATIM_CONTACT_EMAIL, as the Nominatim usage policy requires; ~2.5 min at 1 request/s):
//   npm run build:city-centroids   (reads .env)

import { readFileSync, writeFileSync } from 'node:fs';
import { placeQueries } from '../src/services/geocoder.js';
import { createNominatimClient } from '../src/sources/nominatim.js';

const contactEmail = process.env.NOMINATIM_CONTACT_EMAIL?.trim();
if (!contactEmail) {
  console.error('Set NOMINATIM_CONTACT_EMAIL first (Nominatim usage policy).');
  process.exit(1);
}

const nominatim = createNominatimClient({
  baseUrl: (process.env.NOMINATIM_URL ?? 'https://nominatim.openstreetmap.org').replace(/\/+$/, ''),
  contactEmail,
  timeoutMs: 15_000,
  intervalMs: 1_100,
  maxWaitMs: 5_000,
});

const fallback = JSON.parse(readFileSync(new URL('../src/data/psgc-fallback.json', import.meta.url), 'utf8'));
const provinceNames = new Map(
  Object.entries(fallback)
    .filter(([key]) => key.startsWith('provinces:'))
    .flatMap(([, items]) => items.map((item) => [item.code, item.name])),
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A network hiccup (DNS, reset, 5xx) should not end a run of ~150 lookups: retry twice. */
async function searchWithRetry(query) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await nominatim.search(query, { settlement: true });
    } catch (err) {
      if (attempt === 3) throw err;
      console.warn(`${query}: ${err.code ?? err.message}; retrying`);
      await sleep(5_000 * attempt);
    }
  }
}

const centroids = {};
const missing = [];
for (const [key, cities] of Object.entries(fallback)) {
  if (!key.startsWith('cities:')) continue;
  const parent = key.slice('cities:'.length);
  const province = provinceNames.get(parent) ?? null; // NCR has none

  for (const city of cities) {
    let point = null;
    for (const query of placeQueries({ city: city.name, province })) {
      point = await searchWithRetry(query);
      if (point) break;
    }
    if (point) centroids[city.code] = point;
    else missing.push(`${city.code} ${city.name}`);
  }
}

const sorted = Object.fromEntries(Object.entries(centroids).sort(([a], [b]) => a.localeCompare(b)));
const lines = Object.entries(sorted).map(([code, point]) => `  ${JSON.stringify(code)}: ${JSON.stringify(point)}`);
writeFileSync(new URL('../src/data/city-centroids.json', import.meta.url), `{\n${lines.join(',\n')}\n}\n`);

console.log(`Wrote ${lines.length} centroids.`);
if (missing.length > 0) console.log(`Not found (${missing.length}):\n  ${missing.join('\n  ')}`);
