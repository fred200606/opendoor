import cors from 'cors';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { sendError } from './lib/errors.js';
import { accessLog } from './middleware/accessLog.js';
import { requestId } from './middleware/requestId.js';
import { serviceProxy } from './proxy.js';
import { healthRouter } from './routes/health.js';

const isInsights = (path) => path === '/api/insights' || path.startsWith('/api/insights/');
const isApi = (path) => path === '/api' || path.startsWith('/api/');

export function createApp(config) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use(requestId);
  if (config.logRequests) app.use(accessLog);

  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: false,
      exposedHeaders: ['X-Request-ID', 'Retry-After'],
    }),
  );

  // Service-to-service endpoints are never reachable from outside.
  app.use('/internal', (req, res) => sendError(req, res, 'NOT_FOUND'));

  app.use(
    '/api',
    rateLimit({
      windowMs: 60_000,
      limit: config.rateLimitPerMin,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      handler: (req, res) => sendError(req, res, 'RATE_LIMITED'),
    }),
  );

  app.use(healthRouter(config));

  app.use(
    serviceProxy({
      name: 'insights',
      target: config.insightsUrl,
      timeoutMs: config.timeouts.insights,
      match: isInsights,
    }),
  );
  app.use(
    serviceProxy({
      name: 'core',
      target: config.coreUrl,
      timeoutMs: config.timeouts.core,
      match: (path) => isApi(path) && !isInsights(path),
    }),
  );

  app.use((req, res) => sendError(req, res, 'NOT_FOUND'));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(JSON.stringify({ request_id: req.id, error: err.message }));
    sendError(req, res, 'SERVER_ERROR');
  });

  return app;
}
