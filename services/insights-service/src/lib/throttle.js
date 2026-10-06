const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Starts calls at least `intervalMs` apart, in arrival order (Nominatim policy: max 1 request/s).
 * A call that would wait longer than `maxWaitMs` is rejected at once (`QUEUE_FULL`, no cooldown)
 * so a burst of requests cannot pile up behind the limit.
 */
export function createThrottle({ intervalMs, maxWaitMs }) {
  let nextStart = 0;

  return async function schedule(call) {
    const now = Date.now();
    const start = Math.max(now, nextStart);
    if (start - now > maxWaitMs) {
      throw Object.assign(new Error('Request queue is full'), { code: 'QUEUE_FULL', noCooldown: true });
    }
    nextStart = start + intervalMs;
    if (start > now) await sleep(start - now);
    return call();
  };
}
