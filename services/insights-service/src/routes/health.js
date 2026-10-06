import { Router } from 'express';

// GET /health – pinged by the gateway. 200 while the service runs; the cache database is
// reported but optional (without it every request goes to the sources).
export function healthRouter(store) {
  const router = Router();

  router.get('/health', async (req, res) => {
    let cache = 'up';
    try {
      await store.ping();
    } catch {
      cache = 'down';
    }

    res.json({ status: 'ok', cache });
  });

  return router;
}
