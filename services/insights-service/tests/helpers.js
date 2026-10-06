import { createApp } from '../src/app.js';
import { createMemoryStore } from '../src/cache/memoryStore.js';
import { loadConfig } from '../src/config.js';

export const PSGC_URL = 'http://psgc.test/api';

/** Collects log lines instead of printing them. */
export function silentLog() {
  const lines = [];
  return { lines, error: (line) => lines.push(line), warn: (line) => lines.push(line), log: () => {} };
}

export const TEST_ENV = {
  NODE_ENV: 'test',
  CORE_INTERNAL_URL: 'http://core.test',
  SERVICE_KEY_INSIGHTS: 'test-service-key',
  PSGC_URL,
  NOMINATIM_URL: 'http://nominatim.test',
  NOMINATIM_CONTACT_EMAIL: 'team@opendoor.test',
  OVERPASS_URL: 'http://overpass.test/api/interpreter',
};

/**
 * The app with every outside service on a fake host (use nock). Sources are retried at once
 * after a failure and Nominatim is not throttled unless a test sets `cooldowns` / `throttle`.
 */
export function buildApp({
  store = createMemoryStore(),
  psgcFallback = {},
  centroids = {},
  log = silentLog(),
  env = {},
  timeouts = {},
  cooldowns = {},
  budgetMs,
} = {}) {
  const config = loadConfig({ ...TEST_ENV, ...env });
  const app = createApp(
    {
      ...config,
      timeouts: { ...config.timeouts, ...timeouts },
      cooldowns: { psgc: 0, nominatim: 0, overpass: 0, ...cooldowns },
      throttle: { nominatim: { intervalMs: 0, maxWaitMs: 2_000 } },
      snapshotBudgetMs: budgetMs ?? config.snapshotBudgetMs,
    },
    { store, psgcFallback, centroids, log },
  );
  return { app, store, log };
}

/** A store whose database is down: every call rejects like mysql2 does. */
export function brokenStore() {
  const down = async () => {
    throw Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
  };
  return { migrate: down, ping: down, get: down, put: down, close: async () => {} };
}

// Raw PSGC API answers (shape of https://psgc.gitlab.io/api), trimmed to the fields we use.
export const raw = {
  regions: [
    { code: '130000000', name: 'NCR', regionName: 'National Capital Region', psgc10DigitCode: '1300000000' },
    { code: '010000000', name: 'Ilocos Region', regionName: 'Region I', psgc10DigitCode: '0100000000' },
    { code: '170000000', name: 'MIMAROPA Region', regionName: 'MIMAROPA Region', psgc10DigitCode: '1700000000' },
    { code: '150000000', name: 'BARMM', regionName: 'Bangsamoro Autonomous Region in Muslim Mindanao', psgc10DigitCode: '1900000000' },
  ],
  barmmProvinces: [
    { code: '156600000', name: 'Sulu', regionCode: '150000000', psgc10DigitCode: '1906600000' },
    { code: '153600000', name: 'Lanao Del Sur', regionCode: '150000000', psgc10DigitCode: '1903600000' },
  ],
  ncrCities: [
    { code: '137404000', name: 'Quezon City', isCity: true, isMunicipality: false, psgc10DigitCode: '1381300000' },
    { code: '137606000', name: 'Pateros', isCity: false, isMunicipality: true, psgc10DigitCode: '1381701000' },
    { code: '133900000', name: 'City of Manila', isCity: true, isMunicipality: false, psgc10DigitCode: '1380600000' },
  ],
  lanaoDelSurCities: [
    { code: '153617000', name: 'City of Marawi', isCity: true, isMunicipality: false, psgc10DigitCode: '1903617000' },
    { code: '153601000', name: 'Bacolod-Kalawi', isCity: false, isMunicipality: true, psgc10DigitCode: '1903601000' },
  ],
};
