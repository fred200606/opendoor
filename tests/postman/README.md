# OpenDoor Postman collection

`OpenDoor.postman_collection.json` is **generated** – edit `build-collection.mjs`, then run:

```powershell
node tests/postman/build-collection.mjs
```

Folders run in order: 01 Auth · 02 Master Data · 03 Employer & Postings · 04 Candidate & Search · 05 Applications · 06 Feedback & Trust Score · 07 Insights Mashup · 08 Admin & SOAP Registry · 09 Negative & Security Cases. Folder 08 needs the Business Registry running (`php -S 127.0.0.1:8003 -t public` in `services/business-registry-soap`); it also creates a throwaway employer (`pm-employer-<timestamp>@opendoor.test`) and leaves Kalinga Foods (employer2@) pending as it found it. Folder 09 needs 01, 03, 05 and 08 first (it reuses their tokens and the throwaway employer): T09, role/ownership and privacy checks, SQL-like search text, malformed JSON, CORS and X-Powered-By, and the suspension rule – the throwaway employer posts, is suspended (token revoked, login 403, posting hidden) and reactivated, then deletes its posting. Request names carry the SIA test-plan IDs (e.g. `T01 …`). Every request checks the `X-Request-ID` header and a response time under 1000 ms; negative cases check `error.code` and that `error.request_id` matches the header.

## Run with Newman

The demo password is never stored in the environment files. Pass it on the command line:

```powershell
npx newman run tests/postman/OpenDoor.postman_collection.json `
  -e tests/postman/local.postman_environment.json `
  --env-var "demoPassword=<DEMO_PASSWORD from services/core-api/.env>"
```

Environments: `local` (gateway on `http://localhost:8080/api`), `ci` (docker compose service `gateway`), `production` (Railway gateway). The run creates a throwaway candidate (`pm-candidate-<timestamp>@opendoor.test`, which also gets a profile, two needs and a résumé) and a category/accommodation and two postings that it deletes again. Folder 05 leaves one hired application (on its deleted posting) and in-app notifications for the demo employer – applications are never deleted. Demo profiles are only read, never changed. Folder 06 (T10) rates the seeded hire of `candidate2@` at `employer2@` – the 3rd response that publishes that trust score. On a freshly seeded database it expects 201; on later runs 409 `FEEDBACK_EXISTS` (the score checks still run). Re-seed from scratch (`php artisan migrate:fresh --seed`) to see the 201 again.

Folder 07 needs the Insights Service (`:8002`) and calls the live PSGC, Nominatim and Overpass APIs, so it checks the snapshot's shape and `sources` flags, not specific places. Two requests run only when asked:

- **T16** (Core `/internal` without `X-Service-Key` → 401) calls Core directly. It runs when `coreUrl` is set; `local` sets it to `http://127.0.0.1:8001`, while `ci`/`production` leave it empty because Core is private there.
- **T13** (snapshot with Overpass down) runs only with `--env-var overpassDown=true`, after starting Insights with an unreachable Overpass and an in-memory cache, so no cached answer hides the outage:

  ```bash
  cd services/insights-service
  CACHE_DB_USER= OVERPASS_URL=http://127.0.0.1:9/api/interpreter node --env-file=.env src/server.js
  # then, from the repo root:
  npx newman run tests/postman/OpenDoor.postman_collection.json -e tests/postman/local.postman_environment.json --folder "07 Insights Mashup" --env-var overpassDown=true
  ```

Run Newman from the **repo root**: folder 04 uploads `tests/postman/fixtures/cv.pdf` and `not-a-pdf.pdf` by that relative path.

The gateway allows 120 requests per minute per IP (`RATE_LIMIT_PER_MIN`); a full run is now about 180 requests, so set `RATE_LIMIT_PER_MIN=300` in your local `gateway/.env` (keep 120 in production) and wait a minute between runs.

On Windows, `php artisan serve` is single-threaded, so a login/register (bcrypt) – or a fast request queued behind one – can occasionally exceed 1000 ms locally; rerun before treating it as a regression.
