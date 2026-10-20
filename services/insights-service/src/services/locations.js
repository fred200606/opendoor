import { createCooldown } from '../lib/cooldown.js';
import { ApiError } from '../lib/errors.js';

const regionOf = (code) => `${code.slice(0, 2)}00000000`;

/**
 * PSGC location lists for the pickers. Lists are cached under `regions`, `provinces:{region}` and
 * `cities:{region|province}` (10-digit codes). When PSGC fails and nothing is cached, the
 * bundled fallback (all regions and provinces, NCR + the cities of every province) is used.
 *
 * After a PSGC failure, PSGC is skipped for `cooldownMs`, so one picker request during an outage
 * does not wait for several timeouts in a row (provinces → cities needs up to three lists).
 *
 * The list methods resolve to { items: [{ code, name, level }], source: 'ok'|'cached'|'stale'|'fallback' }.
 */
export function createLocationService({ psgc, cached, ttlMs, cooldownMs, fallback, log = console }) {
  const guarded = createCooldown('PSGC', cooldownMs);

  async function load(key, fetch) {
    try {
      return await cached({ table: 'psgc_cache', key, ttlMs, fetch: guarded(fetch) });
    } catch (err) {
      log.error(JSON.stringify({ source: 'psgc', key, error: err.code ?? err.message }));
      if (fallback[key]) return { value: fallback[key], source: 'fallback' };
      throw new ApiError('SERVICE_UNAVAILABLE');
    }
  }

  const regions = () => load('regions', psgc.regions);

  async function findRegion(code) {
    const region = (await regions()).value.find((item) => item.code === code);
    if (!region) throw new ApiError('NOT_FOUND');
    return region;
  }

  const result = ({ value, source }) => ({ items: value.map(({ code, name, level }) => ({ code, name, level })), source });

  /** Several lists → one status: any stale/fallback list makes the answer stale; any fresh fetch makes it ok. */
  function combined(sources) {
    if (sources.some((source) => source === 'stale' || source === 'fallback')) return 'stale';
    return sources.includes('ok') ? 'ok' : 'cached';
  }

  /**
   * City/municipality code → { city, province, region, province_code, region_code, source } with
   * display names (province null in NCR), or null when the code cannot be found. Throws
   * SERVICE_UNAVAILABLE when it was not found but a list it needed could not be loaded. Highly
   * urbanized cities (Cebu 0730600000) do not share their province's code prefix, so the region's
   * provinces are searched, the one with the matching prefix first.
   */
  async function describe(code) {
    const sources = [];
    let failed = false;
    const track = (loaded) => {
      sources.push(loaded.source);
      return loaded.value;
    };
    const tryLoad = async (key, fetch) => {
      try {
        return track(await load(key, fetch));
      } catch {
        failed = true;
        return null;
      }
    };
    const notFound = () => {
      if (failed) throw new ApiError('SERVICE_UNAVAILABLE');
      return null;
    };
    const found = (city, province, region) => ({
      city: city.name,
      province: province?.name ?? null,
      region: region.name,
      province_code: province?.code ?? null,
      region_code: region.code,
      source: combined(sources),
    });

    const allRegions = await tryLoad('regions', psgc.regions);
    const region = allRegions?.find((item) => item.code === regionOf(code));
    if (!region) return notFound();

    const provinces = await tryLoad(`provinces:${region.code}`, () => psgc.provincesOfRegion(region.ref));
    if (!provinces) return notFound();

    if (provinces.length === 0) {
      const cities = await tryLoad(`cities:${region.code}`, () => psgc.citiesOfRegion(region.ref));
      const city = cities?.find((item) => item.code === code);
      return city ? found(city, null, region) : notFound();
    }

    const prefix = code.slice(0, 5);
    const ordered = [...provinces].sort((a, b) => Number(b.code.startsWith(prefix)) - Number(a.code.startsWith(prefix)));
    for (const province of ordered) {
      const cities = await tryLoad(`cities:${province.code}`, () => psgc.citiesOfProvince(province.ref));
      const city = cities?.find((item) => item.code === code);
      if (city) return found(city, province, region);
    }
    return notFound();
  }

  return {
    describe,

    regions: async () => result(await regions()),

    async provinces(regionCode) {
      const region = await findRegion(regionCode);
      return result(await load(`provinces:${region.code}`, () => psgc.provincesOfRegion(region.ref)));
    },

    /** `parentCode` is a region (NCR has no provinces) or a province. */
    async cities(parentCode) {
      const allRegions = (await regions()).value;
      const region = allRegions.find((item) => item.code === parentCode);
      if (region) {
        return result(await load(`cities:${region.code}`, () => psgc.citiesOfRegion(region.ref)));
      }

      const owner = await findRegion(regionOf(parentCode));
      const provinces = await load(`provinces:${owner.code}`, () => psgc.provincesOfRegion(owner.ref));
      const province = provinces.value.find((item) => item.code === parentCode);
      if (!province) throw new ApiError('NOT_FOUND');
      return result(await load(`cities:${province.code}`, () => psgc.citiesOfProvince(province.ref)));
    },
  };
}
