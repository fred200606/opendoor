import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { asyncRoute } from '../lib/asyncRoute.js';
import { ApiError, sendError } from '../lib/errors.js';
import { placeQueries } from '../services/geocoder.js';

const PSGC_CODE = /^\d{10}$/;

/** X-Service-Key must equal SERVICE_KEY_INSIGHTS (constant time); no key configured → every call refused. */
function requireServiceKey(serviceKey) {
  const expected = Buffer.from(serviceKey ?? '');
  return (req, res, next) => {
    const given = Buffer.from(req.get('X-Service-Key') ?? '');
    if (expected.length === 0 || given.length !== expected.length || !timingSafeEqual(given, expected)) {
      sendError(req, res, 'UNAUTHENTICATED');
      return;
    }
    next();
  };
}

/**
 * GET /internal/places/{code} – for Core only (shared service key; the gateway routes only
 * /api/insights/*). A city or municipality with its province and region codes and its centre
 * point, so Core can rank jobs by place and distance (Decision 2026-10-21). The point comes from
 * the geocode cache, Nominatim ("City, Province") or the bundled city centroids; lat/lon are null
 * when none knows the place. Unknown code → 404; PSGC lists unavailable → 503.
 */
export function placesRouter({ locations, geocode, serviceKey }) {
  const router = Router();

  router.get(
    '/internal/places/:code',
    requireServiceKey(serviceKey),
    asyncRoute(async (req, res) => {
      const { code } = req.params;
      if (!PSGC_CODE.test(code)) throw new ApiError('NOT_FOUND');

      const place = await locations.describe(code);
      if (!place) throw new ApiError('NOT_FOUND');

      const point = await geocode({ address: null, place: placeQueries(place), psgcCode: code });
      res.json({
        code,
        city: place.city,
        province: place.province,
        region: place.region,
        province_code: place.province_code,
        region_code: place.region_code,
        lat: point.lat,
        lon: point.lon,
        precision: point.lat === null ? null : 'city',
        sources: { psgc: place.source, geocode: point.source },
      });
    }),
  );

  return router;
}
