# OpenDoor API Gateway

Node.js 22 + Express 4. The only public backend: the React app talks to this service and nothing else.

| Incoming path | Goes to | Timeout |
|---|---|---|
| `/api/health` | answered here (pings Core `/up` and Insights `/health`) | 3 s each |
| `/api/insights/*` | Insights Service, path unchanged | 15 s |
| `/api/*` | Core Service, path unchanged | 10 s |
| `/internal/*` and anything else | 404 `NOT_FOUND` | – |

It also handles CORS (only `CORS_ALLOWED_ORIGIN`; upstream CORS headers are dropped), the 120 requests/min/IP rate limit (429 `RATE_LIMITED`), `X-Request-ID`, `X-Forwarded-For`, and turns upstream failures into the error envelope: 503 `SERVICE_UNAVAILABLE` (not running), 504 `UPSTREAM_TIMEOUT`, 502 `UPSTREAM_ERROR`. Bodies are streamed, not parsed, so file uploads pass through. Logs are one JSON line per request with no headers or bodies.

## Local setup

```powershell
npm ci
copy .env.example .env
npm run dev      # http://localhost:8080, restarts on file changes
npm test         # Jest + supertest with fake upstream servers
npm run lint
```
