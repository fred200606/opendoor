/**
 * Skips a failing source for `cooldownMs` after a failure, so requests during an outage fail
 * at once instead of each waiting for the timeout. Errors marked `noCooldown` (e.g. a full
 * request queue) do not count as the source being down.
 *
 * @returns {(fetch: Function) => Function} wraps an async function
 */
export function createCooldown(name, cooldownMs) {
  let downUntil = 0;

  return (fetch) =>
    async (...args) => {
      if (Date.now() < downUntil) {
        throw Object.assign(new Error(`${name} skipped after a recent failure`), { code: 'COOLDOWN' });
      }
      try {
        return await fetch(...args);
      } catch (err) {
        if (!err.noCooldown) downUntil = Date.now() + cooldownMs;
        throw err;
      }
    };
}
