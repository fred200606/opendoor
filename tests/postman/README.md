# OpenDoor Postman collection

`OpenDoor.postman_collection.json` is **generated** – edit `build-collection.mjs`, then run:

```powershell
node tests/postman/build-collection.mjs
```

Folders run in order: 01 Auth · 02 Master Data · 03 Employer & Postings · 04 Candidate & Search (05–09 are added with their backend phases). Request names carry the SIA test-plan IDs (e.g. `T01 …`). Every request checks the `X-Request-ID` header and a response time under 1000 ms; negative cases check `error.code` and that `error.request_id` matches the header.

## Run with Newman

The demo password is never stored in the environment files. Pass it on the command line:

```powershell
npx newman run tests/postman/OpenDoor.postman_collection.json `
  -e tests/postman/local.postman_environment.json `
  --env-var "demoPassword=<DEMO_PASSWORD from services/core-api/.env>"
```

Environments: `local` (gateway on `http://localhost:8080/api`), `ci` (docker compose service `gateway`), `production` (Railway gateway). The run creates a throwaway candidate (`pm-candidate-<timestamp>@opendoor.test`, which also gets a profile, two needs and a résumé) and a category/accommodation and posting that it deletes again. Demo accounts are only read, never changed.

Run Newman from the **repo root**: folder 04 uploads `tests/postman/fixtures/cv.pdf` and `not-a-pdf.pdf` by that relative path.

The gateway allows 120 requests per minute per IP (`RATE_LIMIT_PER_MIN`). One run fits; wait a minute before running it again, or you get 429 `RATE_LIMITED` responses.

On Windows, `php artisan serve` is single-threaded, so a login/register (bcrypt) can occasionally exceed 1000 ms locally; rerun before treating it as a regression.
