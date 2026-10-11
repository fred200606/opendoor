// Insights Service configuration, read only from environment variables and validated at startup.

const DAY = 24 * 60 * 60 * 1000;

const DEFAULTS = {
  PORT: '8002',
  CORE_INTERNAL_URL: 'http://127.0.0.1:8001',
  PSGC_URL: 'https://psgc.gitlab.io/api',
  NOMINATIM_URL: 'https://nominatim.openstreetmap.org',
  OVERPASS_URL: 'https://overpass-api.de/api/interpreter',
  OVERPASS_FALLBACK_URL: 'https://overpass.private.coffee/api/interpreter',
  CACHE_DB_HOST: '127.0.0.1',
  CACHE_DB_PORT: '3306',
  CACHE_DB_NAME: 'insights_cache',
};

export function loadConfig(env = process.env) {
  const errors = [];
  const read = (name) => env[name] ?? DEFAULTS[name];

  const url = (name) => {
    const value = read(name);
    // URL.canParse('localhost:8001') is true (scheme "localhost:"), so check the protocol too.
    const parsed = URL.canParse(value) ? new URL(value) : null;
    if (!parsed || !['http:', 'https:'].includes(parsed.protocol)) {
      errors.push(`${name} must be an http(s) URL such as https://psgc.gitlab.io/api (got "${value ?? ''}")`);
      return undefined;
    }
    return parsed.toString().replace(/\/+$/, '');
  };

  const positiveInt = (name) => {
    const value = Number(read(name));
    if (!Number.isInteger(value) || value < 0) {
      errors.push(`${name} must be a non-negative integer`);
    }
    return value;
  };

  // Required by the Nominatim usage policy; without it Nominatim is not called at all.
  const contactEmail = (read('NOMINATIM_CONTACT_EMAIL') ?? '').trim();
  if (contactEmail && !/^[^\s@()]+@[^\s@()]+\.[^\s@()]+$/.test(contactEmail)) {
    errors.push('NOMINATIM_CONTACT_EMAIL must be an email address (sent in the User-Agent to Nominatim)');
  }

  const config = {
    port: positiveInt('PORT'),
    coreInternalUrl: url('CORE_INTERNAL_URL'),
    // Shared secret with Core's /internal routes; without it Core refuses every snapshot (503).
    serviceKey: read('SERVICE_KEY_INSIGHTS') || null,
    psgcUrl: url('PSGC_URL'),
    nominatimUrl: url('NOMINATIM_URL'),
    nominatimContactEmail: contactEmail || null,
    overpassUrl: url('OVERPASS_URL'),
    // Second public Overpass server; empty = none (tests and CI must not reach a real one).
    overpassFallbackUrl: read('OVERPASS_FALLBACK_URL') === '' ? null : url('OVERPASS_FALLBACK_URL'),
    // The fallback is also asked when the main server has not answered after this long.
    overpassHedgeMs: 5_000,
    // After a failure the place is fetched again in the background (the first try after the cooldown).
    overpassRetryDelaysMs: [90_000, 5 * 60_000, 15 * 60_000],
    nearbyRadiusM: 500,
    // The cache is optional at runtime: without a database every request goes to the sources.
    cacheDb: read('CACHE_DB_USER')
      ? {
          host: read('CACHE_DB_HOST'),
          port: positiveInt('CACHE_DB_PORT'),
          database: read('CACHE_DB_NAME'),
          user: read('CACHE_DB_USER'),
          password: read('CACHE_DB_PASSWORD') ?? '',
        }
      : null,
    // Overpass is often slow: an answer later than the snapshot budget still fills the cache.
    timeouts: { core: 3_000, psgc: 5_000, nominatim: 5_000, overpass: 25_000 },
    // Whole snapshot, below the gateway's 15 s Insights timeout.
    snapshotBudgetMs: 12_000,
    ttl: { psgc: 7 * DAY, geocode: 30 * DAY, overpass: DAY },
    // How long a failed source is skipped before it is tried again.
    cooldowns: { psgc: 60_000, nominatim: 60_000, overpass: 60_000 },
    // Nominatim: 1 request/s; a request that would queue longer than maxWaitMs is not sent.
    throttle: { nominatim: { intervalMs: 1_000, maxWaitMs: 2_000 } },
    logRequests: env.NODE_ENV !== 'test',
  };

  if (errors.length > 0) {
    throw new Error(`Invalid Insights configuration:\n- ${errors.join('\n- ')}`);
  }

  return Object.freeze(config);
}
