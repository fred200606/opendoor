const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Starts calls at least `intervalMs` apart, in arrival order (Nominatim policy: max 1 request/s).
 * A call that would wait longer than `maxWaitMs` is rejected at once (`QUEUE_FULL`, no cooldown)
 * so a burst of requests cannot pile up behind the limit.
 */
export function createThrottle({ intervalMs, maxWaitMs }) {
  let nextStart = 0; // slot reserved for the next arrival (decides QUEUE_FULL)
  let lastStart = -Infinity; // when the previous call really started

  return async function schedule(call) {
    const now = Date.now();
    const start = Math.max(now, nextStart);
    if (start - now > maxWaitMs) {
      throw Object.assign(new Error('Request queue is full'), { code: 'QUEUE_FULL', noCooldown: true });
    }
    nextStart = start + intervalMs;
    // Wait for the slot and for a full interval after the previous call: on a busy event loop
    // a timer can fire late (the previous call started late) or early by Date.now() (timers
    // count from the loop's cached clock).
    const waitTime = () => Math.max(start, lastStart + intervalMs) - Date.now();
    for (let wait = waitTime(); wait > 0; wait = waitTime()) await sleep(wait);
    lastStart = Date.now();
    return call();
  };
}
