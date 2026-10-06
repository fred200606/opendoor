import axios from 'axios';

// Client for the PSGC API (https://psgc.gitlab.io/api). The API's URLs take its own 9-digit
// codes; OpenDoor stores and returns the official 10-digit PSGC codes. The two cannot be
// converted by rule (BARMM: region 150000000 ↔ 1900000000), so each normalized item keeps
// the API's code as `ref` for follow-up requests.

const collator = new Intl.Collator('en', { sensitivity: 'base' });
const byName = (a, b) => collator.compare(a.name, b.name);

/** "Ilocos Region (Region I)", "National Capital Region (NCR)", "MIMAROPA Region". */
function regionName({ name, regionName }) {
  if (!regionName || regionName === name) return name;
  if (/^Region [IVX]/.test(regionName)) return `${name} (${regionName})`;
  return `${regionName} (${name})`;
}

export const normalize = {
  regions: (items) =>
    items.map((item) => ({ code: item.psgc10DigitCode, name: regionName(item), level: 'region', ref: item.code })).sort(byName),
  provinces: (items) =>
    items.map((item) => ({ code: item.psgc10DigitCode, name: item.name, level: 'province', ref: item.code })).sort(byName),
  cities: (items) =>
    items
      .map((item) => ({
        code: item.psgc10DigitCode,
        name: item.name,
        level: item.isCity ? 'city' : 'municipality',
        ref: item.code,
      }))
      .sort(byName),
};

export function createPsgcClient({ baseUrl, timeoutMs }) {
  const http = axios.create({ baseURL: baseUrl, timeout: timeoutMs, headers: { Accept: 'application/json' } });

  async function list(path) {
    const { data } = await http.get(path);
    if (!Array.isArray(data)) throw new Error(`PSGC ${path} did not return a list`);
    return data;
  }

  return {
    regions: async () => normalize.regions(await list('/regions/')),
    provincesOfRegion: async (regionRef) => normalize.provinces(await list(`/regions/${regionRef}/provinces/`)),
    citiesOfRegion: async (regionRef) => normalize.cities(await list(`/regions/${regionRef}/cities-municipalities/`)),
    citiesOfProvince: async (provinceRef) => normalize.cities(await list(`/provinces/${provinceRef}/cities-municipalities/`)),
  };
}
