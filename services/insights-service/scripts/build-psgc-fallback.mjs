// Builds src/data/psgc-fallback.json from the live PSGC API: all regions, all provinces, every
// NCR city/municipality and the cities (not municipalities) of each province. The service uses it
// only when PSGC is down and nothing is cached. Keys match the psgc_cache keys.
//
// Usage: npm run build:psgc-fallback   (PSGC_URL optional, defaults to https://psgc.gitlab.io/api)

import { writeFileSync } from 'node:fs';
import { createPsgcClient } from '../src/sources/psgc.js';

const NCR = '1300000000';
const baseUrl = (process.env.PSGC_URL ?? 'https://psgc.gitlab.io/api').replace(/\/+$/, '');
const psgc = createPsgcClient({ baseUrl, timeoutMs: 15_000 });
const pause = () => new Promise((resolve) => setTimeout(resolve, 150));

const data = { regions: await psgc.regions() };

for (const region of data.regions) {
  if (region.code === NCR) {
    data[`provinces:${region.code}`] = []; // same answer as PSGC: NCR has no provinces
    data[`cities:${region.code}`] = await psgc.citiesOfRegion(region.ref);
    await pause();
    continue;
  }

  const provinces = await psgc.provincesOfRegion(region.ref);
  data[`provinces:${region.code}`] = provinces;
  await pause();

  for (const province of provinces) {
    const cities = (await psgc.citiesOfProvince(province.ref)).filter((item) => item.level === 'city');
    if (cities.length > 0) data[`cities:${province.code}`] = cities;
    await pause();
  }
}

// One list item per line keeps the file small and its diffs readable.
const lines = Object.entries(data).map(
  ([key, items]) =>
    items.length === 0
      ? `  ${JSON.stringify(key)}: []`
      : `  ${JSON.stringify(key)}: [\n${items.map((item) => `    ${JSON.stringify(item)}`).join(',\n')}\n  ]`,
);
const target = new URL('../src/data/psgc-fallback.json', import.meta.url);
writeFileSync(target, `{\n${lines.join(',\n')}\n}\n`);

const count = (prefix) => Object.keys(data).filter((key) => key.startsWith(prefix)).reduce((n, key) => n + data[key].length, 0);
console.log(`Wrote ${target.pathname}: ${data.regions.length} regions, ${count('provinces:')} provinces, ${count('cities:')} cities`);
