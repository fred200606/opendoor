# Architecture

## Repository layout (monorepo)

```
opendoor/
├─ frontend/                    React 19 + Vite SPA
├─ gateway/                     Node.js 22 + Express API Gateway
├─ services/
│  ├─ core-api/                 Laravel 13 Core Service
│  ├─ insights-service/         Node.js 22 + Express mashup service
│  └─ business-registry-soap/   PHP 8.4 SoapServer + WSDL + SQLite seed
├─ tests/
│  ├─ postman/                  OpenDoor.postman_collection.json + environments
│  └─ jmeter/                   opendoor-matching.jmx + tokens.csv
├─ docs/                        SIA documentation, diagrams, openapi.yaml
├─ .github/workflows/ci.yml
├─ docker-compose.yml          CI only (local dev runs natively)
└─ README.md
```

## Components

| Component | Responsibility | Tech | Local port | Production host |
|---|---|---|---|---|
| React SPA | Public area + Candidate/Employer/Admin portals | React 19, Vite, React Router 7, Axios, AuthContext | 5173 | Vercel (public) |
| API Gateway | Single entry; routing; CORS; rate limit (120 req/min/IP); X-Request-ID; timeouts; error envelope; `/api/health` | Express, http-proxy-middleware, express-rate-limit | 8080 | Railway public domain (only public backend) |
| Core Service | Auth/roles, profiles, postings, matching, applications, feedback + trust score, dashboards, notifications, moderation, master data | PHP 8.4, Laravel 13, Sanctum, Eloquent (FrankenPHP image) | 8001 | `core-api.railway.internal:8001` (private) |
| Insights Service | Workplace Accessibility Snapshot mashup; PSGC location lists; caching/throttling | Express, Axios, mysql2 | 8002 | `insights-service.railway.internal:8002` (private) |
| Business Registry | SOAP 1.1 `VerifyBusinessRegistration`, WSDL at `/soap?wsdl`; simulated DTI/SEC records | PHP SoapServer, SQLite | 8003 | `business-registry-soap.railway.internal:8003` (private) |
| MySQL 8 | Schemas `opendoor_core` (Core user) and `insights_cache` (Insights user) | Railway managed | 3306 | `mysql.railway.internal:3306` |

External REST APIs (called only by Insights): Nominatim `https://nominatim.openstreetmap.org`, Overpass `https://overpass-api.de/api/interpreter`, PSGC `https://psgc.gitlab.io/api`.

## Request routing (gateway)

| Incoming path | Target | Timeout |
|---|---|---|
| `/api/insights/*` | Insights Service | 15 s |
| `/api/health` | handled by gateway (pings Core and Insights) | 3 s each |
| `/api/*` (everything else) | Core Service | 10 s |
| `/internal/*` | **never routed** (404 at gateway) | – |

Paths are forwarded **unchanged** (Core serves `/api/*`; Insights must serve `/api/insights/*` and `GET /health`). Upstream `Access-Control-*` headers are dropped – the gateway alone decides CORS – and so is `X-Powered-By` (no stack/version disclosure). The gateway forwards `Authorization` unchanged (it does not validate tokens), adds `X-Request-ID` (UUID v4) if missing, adds `X-Forwarded-For`, and redacts `Authorization` / `X-Service-Key` in logs.

## Service-to-service calls

| From → To | Call | Auth |
|---|---|---|
| Insights → Core | `GET /internal/job-postings/{id}/summary` | `X-Service-Key: ${SERVICE_KEY_INSIGHTS}` |
| Core → Registry | SOAP `VerifyBusinessRegistration` | WS-Security UsernameToken |
| Insights → Nominatim / Overpass / PSGC | REST/JSON over HTTPS | none (User-Agent + contact email for Nominatim) |
| Core → Core (event) | Model observers: status change → notification; feedback saved/hidden → recompute trust score | – |

## Environment variables (names only — values live in .env / Railway / Vercel / GitHub secrets)

- **frontend:** `VITE_API_URL`
- **gateway:** `PORT`, `CORE_URL`, `INSIGHTS_URL`, `CORS_ALLOWED_ORIGIN` (comma-separated list allowed), `RATE_LIMIT_PER_MIN`, `TRUST_PROXY` (0 locally, 1 on Railway)
- **core-api:** standard Laravel (`APP_KEY`, `APP_ENV`, `APP_DEBUG`, `APP_URL`, `DB_HOST`, `DB_PORT`, `DB_DATABASE=opendoor_core`, `DB_USERNAME`, `DB_PASSWORD`), `SANCTUM_*` as needed, `SERVICE_KEY_INSIGHTS`, `PUBLIC_API_URL` (gateway URL for file links such as `logo_url`), `REGISTRY_WSDL_URL`, `REGISTRY_SOAP_USER`, `REGISTRY_SOAP_PASSWORD`, `REGISTRY_TIMEOUT=5`, `DEMO_PASSWORD` (seeders), `PUBLIC_APP_URL` (links in emails), `MAIL_*` (`log` locally; production `MAIL_MAILER=brevo` + `BREVO_API_KEY` – Brevo HTTPS API, Railway blocks SMTP), `PASSWORD_RESET_QUEUE=database`, `RUN_SCHEDULER=1` on Railway (scheduler in the Core container)
- **insights-service:** `PORT`, `CORE_INTERNAL_URL`, `SERVICE_KEY_INSIGHTS`, `NOMINATIM_URL`, `OVERPASS_URL`, `OVERPASS_FALLBACK_URL`, `PSGC_URL`, `NOMINATIM_CONTACT_EMAIL`, `CACHE_DB_HOST`, `CACHE_DB_NAME=insights_cache`, `CACHE_DB_USER`, `CACHE_DB_PASSWORD`
- **business-registry-soap:** `PORT`, `REGISTRY_SOAP_USER`, `REGISTRY_SOAP_PASSWORD`

## Deployment

- Vercel: root `frontend/`, build `npm run build`, output `dist/`, SPA rewrite to `index.html`.
- Railway (Free Trial, max 5 services – decision 2026-10-15): one project, services `gateway`, `core-api` (Dockerfile, FrankenPHP; pre-deploy `php artisan migrate --force`; volume for logos/résumés; `RUN_SCHEDULER=1` runs `php artisan schedule:work` in the same container instead of a separate `core-scheduler` service), `insights-service`, `business-registry-soap` (Dockerfile, FrankenPHP), plus MySQL; mail through Brevo's HTTPS API (mailer `brevo`). Only `gateway` gets a public domain; others use `${{service.RAILWAY_PRIVATE_DOMAIN}}`.
- Production: `APP_DEBUG=false`, fresh `APP_KEY`, CORS restricted to the Vercel domain.
- Free/hobby tiers sleep: wake the app (`/api/health`) a few minutes before demos.
