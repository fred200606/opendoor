import { createApp } from '../src/app.js';
import { createMemoryStore } from '../src/cache/memoryStore.js';
import { loadConfig } from '../src/config.js';

export const PSGC_URL = 'http://psgc.test/api';

/** Collects log lines instead of printing them. */
export function silentLog() {
  const lines = [];
  return { lines, error: (line) => lines.push(line), warn: (line) => lines.push(line), log: () => {} };
}

/** Sources are retried at once after a failure unless a test sets `cooldowns`. */
export function buildApp({ store = createMemoryStore(), psgcFallback = {}, log = silentLog(), timeouts = {}, cooldowns = { psgc: 0 } } = {}) {
  const config = loadConfig({ NODE_ENV: 'test', PSGC_URL });
  const app = createApp(
    { ...config, timeouts: { ...config.timeouts, ...timeouts }, cooldowns: { ...config.cooldowns, ...cooldowns } },
    { store, psgcFallback, log },
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
