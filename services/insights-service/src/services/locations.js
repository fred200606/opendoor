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
 * Every method resolves to { items: [{ code, name, level }], source: 'ok'|'cached'|'stale'|'fallback' }.
 */
export function createLocationService({ psgc, cached, ttlMs, cooldownMs, fallback, log = console }) {
  let psgcDownUntil = 0;

  const guarded = (fetch) => async () => {
    if (Date.now() < psgcDownUntil) throw new Error('PSGC skipped after a recent failure');
    try {
      return await fetch();
    } catch (err) {
      psgcDownUntil = Date.now() + cooldownMs;
      throw err;
    }
  };

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

  return {
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
