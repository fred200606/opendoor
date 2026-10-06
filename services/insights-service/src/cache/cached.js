/**
 * Read-through cache shared by all sources.
 *
 * - fresh cache entry          → { value, source: 'cached' }
 * - fetched from the source    → { value, source: 'ok' } (and stored)
 * - source failed, old entry   → { value, source: 'stale' }
 * - source failed, no entry    → throws the source's error
 *
 * A broken cache database only costs the cache: reads count as misses, failed writes are logged.
 * Concurrent misses for the same key share one source request.
 */
export function createCached(store, { log = console } = {}) {
  const inFlight = new Map();

  async function read(table, key) {
    try {
      return await store.get(table, key);
    } catch (err) {
      log.error(JSON.stringify({ cache: table, key, error: err.code ?? err.message }));
      return null;
    }
  }

  async function write(table, key, value) {
    try {
      await store.put(table, key, value);
    } catch (err) {
      log.error(JSON.stringify({ cache: table, key, error: err.code ?? err.message }));
    }
  }

  return async function cached({ table, key, ttlMs, fetch }) {
    const entry = await read(table, key);
    if (entry && Date.now() - new Date(entry.fetchedAt).getTime() < ttlMs) {
      return { value: entry.payload, source: 'cached' };
    }

    const id = `${table}:${key}`;
    if (!inFlight.has(id)) {
      inFlight.set(
        id,
        (async () => {
          const value = await fetch();
          await write(table, key, value);
          return value;
        })().finally(() => inFlight.delete(id)),
      );
    }

    try {
      return { value: await inFlight.get(id), source: 'ok' };
    } catch (err) {
      if (entry) return { value: entry.payload, source: 'stale' };
      throw err;
    }
  };
}
