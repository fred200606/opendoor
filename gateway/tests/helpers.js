import http from 'node:http';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

/**
 * Starts a throwaway HTTP server on a random port that records requests.
 * `handler(req, res, body)` decides the response.
 */
export async function startUpstream(handler) {
  const requests = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString();
      requests.push({ method: req.method, url: req.url, headers: req.headers, body });
      handler(req, res, body);
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  };
}

export function json(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(JSON.stringify(body));
}

/** A URL nothing listens on (port reserved and released). */
export async function deadUrl() {
  const server = http.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return `http://127.0.0.1:${port}`;
}

export function buildApp({ coreUrl, insightsUrl, ...overrides }) {
  const config = loadConfig({
    NODE_ENV: 'test',
    CORE_URL: coreUrl,
    INSIGHTS_URL: insightsUrl,
    CORS_ALLOWED_ORIGIN: 'http://localhost:5173',
    RATE_LIMIT_PER_MIN: '120',
  });

  return createApp({ ...config, ...overrides, timeouts: { ...config.timeouts, ...overrides.timeouts } });
}
