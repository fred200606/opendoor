import express from 'express';
import { createCached } from './cache/cached.js';
import { ApiError, sendError } from './lib/errors.js';
import { accessLog } from './middleware/accessLog.js';
import { requestId } from './middleware/requestId.js';
import { healthRouter } from './routes/health.js';
import { locationsRouter } from './routes/locations.js';
import { snapshotRouter } from './routes/snapshot.js';
import { createGeocoder } from './services/geocoder.js';
import { createLocationService } from './services/locations.js';
import { createNearby } from './services/nearby.js';
import { createSnapshotService } from './services/snapshot.js';
import { createCoreClient } from './sources/core.js';
import { createNominatimClient } from './sources/nominatim.js';
import { createOverpassClient } from './sources/overpass.js';
import { createPsgcClient } from './sources/psgc.js';

/**
 * @param {object} config  from loadConfig()
 * @param {{ store: object, psgcFallback: object, centroids?: object, log?: Console }} deps  cache store
 *   (MySQL or memory), the bundled PSGC fallback lists and city centroids
 */
export function createApp(config, { store, psgcFallback, centroids = {}, log = console }) {
  const app = express();

  app.disable('x-powered-by');

  app.use(requestId);
  if (config.logRequests) app.use(accessLog);

  const cached = createCached(store, { log });
  const userAgent = config.nominatimContactEmail ? `OpenDoor/1.0 (${config.nominatimContactEmail})` : 'OpenDoor/1.0';

  const locations = createLocationService({
    psgc: createPsgcClient({ baseUrl: config.psgcUrl, timeoutMs: config.timeouts.psgc }),
    cached,
    ttlMs: config.ttl.psgc,
    cooldownMs: config.cooldowns.psgc,
    fallback: psgcFallback,
    log,
  });

  const geocode = createGeocoder({
    // The Nominatim usage policy requires a contact; without one Nominatim is not called.
    nominatim: config.nominatimContactEmail
      ? createNominatimClient({
          baseUrl: config.nominatimUrl,
          contactEmail: config.nominatimContactEmail,
          timeoutMs: config.timeouts.nominatim,
          ...config.throttle.nominatim,
        })
      : null,
    cached,
    ttlMs: config.ttl.geocode,
    cooldownMs: config.cooldowns.nominatim,
    centroids,
    log,
  });

  const nearby = createNearby({
    overpass: createOverpassClient({
      url: config.overpassUrl,
      fallbackUrl: config.overpassFallbackUrl,
      timeoutMs: config.timeouts.overpass,
      hedgeMs: config.overpassHedgeMs,
      cooldownMs: config.cooldowns.overpass,
      userAgent,
      log,
    }),
    cached,
    ttlMs: config.ttl.overpass,
    cooldownMs: config.cooldowns.overpass,
    radiusM: config.nearbyRadiusM,
    log,
  });

  const snapshot = createSnapshotService({
    core: createCoreClient({ baseUrl: config.coreInternalUrl, serviceKey: config.serviceKey, timeoutMs: config.timeouts.core }),
    locations,
    geocode,
    nearby,
    budgetMs: config.snapshotBudgetMs,
    log,
  });

  app.use(healthRouter(store));
  app.use(locationsRouter(locations));
  app.use(snapshotRouter(snapshot));

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
