import { readFileSync } from 'node:fs';
import { createApp } from './app.js';
import { createMemoryStore } from './cache/memoryStore.js';
import { createMysqlStore } from './cache/mysqlStore.js';
import { loadConfig } from './config.js';

let config;
try {
  config = loadConfig();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

let store;
if (config.cacheDb) {
  store = createMysqlStore(config.cacheDb);
  try {
    await store.migrate();
  } catch (err) {
    // Keep running without a cache; reads count as misses until the database is back.
    console.error(`Cache database not ready (${err.code ?? err.message}); running without cache.`);
  }
} else {
  console.warn('CACHE_DB_USER is not set; using an in-memory cache.');
  store = createMemoryStore();
}

const psgcFallback = JSON.parse(readFileSync(new URL('./data/psgc-fallback.json', import.meta.url), 'utf8'));

createApp(config, { store, psgcFallback }).listen(config.port, () => {
  console.log(`OpenDoor Insights Service listening on http://localhost:${config.port} (psgc: ${config.psgcUrl})`);
});
