// Insights Service configuration, read only from environment variables and validated at startup.

const DAY = 24 * 60 * 60 * 1000;

const DEFAULTS = {
  PORT: '8002',
  PSGC_URL: 'https://psgc.gitlab.io/api',
  NOMINATIM_URL: 'https://nominatim.openstreetmap.org',
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
    psgcUrl: url('PSGC_URL'),
    nominatimUrl: url('NOMINATIM_URL'),
    nominatimContactEmail: contactEmail || null,
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
    timeouts: { psgc: 5_000, nominatim: 5_000 },
    ttl: { psgc: 7 * DAY, geocode: 30 * DAY },
    // How long a failed source is skipped before it is tried again.
    cooldowns: { psgc: 60_000, nominatim: 60_000 },
    // Nominatim: 1 request/s; a request that would queue longer than maxWaitMs is not sent.
    throttle: { nominatim: { intervalMs: 1_000, maxWaitMs: 2_000 } },
    logRequests: env.NODE_ENV !== 'test',
  };

  if (errors.length > 0) {
    throw new Error(`Invalid Insights configuration:\n- ${errors.join('\n- ')}`);
  }

  return Object.freeze(config);
}
