import express from 'express';
import { createCached } from './cache/cached.js';
import { ApiError, sendError } from './lib/errors.js';
import { accessLog } from './middleware/accessLog.js';
import { requestId } from './middleware/requestId.js';
import { healthRouter } from './routes/health.js';
import { locationsRouter } from './routes/locations.js';
import { createLocationService } from './services/locations.js';
import { createPsgcClient } from './sources/psgc.js';

/**
 * @param {object} config  from loadConfig()
 * @param {{ store: object, psgcFallback: object, log?: Console }} deps  cache store (MySQL or memory)
 *   and the bundled PSGC fallback lists
 */
export function createApp(config, { store, psgcFallback, log = console }) {
  const app = express();

  app.disable('x-powered-by');

  app.use(requestId);
  if (config.logRequests) app.use(accessLog);

  const cached = createCached(store, { log });
  const locations = createLocationService({
    psgc: createPsgcClient({ baseUrl: config.psgcUrl, timeoutMs: config.timeouts.psgc }),
    cached,
    ttlMs: config.ttl.psgc,
    cooldownMs: config.cooldowns.psgc,
    fallback: psgcFallback,
    log,
  });

  app.use(healthRouter(store));
  app.use(locationsRouter(locations));

  app.use((req, res) => sendError(req, res, 'NOT_FOUND'));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof ApiError) {
      sendError(req, res, err.code, { errors: err.errors });
      return;
    }
    log.error(JSON.stringify({ request_id: req.id, error: err.message }));
    sendError(req, res, 'SERVER_ERROR');
  });

  return app;
}
