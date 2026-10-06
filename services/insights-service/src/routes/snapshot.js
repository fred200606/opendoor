import { Router } from 'express';
import { asyncRoute } from '../lib/asyncRoute.js';
import { ApiError } from '../lib/errors.js';

const MAX_ID = 2 ** 31 - 1;

// GET /api/insights/job-postings/{id} – Workplace Accessibility Snapshot (public, through the gateway).
export function snapshotRouter(snapshot) {
  const router = Router();

  router.get(
    '/api/insights/job-postings/:id',
    asyncRoute(async (req, res) => {
      const id = /^[1-9]\d{0,9}$/.test(req.params.id) ? Number(req.params.id) : NaN;
      if (!(id <= MAX_ID)) throw new ApiError('NOT_FOUND');

      res.json(await snapshot(id, { requestId: req.id }));
    }),
  );

  return router;
}
