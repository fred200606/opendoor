import { createProxyMiddleware } from 'http-proxy-middleware';
import { sendError } from './lib/errors.js';

const UNREACHABLE = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'EHOSTUNREACH', 'ENETUNREACH']);

function errorCodeFor(err) {
  if (err.code === 'UPSTREAM_TIMEOUT') return 'UPSTREAM_TIMEOUT';
  if (UNREACHABLE.has(err.code)) return 'SERVICE_UNAVAILABLE';
  return 'UPSTREAM_ERROR';
}

/**
 * Streams matching requests to an upstream service with the path unchanged
 * (bodies are not parsed, so multipart uploads pass through).
 *
 * @param {{ name: string, target: string, timeoutMs: number, match: (path: string) => boolean }} options
 */
export function serviceProxy({ name, target, timeoutMs, match }) {
  return createProxyMiddleware({
    target,
    pathFilter: (path) => match(path),
    changeOrigin: true,
    xfwd: true,
    on: {
      proxyReq: (proxyReq, req) => {
        // httpxy's own proxyTimeout reports a plain "socket hang up"; tag ours so it maps to 504.
        proxyReq.setTimeout(timeoutMs, () => {
          const err = new Error(`${name} did not respond within ${timeoutMs} ms`);
          err.code = 'UPSTREAM_TIMEOUT';
          proxyReq.destroy(err);
        });
        req.upstream = name;
      },
      proxyRes: (proxyRes) => {
        // The gateway alone decides CORS; Laravel's default `Access-Control-Allow-Origin: *`
        // would otherwise overwrite the restricted origin. X-Powered-By (e.g. "PHP/8.4.0")
        // would tell attackers the upstream stack and version.
        for (const header of Object.keys(proxyRes.headers)) {
          if (header.startsWith('access-control-') || header === 'x-powered-by') delete proxyRes.headers[header];
        }
      },
      error: (err, req, res) => {
        if (res.headersSent) {
          res.destroy();
          return;
        }
        console.error(JSON.stringify({ request_id: req.id, upstream: name, error: err.code ?? err.message }));
        sendError(req, res, errorCodeFor(err));
      },
    },
  });
}
