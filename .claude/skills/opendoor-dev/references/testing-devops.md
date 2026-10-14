# Testing and DevOps

## Automated tests per component

| Component | Tool | Must cover |
|---|---|---|
| core-api | PHPUnit feature tests (`php artisan test`, MySQL test DB) | Policies (owner-only edits, employer sees needs only via own applications), every allowed + disallowed status transition, duplicate apply, feedback window and once-only, trust score math and 3-response threshold, matching order and `missing`, registry client with faked SoapClient (ok + each fault), ServiceKey middleware |
| gateway | Jest + supertest | routing, request ID, CORS, rate limit, timeout/unavailable envelopes, `/internal` blocked |
| insights-service | Jest + nock | snapshot with all sources ok, each source failing (`sources` flags), cache hit, tag→category mapping, haversine, PSGC fallback |
| business-registry-soap | PHP script/PHPUnit + `xmllint` | WSDL valid, ACTIVE / NOT_FOUND / EXPIRED responses, auth fault |
| frontend | oxlint (with `jsx-a11y`), Vitest + Testing Library, build, axe (e.g. `@axe-core/cli` or Playwright + axe) | auth/routing logic, API client errors; no critical accessibility violations on main pages |

## Postman collection (`tests/postman/`)

Folders run in order: 01 Auth · 02 Master Data · 03 Employer & Postings · 04 Candidate & Matching · 05 Applications & Status · 06 Feedback & Trust Score · 07 Insights Mashup · 08 Admin & SOAP Registry · 09 Negative & Security Cases.

- Environments: `local`, `ci`, `production` (`baseUrl`, role emails; passwords via `--env-var`, never committed).
- Save tokens and IDs to variables (`candidateToken`, `employerToken`, `adminToken`, `jobPostingId`, `applicationId`, `employerId`).
- Every request asserts: status code; IDs; business values (status, `match.met <= match.total`, sorted by met desc, trust score published only with `based_on >= 3`); `error.code` + `error.request_id` for negative cases; JSON schema for key responses; response time < 1000 ms (except the snapshot).
- The documentation's test plan IDs T01–T16 should each map to at least one request (name requests `T05 Apply twice → 409`).
- CI: `newman run tests/postman/OpenDoor.postman_collection.json -e tests/postman/ci.postman_environment.json --reporters cli,htmlextra`.

## JMeter (`tests/jmeter/opendoor-matching.jmx`)

Load: 50 threads, 60 s ramp-up, 10 loops on `GET /api/job-postings?match=1&page=${__Random(1,10)}` and `GET /api/job-postings/${postingId}` with `Authorization: Bearer ${token}` from `tokens.csv` (written by `php artisan load-test:data`: 500 open postings, 50 load-test candidates with one token each; `--remove` deletes them). Stress: 100 and 200 threads, 5 loops (`-Jthreads/-Jrampup/-Jloops`). Assertions: 200, `$.meta.match_mode == true`, `$.meta.per_page == ${pageSize}`, duration ≤ 3000 ms. Run `jmeter -n -t opendoor-matching.jmx -Jhost=... -l results.jtl -e -o report/` (details in `tests/jmeter/README.md`). Targets: P95 < 1500 ms, error rate < 1% at 50 users.

## Git workflow

- Branches: `main` (protected, deployed), `develop`, `feature/<module>-<desc>` (e.g. `feature/M5-matching`), `fix/<desc>`.
- Conventional Commits with scope = component: `feat(core): ...`, `fix(gateway): ...`, `test(postman): ...`, `docs: ...`.
- As practised: small tested commits straight to `main` (CI runs on every push to `main`/`develop` and on PRs); progress, decisions and known issues live in `PROGRESS.md`.

## GitHub Actions (`.github/workflows/ci.yml`)

1. **Validate & test** (push to main/develop, PR to either, manual run = all jobs): path-filtered parallel jobs – frontend (npm ci, oxlint, Vitest, build), gateway + insights (npm ci, lint, jest), core-api (composer install, pint --test, php artisan test with a `mysql:8` service), registry (php -l, xmllint WSDL, SOAP smoke).
2. **Integration**: `docker compose -f docker-compose.yml -f docker-compose.ci.yml up -d` (external APIs replaced by `mock-external`), throwaway secrets per run, migrate + seed, Newman full collection + folder 07 again with Overpass unreachable (T13), axe WCAG 2.1 A/AA on the built frontend (Playwright Chromium), upload the Newman HTML reports artifact.
3. **Deploy**: merge to `main` → Vercel and Railway GitHub integrations deploy.
4. **Post-deploy smoke**: Newman smoke folder against the production gateway (planned – not in `ci.yml` yet; add it at deployment).

Secrets only in Railway / Vercel variables; CI generates throwaway secrets per run (nothing stored in GitHub).

## Local startup (native – Docker is not used locally; it is only for CI and Railway images)

```
cp <each component>/.env.example <each component>/.env
mysql -u root -p < docs/setup/create-databases.sql            # once: opendoor_core, insights_cache + users
cd services/core-api && composer install && php artisan key:generate && php artisan migrate --seed && php artisan serve --port=8001
cd services/business-registry-soap && php seed.php && php -S localhost:8003 -t public
cd services/insights-service && npm ci && npm run dev         # :8002
cd gateway && npm ci && npm run dev                           # :8080
cd frontend && npm ci && npm run dev                          # :5173, VITE_API_URL=http://localhost:8080/api
```
Same steps as SIA doc section 8.5 and the README.
