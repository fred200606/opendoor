// mock-external: stands in for the public PSGC, Nominatim and Overpass APIs in the CI integration
// test (docker-compose.ci.yml), so CI never depends on – or loads – the real services.
// No dependencies; answers in each API's own format, with fixed data:
//   GET  /psgc/regions/ … /cities-municipalities/   built from the Insights bundled PSGC fallback
//   GET  /nominatim/search                          one Quezon City result for any query
//   POST /overpass/api/interpreter                  a few wheelchair-tagged places near the point
//   GET  /health

import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

const PORT = Number(process.env.PORT ?? 9000);
const fallback = JSON.parse(readFileSync(process.env.PSGC_DATA ?? '/data/psgc-fallback.json', 'utf8'));

// ------------------------------------------------------------------ PSGC

/** Normalized fallback item → the PSGC API's own shape (9-digit `code`, `psgc10DigitCode`). */
const raw = ({ code, name, level, ref }) => ({
  code: ref,
  name,
  psgc10DigitCode: code,
  ...(level === 'city' || level === 'municipality' ? { isCity: level === 'city' } : {}),
});

const lists = Object.entries(fallback).filter(([key]) => key !== 'regions');
const byRef = (items, ref) => items.find((item) => item.ref === ref);
const provinces = lists.filter(([key]) => key.startsWith('provinces:')).flatMap(([, items]) => items);

function psgc(path) {
  const parts = path.split('/').filter(Boolean); // e.g. ['regions', '130000000', 'provinces']
  if (parts.length === 1 && parts[0] === 'regions') return fallback.regions.map(raw);

  const [kind, ref, list] = parts;
  if (kind === 'regions' && parts.length === 3) {
    const region = byRef(fallback.regions, ref);
    if (!region) return null;
    const regionProvinces = fallback[`provinces:${region.code}`] ?? [];
    if (list === 'provinces') return regionProvinces.map(raw);
    if (list === 'cities-municipalities') {
      // NCR has no provinces: its cities are listed under the region's own code.
      const own = fallback[`cities:${region.code}`] ?? [];
      return [...own, ...regionProvinces.flatMap((p) => fallback[`cities:${p.code}`] ?? [])].map(raw);
    }
  }
  if (kind === 'provinces' && parts.length === 3 && list === 'cities-municipalities') {
    const province = byRef(provinces, ref);
    return province ? (fallback[`cities:${province.code}`] ?? []).map(raw) : null;
  }
  return null;
}

// ------------------------------------------------------------------ Nominatim

const QUEZON_CITY = { lat: 14.651, lon: 121.0493 };

function nominatim(query) {
  return [
    {
      place_id: 1,
      lat: String(QUEZON_CITY.lat),
      lon: String(QUEZON_CITY.lon),
      addresstype: 'city',
      display_name: `${query.get('q') ?? 'Quezon City'}, Metro Manila, Philippines`,
    },
  ];
}

// ------------------------------------------------------------------ Overpass

function overpass(body) {
  const query = new URLSearchParams(body).get('data') ?? '';
  const match = /around:(\d+),(-?[\d.]+),(-?[\d.]+)/.exec(query);
  if (!match) return { elements: [] };
  const lat = Number(match[2]);
  const lon = Number(match[3]);
  // 0.001° latitude ≈ 111 m, so every place is well inside the 500 m radius.
  const node = (id, dLat, dLon, tags) => ({ type: 'node', id, lat: lat + dLat, lon: lon + dLon, tags });
  return {
    elements: [
      node(1, 0.001, 0, { name: 'Mock Avenue Bus Stop', highway: 'bus_stop', wheelchair: 'yes' }),
      node(2, 0, 0.002, { name: 'Mock Mall Restroom', amenity: 'toilets', wheelchair: 'yes' }),
      node(3, -0.0015, 0, { name: 'Mock Parking', amenity: 'parking', wheelchair: 'limited' }),
      node(4, 0.002, 0.001, { name: 'Mock Public Library', amenity: 'library', wheelchair: 'yes' }),
    ],
  };
}

// ------------------------------------------------------------------ server

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

createServer((req, res) => {
  const url = new URL(req.url, 'http://mock');
  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => {
    if (url.pathname === '/health') return send(res, 200, { status: 'ok' });
    if (req.method === 'GET' && url.pathname.startsWith('/psgc/')) {
      const data = psgc(url.pathname.slice('/psgc'.length));
      return data ? send(res, 200, data) : send(res, 404, { message: 'Not found' });
    }
    if (req.method === 'GET' && url.pathname === '/nominatim/search') return send(res, 200, nominatim(url.searchParams));
    if (req.method === 'POST' && url.pathname === '/overpass/api/interpreter') return send(res, 200, overpass(body));
    return send(res, 404, { message: 'Not found' });
  });
}).listen(PORT, () => console.log(`mock-external listening on :${PORT}`));
