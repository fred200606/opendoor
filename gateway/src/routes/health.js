import { Router } from 'express';

async function ping(url, timeoutMs) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return response.ok ? 'up' : 'down';
  } catch {
    return 'down';
  }
}

// GET /api/health – always 200 while the gateway runs; `status` says whether downstream is healthy.
export function healthRouter(config) {
  const router = Router();

  router.get('/api/health', async (req, res) => {
    const [core, insights] = await Promise.all([
      ping(`${config.coreUrl}/up`, config.timeouts.health),
      ping(`${config.insightsUrl}/health`, config.timeouts.health),
    ]);

    res.json({
      status: core === 'up' && insights === 'up' ? 'ok' : 'degraded',
      services: { core, insights },
    });
  });

  return router;
}
