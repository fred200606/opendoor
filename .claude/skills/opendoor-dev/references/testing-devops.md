# Testing and DevOps

## Automated tests per component

| Component | Tool | Must cover |
|---|---|---|
| core-api | PHPUnit feature tests (`php artisan test`, MySQL test DB) | Policies (owner-only edits, employer sees needs only via own applications), every allowed + disallowed status transition, duplicate apply, feedback window and once-only, trust score math and 3-response threshold, matching order and `missing`, registry client with faked SoapClient (ok + each fault), ServiceKey middleware |
| gateway | Jest + supertest | routing, request ID, CORS, rate limit, timeout/unavailable envelopes, `/internal` blocked |
| insights-service | Jest + nock | snapshot with all sources ok, each source failing (`sources` flags), cache hit, tag→category mapping, haversine, PSGC fallback |
| business-registry-soap | PHP script/PHPUnit + `xmllint` | WSDL valid, ACTIVE / NOT_FOUND / EXPIRED responses, auth fault |
| frontend | ESLint, build, axe (e.g. `@axe-core/cli` or Playwright + axe) | no critical accessibility violations on main pages |

## Postman collection (`tests/postman/`)

Folders run in order: 01 Auth · 02 Master Data · 03 Employer & Postings · 04 Candidate & Matching · 05 Applications & Status · 06 Feedback & Trust Score · 07 Insights Mashup · 08 Admin & SOAP Registry · 09 Negative & Security Cases.

- Environments: `local`, `ci`, `production` (`baseUrl`, role emails; passwords via `--env-var`, never committed).
- Save tokens and IDs to variables (`candidateToken`, `employerToken`, `adminToken`, `jobPostingId`, `applicationId`, `employerId`).
- Every request asserts: status code; IDs; business values (status, `match.met <= match.total`, sorted by met desc, trust score published only with `based_on >= 3`); `error.code` + `error.request_id` for negative cases; JSON schema for key responses; response time < 1000 ms (except the snapshot).
- The documentation's test plan IDs T01–T16 should each map to at least one request (name requests `T05 Apply twice → 409`).
- CI: `newman run tests/postman/OpenDoor.postman_collection.json -e tests/postman/ci.postman_environment.json --reporters cli,htmlextra`.

## JMeter (`tests/jmeter/opendoor-matching.jmx`)

Load: 50 threads, 60 s ramp-up, 10 loops on `GET /api/job-postings?match=1&page=${__Random(1,10)}` and `GET /api/job-postings/${postingId}` with `Authorization: Bearer ${token}` from `tokens.csv` (tokens from a seeded test environment only). Stress: 100 and 200 threads. Assertions: 200, `$.meta.match_mode == true`, duration ≤ 3000 ms. Run `jmeter -n -t opendoor-matching.jmx -l results.jtl -e -o report/`. Targets: P95 < 1500 ms, error rate < 1% at 50 users. Seed 500 postings first.

## Git workflow

- Branches: `main` (protected, deployed), `develop`, `feature/<module>-<desc>` (e.g. `feature/M5-matching`), `fix/<desc>`.
- Conventional Commits with scope = component: `feat(core): ...`, `fix(gateway): ...`, `test(postman): ...`, `docs: ...`.
- PR into `develop` with 1 reviewer + green CI; release by merging `develop` → `main` and tagging `v1.x`.

## GitHub Actions (`.github/workflows/ci.yml`)

1. **Validate & test** (PR to develop/main, push to develop): path-filtered parallel jobs – frontend (npm ci, lint, build, axe), gateway + insights (npm ci, lint, jest), core-api (composer install, pint --test, php artisan test with a `mysql:8` service), registry (php -l, xmllint WSDL, SOAP smoke).
2. **Integration**: `docker compose -f docker-compose.yml -f docker-compose.ci.yml up -d` (external APIs replaced by `mock-external`), migrate + seed, Newman with `ci` env, upload HTML report artifact.
3. **Deploy**: merge to `main` → Vercel and Railway GitHub integrations deploy.
4. **Post-deploy smoke**: Newman smoke folder against the production gateway.

Secrets only in GitHub Actions secrets / Railway / Vercel variables.

## Local startup

```
cp <each component>/.env.example <each component>/.env
docker compose up -d --build
docker compose exec core-api php artisan key:generate
docker compose exec core-api php artisan migrate --seed
cd frontend && npm ci && npm run dev    # VITE_API_URL=http://localhost:8080/api
```
