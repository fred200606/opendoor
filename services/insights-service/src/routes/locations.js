import { Router } from 'express';
import { asyncRoute } from '../lib/asyncRoute.js';
import { ApiError } from '../lib/errors.js';

const PSGC_CODE = /^\d{10}$/;

function parentFrom(req) {
  const { parent } = req.query;
  if (parent === undefined || parent === '') {
    throw new ApiError('VALIDATION_FAILED', { errors: { parent: ['The parent field is required.'] } });
  }
  if (typeof parent !== 'string' || !PSGC_CODE.test(parent)) {
    throw new ApiError('VALIDATION_FAILED', { errors: { parent: ['The parent must be a 10-digit PSGC code.'] } });
  }
  return parent;
}

// GET /api/insights/locations/{regions|provinces|cities}?parent=<10-digit PSGC code>
export function locationsRouter(locations) {
  const router = Router();

  router.get('/api/insights/locations/:level', asyncRoute(async (req, res) => {
    let result;
    switch (req.params.level) {
      case 'regions':
        result = await locations.regions();
        break;
      case 'provinces':
        result = await locations.provinces(parentFrom(req));
        break;
      case 'cities':
        result = await locations.cities(parentFrom(req));
        break;
      default:
        throw new ApiError('NOT_FOUND');
    }

    res.set('X-Data-Source', result.source).json(result.items);
  }));

  return router;
}
