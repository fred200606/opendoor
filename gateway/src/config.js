// Gateway configuration, read only from environment variables and validated at startup.

const DEFAULTS = {
  PORT: '8080',
  RATE_LIMIT_PER_MIN: '120',
  TRUST_PROXY: '0',
};

export function loadConfig(env = process.env) {
  const errors = [];
  const read = (name) => env[name] ?? DEFAULTS[name];

  const url = (name) => {
    const value = read(name);
    // URL.canParse('localhost:8001') is true (scheme "localhost:"), so check the protocol too.
    const parsed = URL.canParse(value) ? new URL(value) : null;
    if (!parsed || !['http:', 'https:'].includes(parsed.protocol)) {
      errors.push(`${name} must be an http(s) URL such as http://localhost:8001 (got "${value ?? ''}")`);
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

  const origins = (read('CORS_ALLOWED_ORIGIN') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins.length === 0) {
    errors.push('CORS_ALLOWED_ORIGIN must list the React app origin(s), comma-separated');
  }

  const config = {
    port: positiveInt('PORT'),
    coreUrl: url('CORE_URL'),
    insightsUrl: url('INSIGHTS_URL'),
    corsOrigins: origins,
    rateLimitPerMin: positiveInt('RATE_LIMIT_PER_MIN'),
    // Number of proxies in front of the gateway (Railway: 1) so req.ip is the real client.
    trustProxy: positiveInt('TRUST_PROXY'),
    timeouts: { core: 10_000, insights: 15_000, health: 3_000 },
    logRequests: env.NODE_ENV !== 'test',
  };

  if (errors.length > 0) {
    throw new Error(`Invalid gateway configuration:\n- ${errors.join('\n- ')}`);
  }

  return Object.freeze(config);
}
