import { loadConfig } from '../src/config.js';

const valid = {
  CORE_URL: 'http://localhost:8001/',
  INSIGHTS_URL: 'http://localhost:8002',
  CORS_ALLOWED_ORIGIN: 'http://localhost:5173, https://opendoor.vercel.app',
};

describe('loadConfig', () => {
  test('reads env with defaults and trims trailing slashes', () => {
    const config = loadConfig(valid);

    expect(config.port).toBe(8080);
    expect(config.rateLimitPerMin).toBe(120);
    expect(config.trustProxy).toBe(0);
    expect(config.coreUrl).toBe('http://localhost:8001');
    expect(config.corsOrigins).toEqual(['http://localhost:5173', 'https://opendoor.vercel.app']);
    expect(config.timeouts).toEqual({ core: 10000, insights: 15000, health: 3000 });
  });

  test('lists every problem at once', () => {
    let message = '';
    try {
      loadConfig({ CORE_URL: 'localhost:8001', RATE_LIMIT_PER_MIN: 'lots' });
    } catch (err) {
      message = err.message;
    }

    for (const name of ['CORE_URL', 'INSIGHTS_URL', 'RATE_LIMIT_PER_MIN', 'CORS_ALLOWED_ORIGIN']) {
      expect(message).toContain(name);
    }
  });
});
