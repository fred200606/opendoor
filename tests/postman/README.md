# OpenDoor Postman collection

`OpenDoor.postman_collection.json` is **generated** – edit `build-collection.mjs`, then run:

```powershell
node tests/postman/build-collection.mjs
```

Folders run in order: 01 Auth · 02 Master Data · 03 Employer & Postings · 04 Candidate & Search · 05 Applications · 06 Feedback & Trust Score · 08 Admin & SOAP Registry (07 and 09 are added with their backend phases). Folder 08 needs the Business Registry running (`php -S 127.0.0.1:8003 -t public` in `services/business-registry-soap`); it also creates a throwaway employer (`pm-employer-<timestamp>@opendoor.test`) and leaves Kalinga Foods (employer2@) pending as it found it. Request names carry the SIA test-plan IDs (e.g. `T01 …`). Every request checks the `X-Request-ID` header and a response time under 1000 ms; negative cases check `error.code` and that `error.request_id` matches the header.

## Run with Newman

The demo password is never stored in the environment files. Pass it on the command line:

```powershell
npx newman run tests/postman/OpenDoor.postman_collection.json `
  -e tests/postman/local.postman_environment.json `
  --env-var "demoPassword=<DEMO_PASSWORD from services/core-api/.env>"
```

Environments: `local` (gateway on `http://localhost:8080/api`), `ci` (docker compose service `gateway`), `production` (Railway gateway). The run creates a throwaway candidate (`pm-candidate-<timestamp>@opendoor.test`, which also gets a profile, two needs and a résumé) and a category/accommodation and two postings that it deletes again. Folder 05 leaves one hired application (on its deleted posting) and in-app notifications for the demo employer – applications are never deleted. Demo profiles are only read, never changed. Folder 06 (T10) rates the seeded hire of `candidate2@` at `employer2@` – the 3rd response that publishes that trust score. On a freshly seeded database it expects 201; on later runs 409 `FEEDBACK_EXISTS` (the score checks still run). Re-seed from scratch (`php artisan migrate:fresh --seed`) to see the 201 again.

Run Newman from the **repo root**: folder 04 uploads `tests/postman/fixtures/cv.pdf` and `not-a-pdf.pdf` by that relative path.

The gateway allows 120 requests per minute per IP (`RATE_LIMIT_PER_MIN`); a full run is now about 126 requests, so set `RATE_LIMIT_PER_MIN=300` in your local `gateway/.env` (keep 120 in production) and wait a minute between runs.

On Windows, `php artisan serve` is single-threaded, so a login/register (bcrypt) can occasionally exceed 1000 ms locally; rerun before treating it as a regression.
