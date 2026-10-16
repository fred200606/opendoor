# Service validation script

`validate_opendoor.py` checks the running services and the links between them, with one
`[PASS]`/`[FAIL]` line per check and a `Result: X/Y checks passed` summary. It only uses the
Python standard library (Python 3.8+), sends only GET requests and changes no data, so it is
safe to run against production. Exit code 0 = all passed, 1 = something failed.

It is a quick smoke check for demos. The full API tests are the Postman/Newman collection
(`tests/postman`) and the unit tests of each service.

## Run it

1. Start the services (MySQL must be running). Each command runs in its own terminal from the repo root:

   ```powershell
   cd services/business-registry-soap; php -S 127.0.0.1:8003 -t public   # registry
   cd services/core-api; php artisan serve --host=127.0.0.1 --port=8001  # Core
   cd services/insights-service; npm run dev                             # Insights, 8002
   cd gateway; npm run dev                                               # gateway, 8080
   ```

2. Run the validator:

   ```powershell
   python tests/validate/validate_opendoor.py
   ```

Options:

| Option | Use |
|---|---|
| `--id 3` | Use posting 3 as the sample (default: the first posting in the search list) |
| `--gateway URL` `--core URL` `--insights URL` `--registry URL` | Other addresses (defaults: 8080, 8001, 8002, 8003 on 127.0.0.1) |
| `--gateway-only` | Skip the checks that call Core, Insights or the registry directly (shown as `[SKIP]`, not counted) |
| `--timeout 5` | Seconds per request (default 2). Snapshot requests use `--snapshot-timeout` (default 15) because Insights may wait up to 12 s for PSGC, Nominatim and Overpass |

Production (the services behind the gateway are on Railway's private network, so only the gateway is reachable):

```powershell
python tests/validate/validate_opendoor.py --gateway https://gateway-production-4e58.up.railway.app --gateway-only
```

## What the checks prove

OpenDoor has no service-discovery registry. The gateway finds Core and Insights through its
environment variables `CORE_URL` and `INSIGHTS_URL` (`gateway/.env`), and Insights finds Core
through `CORE_INTERNAL_URL` + `SERVICE_KEY_INSIGHTS` (`services/insights-service/.env`). The
Business Registry is the legacy SOAP service that the admin's employer check calls, not a
service registry.

| # | Check | Proves |
|---|---|---|
| 1–4 | Core `/up`, Insights `/health`, registry `/health` and `/soap?wsdl` | Each service runs; the registry's SQLite data is there |
| 5 | Gateway `/api/health` shows `core: up`, `insights: up` | The gateway's `CORE_URL` / `INSIGHTS_URL` are right |
| 6 | Sample posting from `GET /api/job-postings` | There is data to test with |
| 7 | Core `GET /api/job-postings/{id}` returns that `id` | Direct lookup in Core |
| 8 | Same request through the gateway, same `id` and title | The gateway forwards `/api/*` to Core |
| 9 | Unknown posting through the gateway → 404 `NOT_FOUND` with `request_id` | Core's error envelope passes through |
| 10 | Gateway `/api/me` without a token → 401 `UNAUTHENTICATED` | Protected routes need a login |
| 11 | Insights snapshot `GET /api/insights/job-postings/{id}`: `job_posting_id` = sample and `sources.core = ok` | Service-to-service: Insights fetched the posting from Core's `/internal` summary with the service key |
| 12 | Same snapshot through the gateway | The gateway forwards `/api/insights/*` to Insights |
| 13 | Core `/internal/...` without the service key → 401 | The internal endpoint is protected |
| 14 | Gateway `/internal/...` → 404 | The gateway never exposes internal routes |

`psgc`, `nominatim` and `overpass` in the snapshot's `sources` may be `unavailable` (for
example no internet, or the public Overpass servers are busy). That is the designed fallback
and does not fail the check; only `core` must be `ok`.

## When a check fails

| Check | Common cause | Where to look |
|---|---|---|
| Core is up | Core not started, or started on another port | The Core terminal; `php artisan serve` prints its port |
| Insights is up | Insights not started, or a different `PORT` | `services/insights-service/.env` → `PORT` |
| Registry is up / WSDL | Registry not started, or `data/registry.db` missing (`database: unavailable`) | Run `php seed.php` in `services/business-registry-soap` |
| Gateway reaches Core and Insights | Wrong `CORE_URL` / `INSIGHTS_URL`, or the service behind it is down | `gateway/.env`, then checks 1–2 |
| Sample posting found | Empty database (no open postings), or Core's first request after start was slower than 2 s (`TimeoutError`) | Seed (`php artisan db:seed`) or pass `--id`; just run again, or use `--timeout 5` |
| Core returns the posting | `--id` of a posting that is not open (draft, closed, deleted) → 404 | Pick an open posting, or leave out `--id` |
| Gateway routes /api/* to Core | Gateway down, or `CORE_URL` points somewhere else (503 `SERVICE_UNAVAILABLE` = Core unreachable, 504 = too slow) | `gateway/.env`, the gateway terminal (logs `upstream` errors with the `request_id`) |
| Gateway passes the 404 | Something other than Core answers on `CORE_URL` | `gateway/.env` |
| Gateway requires a token | The route is not behind `auth:sanctum` in Core | `services/core-api/routes/api.php` |
| Insights builds the snapshot | 503 `SERVICE_UNAVAILABLE`: Insights cannot reach Core – wrong `CORE_INTERNAL_URL`, or `SERVICE_KEY_INSIGHTS` differs between Insights and Core (Core answers 401) | `services/insights-service/.env` and `services/core-api/.env` (`SERVICE_KEY_INSIGHTS`, compare without printing them) |
| Gateway routes /api/insights/* | Wrong `INSIGHTS_URL`; or the snapshot took longer than the gateway's 15 s | `gateway/.env`; check 11 |
| Core refuses /internal | 200 = the `service.key` middleware is missing on `/internal` | `services/core-api/bootstrap/app.php` |
| Gateway never exposes /internal | The gateway's `/internal` block was removed | `gateway/src/app.js` |

To see the gateway's answer when a service is down, stop Core and run the script: every check
that needs Core fails, and the gateway answers 503 `SERVICE_UNAVAILABLE` in the JSON error
envelope (not an HTML page or a stack trace).
