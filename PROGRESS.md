# OpenDoor – Development Progress

> **Single source of truth for "where are we".** Read this before doing anything; update it after every completed step.
> Rules: see `CLAUDE.md` → "Progress protocol". Keep entries short. Newest session log entry on top.

## Now

- **Current phase:** Phase 7 – Mashup (Insights)
- **In progress:** –
- **Next step:** Phase 7 – snapshot endpoint `GET /api/insights/job-postings/{id}` (`src/routes/snapshot.js` + `src/services/snapshot.js`, wire geocoder + nearby + centroids into `app.js`/`server.js`): Core client (`CORE_INTERNAL_URL` + `X-Service-Key`, 3 s; 404 → 404; decide Core down → 503 vs 200), PSGC label for `psgc_code` (needs a city lookup – Core's `location_label` as fallback), employer_claims grouped, community_verification (null until published), `sources`, disclaimer, `generated_at` (+08:00). **Budget:** worst case Core 3 + PSGC 5 + Nominatim 2×5 + queue 2 + Overpass 8 s exceeds the gateway's 15 s – add an overall deadline (e.g. skip sources once ~12 s are used). Jest/nock tests with each source failing. **Waiting on the user:** `NOMINATIM_CONTACT_EMAIL` in `services/insights-service/.env` → then run `npm run build:city-centroids` and a live Nominatim check.
- **Blockers:** –

## Pending decisions (ask the user once; record the answer in "Decisions" and remove it here)

- (none)

## Decisions (final – do not re-ask)

- 2026-10-07 – Overpass: cache stores trimmed elements under the point rounded to 4 dp + radius; distances from the exact point; way centres beyond 500 m dropped; **unnamed places are dropped from `other`** (live data filled it with nameless entrances/kerbs; unnamed stops/toilets/parking stay); `nearby_accessible: null` when there are no coordinates or Overpass failed with nothing cached (empty lists = nothing found). 429/504 HTML and `runtime error` remarks are failures, never cached. SIA doc 4.5 to mention the `other` rule at the Phase 7 doc sync.

- 2026-10-06 – Insights geocoding: query "address, place"; no street match → "place" alone (`precision: city`), cached under the full address hash (SHA-256 of the lower-cased, space-collapsed query); no match → bundled centroid with `nominatim: ok`. Throttle 1 req/s with max 2 s queue wait (over → not sent, no cooldown); 60 s cooldown after failures. Empty `NOMINATIM_CONTACT_EMAIL` = Nominatim off (never call it without the policy contact). Bundled centroids come from Nominatim (build script), not OSM boundary relations (10-digit `ref` on only ~490 of ~1,600; bbox centres can be in the sea). The user's account email is not used for this.

- 2026-10-06 – Insights locations: outward codes are the official 10-digit PSGC codes; the PSGC API's 9-digit codes stay in cached items as `ref` and parents are looked up, not converted (BARMM 150000000 ↔ 1900000000). `parent` must be 10 digits (422 `VALIDATION_FAILED`), unknown → 404, regions ignore `parent`, cities accept any region code. Lists sorted by name; region names "Ilocos Region (Region I)" / "National Capital Region (NCR)". Order: fresh cache → PSGC → stale → bundled fallback (all regions + provinces, NCR, cities of each province; `npm run build:psgc-fallback`) → 503 `SERVICE_UNAVAILABLE`; header `X-Data-Source`. 60 s cooldown after a source failure. Cache tables created at startup; the cache DB is optional (misses when down). Axios for outbound calls (SIA doc stack).

- 2026-10-06 – Internal summary: `routes/internal.php` under `/internal` with `service.key` (`EnsureServiceKey`, `hash_equals` against `services.insights.key`; an unset key refuses every call; key checked before the lookup). Visible postings only (open + approved + not deleted; `closes_at` not checked, same as search), else 404. Added `location_label` (fallback when PSGC is down); `trust_score` = the public `TrustScore` (breakdown with name/partial/not_delivered, `[]` until published). Accommodations sorted by name.
- 2026-10-06 – Core registry: `registry_checks` also stores the `business_reg_no` + `registry_type` that were checked; `latest_registry_check` is null once the employer changes them. NOT_FOUND/ERROR have `name_match: null`. Only REGISTRY_UNAVAILABLE stores an ERROR row; auth (502) and invalid input (422) store nothing. `reject` on a verified employer = "Remove verification". `raw_response` keeps only the registry's answer (never the request with the password). Local `REGISTRY_WSDL_URL` uses `127.0.0.1`.
- 2026-10-05 – Registry: plain PHP without Composer (`src/` autoloader, `tests/run.php` own runner). Registration numbers are normalized (hyphens/spaces removed, upper case) before the 5–20 alphanumeric check, so Core's `CS-2019-12345` matches. WS-Security checked on the raw envelope (DOM, `LIBXML_NONET`, `hash_equals`) before `SoapServer` runs; PasswordDigest refused. WSDL's `soap:address` is rewritten to the requesting host (or `REGISTRY_PUBLIC_URL`). DB at `data/registry.db` (`REGISTRY_DB_PATH`). Seed: the 2 demo employers ACTIVE + 3 more ACTIVE, 2 EXPIRED, 2 CANCELLED.
- 2026-10-05 – M7: the posting's accommodations are recorded in a new pivot `application_accommodation` when an application becomes hired (migration back-fills already-hired ones); the form lists those, sorted by name, and every item must be rated. Not hired → 422 FEEDBACK_NOT_OPEN (form and submit). Form adds `submitted`; Application adds `feedback_submitted` (candidate only). Trust score `breakdown` is `[]` until published (same answer for everyone). Score math in integers (half points) = PHP `round()`. Recalculation by `FeedbackObserver` after commit; `Feedback::submit()` writes response + items in one transaction.
- 2026-10-05 – `GET /job-postings/{id}` returns `my_application {id,status,created_at}|null` for candidates (details only) so the page shows the application instead of the apply form.
- 2026-10-05 – M6: apply returns the full Application (201). Closed postings (or open past `closes_at` day, Manila) → 422 POSTING_CLOSED; drafts/unapproved → 404. Admins have no access to applications (403). The employer's `candidate` block also carries `skills`, `experience`, `resume_url` (signed) and `disability_type` only when `show_disability`. Notifications: Laravel database notifications, type `application_received` / `application_status_changed`, `data {message,url,application_id,status}` to the party that did not act. Status changes run under a row lock.
- 2026-10-05 – Paginator paths are built from `PUBLIC_API_URL`'s origin + the request path (`Paginator::currentPathResolver` → `PublicUrl::path`), so `meta.path`/`links` point at the gateway.
- 2026-10-05 – M5: `sort=best` = needs met (match mode) then newest; without match mode best = newest; ties by id desc. Candidates with needs get `match` on every posting even with match=0; `match=1` from guests/other roles/candidates without needs is ignored (`match_mode:false`), not an error. `accommodations[]` filter = posting must offer all. Keyword LIKE uses `ESCAPE '!'` (same on MySQL and SQLite). Documented in OpenAPI.
- 2026-10-05 – Frontend: buttons that become unavailable use `components/Button.jsx` (`aria-disabled`, clicks ignored) instead of native `disabled`, which drops focus to `<body>` in Chrome; `useApiForm.submit` / `useAction.run` ignore a second call while one is running. Rule added to `opendoor-dev` conventions.
- 2026-10-04 – Frontend focus rescue: `useFocusRescue` in AppLayout moves focus to the page `<h1>` whenever the focused element is removed from `<main>` (rows/cards that disappear after an action), in addition to the dialog's own fallback.
- 2026-10-04 – M4: company profile required to post (422 `errors.company`); `submit` defaults to false; `submit:true` on create or edit → `pending_approval` + not approved (editing an open posting is re-approved); `submit:false` only for drafts; close/reopen rules; unpublished postings 404 for non-owners; daily `postings:close-expired` 00:05 Manila; retired accommodations may stay on postings that already had them. Admin reject → back to `draft` with `rejection_reason` (next step).
- 2026-10-04 – M3: clients send `location_label` with `location_psgc` (Core stores the label; PSGC data stays in Insights). Logos are stored on Core's private disk and served via `GET /api/employers/{id}/logo`; `logo_url` is built from `PUBLIC_API_URL` (the gateway). `unique(registry_type, business_reg_no)`; changing number/type clears `verified_at`; any save after a rejection clears the reason (back to the queue). `registry_checks` table is built in Phase 6 with the SOAP client.
- 2026-10-04 – Postman collection is generated from `tests/postman/build-collection.mjs`; demo password only via `--env-var demoPassword`. Gateway upstream URLs default to `127.0.0.1` (Windows `localhost` → IPv6 fallback adds ~200 ms).
- 2026-10-04 – Contract additions made for the screens (all in `docs/openapi.yaml`): `GET /admin/employers`, `/admin/employers/{id}`, `/admin/job-postings`, `/admin/feedback`; dashboard schemas (Candidate/Employer/AdminDashboard); `Notification.data.message/url`; `JobPosting.rejection_reason` (owner/admin); `Report.job_posting` in admin lists; `GET /employer/company` 404 until created; résumé PDF ≤ 5 MB; logo PNG/JPG/WebP ≤ 2 MB.
- 2026-10-04 – M13 display settings (text size, high contrast, reduced motion) are stored in the browser (`opendoor.display`) until an endpoint for `users.display_prefs` exists. Notifications use `data.message` + optional in-app `data.url`.
- 2026-10-04 – User asked to build all frontend screens now (ahead of the backend phases). Screens follow `docs/openapi.yaml`; those whose endpoints are not built yet show the API error until their backend phase is done.
- 2026-10-04 – Frontend: React 19 + React Router 7 + Vite 8 (latest, like Laravel). Lint with oxlint + `jsx-a11y` (template default, replaces ESLint); `prefer-tag-over-role` off (`<output>` has uneven screen-reader support). Vitest + Testing Library for unit tests. Token in `localStorage` (`opendoor.token`). Portal landing = `/{role}/dashboard`; logout → home, expired token → `/login`.
- 2026-10-04 – Gateway: Express 4 + http-proxy-middleware 4 (ESM). Paths forwarded unchanged → Insights must serve `/api/insights/*` and `GET /health`. Gateway drops upstream CORS headers (Laravel sends `*`). New env `TRUST_PROXY` (1 on Railway). Own upstream timeout (httpxy `proxyTimeout` can't be told apart from a reset).
- 2026-10-04 – M11: "in use" is detected by FK `restrictOnDelete` (all future FKs to categories/accommodations must use it); category in use → 422 `errors.category`; accommodation in use → retired, 200. Added `GET /admin/accommodations` (incl. retired). `accommodations.name` max 150 (OpenAPI).
- 2026-10-04 – M1 details: emails stored lower-case; wrong credentials → 422 `errors.email` (same for unknown email); `ACCOUNT_SUSPENDED` only after a correct password; login limit 5/min per email+IP; password change must differ and revokes the user's other tokens; single JSON resources are not wrapped in `data` (`JsonResource::withoutWrapping()`), paginated lists still are. Documented in `docs/openapi.yaml`.
- 2026-10-04 – Demo accounts: `admin@`, `candidate@`, `candidate2@`, `employer@`, `employer2@opendoor.test`, all with `DEMO_PASSWORD`. `DemoUserSeeder` refuses to run without it (min 8 chars).
- 2026-10-04 – Edited Laravel's default users migration in place (nothing deployed yet). `role`, `is_active`, `consented_at` are not mass-assignable (set via `forceFill`). Migrations hard-code enum values; PHP enums `UserRole`, `AccommodationGroup` are used in app code.
- 2026-10-04 – Added error code `SERVER_ERROR` (HTTP 500, generic message) – the contract had no code for unexpected errors. Added to `api-contract.md` and `docs/openapi.yaml`.
- 2026-10-04 – Removed the Laravel Boost `CLAUDE.md`/`AGENTS.md` that the Laravel 13 skeleton ships in `services/core-api` (generic install instructions that conflict with the project instructions).
- 2026-10-03 – No existing UI code: scaffold a fresh React (Vite) app in `frontend/` (WCAG 2.1 AA from the start).
- 2026-10-03 – GitHub: private repo `fred200606/opendoor`; git uses `gh auth git-credential` (plain push hung on a hidden prompt).
- 2026-10-03 – Business Registry SOAP service is a **simulated** DTI/SEC registry with seeded data.
- 2026-10-03 – API gateway: Node.js/Express (confirmed).
- 2026-10-03 – Core Service uses the **latest Laravel** release, not 11; replace "Laravel 11" in the skill and SIA doc.
- 2026-10-03 – Local development runs natively without Docker; Docker only for Railway/CI.
- 2026-10-03 – Project lives in `C:\dev\opendoor` (moved out of OneDrive). The OneDrive copy is obsolete.
- 2026-10-03 – Apply rule updates to skill + SIA doc: trust score shown as whole %, feedback opens on calendar day 30 after hire (Asia/Manila), OSM tag→category table in SIA 4.5, SOAP `Client.Validation` fault in SIA 4.3, enums/cache tables in OpenAPI + Appendix F.
- 2026-10-02 – Stack: React (Vite) · Node/Express gateway · Laravel + Sanctum + MySQL 8 Core · Node/Express Insights · PHP SoapServer registry · Vercel + Railway. Source: SIA documentation.

## Environment notes

- Core tests run on SQLite in memory. For new raw SQL, also run them on MySQL: copy `phpunit.xml` with `DB_CONNECTION=mysql`, `DB_DATABASE=opendoor_core_test` to a temporary `phpunit.mysql.tmp.xml` in `services/core-api`, run `vendor/bin/phpunit -c` with it, then delete it (MySQL 8 reserves words like `of` that SQLite accepts).
- Main dev machine (Windows 11): PHP 8.4 (Herd Lite), Composer (Herd Lite `composer.bat`), Node 22.15, npm 10.9, MySQL 8.0.42, Git 2.45. **Docker: not installed.** Claude Code CLI used in the VS Code terminal (PowerShell).

## Checklist

Mark `[x]` when done **and committed**. Put the commit hash after the item if useful.

### Phase 0 – Setup
- [x] Move project out of OneDrive (copied to `C:\dev\opendoor` on 2026-10-03)
- [x] `git init`; first commit (cf38aae)
- [x] Apply rule updates (see Decisions 2026-10-03) to `opendoor-dev` references + SIA doc (via `opendoor-sia-docs`), incl. Laravel version
- [x] Monorepo folders; docx + diagrams moved to `docs/`
- [x] `.gitignore`, `README.md`, `.env.example` for every component (local `.env` files generated with random secrets)
- [x] Create MySQL databases `opendoor_core`, `opendoor_core_test`, `insights_cache` (+ users) – done 2026-10-04, passwords match local `.env` files
- [x] `docs/openapi.yaml` draft from the API contract (Redocly lint: valid)
- [x] GitHub remote created and pushed (private `fred200606/opendoor`, branches `main` + `develop`)

### Phase 1 – Foundation
- [x] Core: Laravel project (13.34) + Sanctum (`install:api`, `HasApiTokens`) + `APP_TIMEZONE=Asia/Manila`
- [x] Core: error envelope + `ApiException` + request-ID logging (`ApiErrorRenderer`, `AssignRequestId`; 11 feature tests)
- [x] Core: users / categories / accommodations migrations + seeders (admin, demo users via `DEMO_PASSWORD`) – 11 categories, 18 accommodations, 5 demo accounts; 8 tests
- [x] Core: M1 register / login / logout / me / password + role middleware + login rate limit (also `active` middleware)
- [x] Core: M11 public lists + admin CRUD (retire instead of delete) – plus `GET /admin/accommodations`
- [x] Core: feature tests for M1, M11 (`tests/Feature/Auth`, `tests/Feature/MasterData`)
- [x] Gateway: routing, CORS, rate limit, X-Request-ID, timeouts, `/api/health`, `/internal` blocked + Jest tests (23 tests; live smoke with Core OK)
- [x] Frontend: fresh React (Vite) app in `frontend/`; Axios client, AuthContext, ProtectedRoute, role redirect (14 Vitest tests; live check through gateway + Core OK)
- [x] Frontend: register + login pages wired through the gateway (error summary, consent, suspended/rate-limit messages)
- [x] Postman: folders 01 Auth, 02 Master Data (generator `build-collection.mjs`; 29 requests, 143 assertions pass with Newman)

### Phase 2 – Employer side
- [x] Core: M3 company profile (+ `registry_type`, `location_psgc`, `location_label`, logo via `/employers/{id}/logo`) – 13 tests; live check of `/employer/company` + `/employers/:id` OK
- [x] Core: M4 postings CRUD, structured accommodations with notes, draft → pending_approval → open → closed, soft delete, auto-close command (19 tests; DemoPostingSeeder)
- [x] Core: admin posting approval (`GET /admin/job-postings`, `PATCH …/approve`; 7 tests; live check of `/admin/job-postings`)
- [x] Core: Policies + feature tests (owner-only) – JobPostingPolicy, T08 covered
- [x] Frontend: company profile, my postings, create/edit posting screens wired – live-checked 2026-10-04 (create, edit, delete, company-required message)
- [x] Postman: folder 03 (25 requests: T02, T07, T08, approval workflow, visibility; whole collection 54 requests / 259 assertions pass)

### Phase 3 – Candidate side
- [x] Core: M2 profile + accommodation needs + resume upload (9514aa3; 18 tests; live check 2026-10-05: empty profile for new candidate, PDF upload, server 422 for non-PDF, signed gateway link 200 / tampered 403)
- [x] Core: M5 search, category/accommodation filters, matching (`withCount`, ordering, `missing`), sort, pagination (`NeedsMatcher`, `JobSearchController`; `match` also on details)
- [x] Core: feature tests for matching order and privacy rules (`tests/Feature/Search`, 12 tests; disability type never matches; employer view of needs is tested with applications in Phase 4)
- [x] Frontend: profile, find jobs (match mode, aria-live count), job details wired – live-checked 2026-10-05 with demo candidate (ranking 3/3 → 1/3 → 0/3, missing needs on details, keyword/company search, axe 0 violations on all three pages)
- [x] Postman: folder 04 (21 requests: profile, needs, résumé upload + signed link, T03–T05 search/matching, filters; whole collection 75 requests / 383 assertions pass)

### Phase 4 – Applications
- [x] Core: `ApplicationStatus` enum + `canTransitionTo`; apply / list / details / status endpoints; notifications on change (`ApplicationController`, `ApplicationPolicy`, `ApplicationUpdate` database notification, `applicants_count` on employer postings)
- [x] Core: feature tests for every allowed + disallowed transition, duplicate apply, closed posting (75-case unit table + `tests/Feature/Applications`, 31 tests; 228 Core tests pass)
- [x] Frontend: apply (cover note, interview request), my applications, employer applicants + decision screens wired – live-checked 2026-10-05 (apply ×2, duplicate message, withdraw, employer open → reviewed, hire → candidate sees feedback date; axe 0 on 5 pages). Added: applicant skills/experience/shared disability/résumé link; job details show an earlier application instead of the form (`my_application`)
- [x] Postman: folder 05 (19 requests: apply, 409, T06 refused transition, 403 for strangers/admin, open → reviewed, hire + feedback date, POSTING_CLOSED; whole collection 94 requests / 469 assertions pass)

### Phase 5 – Verification (feedback + trust score)
- [x] Core: feedback form + submit (window, once-only), `TrustScoreService`, observer, publish threshold 3, breakdown (+ `application_accommodation` snapshot at hire)
- [x] Core: feature tests for math, threshold, window (`tests/Feature/Feedback` 16 tests + 12-case percentage unit table; 257 Core tests pass)
- [x] Frontend: feedback form, TrustScoreCard on job details / employer page / employer trust-score page – live-checked 2026-10-05 (candidate2 rates the Chat hire: form of 4 items at hire, error summary focus, thank-you, "Already rated"; employer 79% → 81% with 7-row breakdown; job details + public employer cards; axe 0 on 5 pages)
- [x] Postman: folder 06 (16 requests: T10 3rd response publishes employer2@ at 78% – 201 on a fresh seed, 409 on re-runs; T11 not open; 403/401; validation; whole collection 110 requests / 544 assertions pass)

### Phase 6 – Legacy SOAP integration
- [x] Registry: WSDL, SoapServer handler, UsernameToken check, SQLite seed, faults (`php tests/run.php`: 39 checks incl. SoapClient smoke on its own port; faults namespace-qualified `SOAP-ENV:Client.*`)
- [x] Core: `BusinessRegistryClient`, `registry_checks` table, `PATCH /admin/employers/{id}/verify` (check/approve/reject), fault mapping (+ `GET /admin/employers[/{id}]`; live calls to the running registry OK for ACTIVE / NOT_FOUND / 422 / auth 502 / unreachable 502)
- [ ] Tests: faked SoapClient in Core; registry smoke test; `xmllint` WSDL check – first two done (`tests/Feature/Registry` 14 tests, also on MySQL; registry `php tests/run.php` 39 checks); `xmllint` not installed locally → add to CI (Phase 9), then tick
- [x] Frontend: admin employer verification screen shows registry result – live-checked 2026-10-06 (queue, ACTIVE 100% without warning, NOT_FOUND warning without score, approve, remove verification with reason, registry stopped → "did not respond" + ERROR row; focus stays on the check button; axe 0 on 4 views). No UI changes needed
- [x] Postman: folder 08 (registry part) (15 requests: T14 ACTIVE + stored check, T15 NOT_FOUND via a throwaway employer, approve / remove verification / employer re-save restores the queue, 403/404/422; whole collection 125 requests / 607 assertions pass, re-runnable)

### Phase 7 – Mashup (Insights)
- [x] Core: `/internal/job-postings/{id}/summary` + ServiceKey middleware (`tests/Feature/Internal` 13 tests incl. T16; 285 Core tests pass; live check 401/200/404 on MySQL)
- [x] Insights: PSGC locations endpoints + cache + fallback JSON (scaffold: Express ESM on 8002, envelope, request ID, `/health`; 34 Jest/nock tests; live check through the gateway: ok → cached, BARMM lookup, PSGC down → cached/fallback in < 35 ms)
- [ ] Insights: Nominatim client (throttle 1/s, UA) + cache – code done 2026-10-06 (`geocoder.js`, 18 nock tests, `geocode_cache` round trip on MySQL); tick after `npm run build:city-centroids` + a live Nominatim check, both need `NOMINATIM_CONTACT_EMAIL`
- [x] Insights: Overpass client + cache; tag→category transform; haversine (`nearby.js`, 34 tests; live check 2026-10-07 against overpass-api.de: Quezon Ave. 5.6 s, Ayala 2.4 s)
- [ ] Insights: snapshot endpoint with `sources` flags + Jest/nock tests (each source failing)
- [ ] Gateway: `/api/insights/*` route verified
- [ ] Frontend: Accessibility Snapshot section + PSGC location picker – UI built 2026-10-04 against OpenAPI; tick after a live check with the real endpoints
- [ ] Postman: folder 07

### Phase 8 – Administration
- [ ] Core: M10 users (suspend → revoke tokens), reports, feedback hide
- [ ] Core: M8 dashboards (candidate, employer, admin analytics)
- [ ] Core: M9 notifications list / read / read-all
- [ ] Frontend: admin screens, dashboards, notification bell wired – UI built 2026-10-04 against OpenAPI; tick after a live check with the real endpoints
- [ ] Postman: folder 09 negative + security cases

### Phase 9 – Release
- [ ] M12 saved jobs, M13 display settings (if time allows)
- [ ] GitHub Actions CI (lint, tests, build, Newman with mock externals)
- [ ] Dockerfiles for Railway (core-api, registry); Railway project + private networking; Vercel project
- [ ] Production seed; Newman smoke against production
- [ ] JMeter load + stress runs; save reports
- [ ] WCAG audit (Lighthouse, axe, NVDA); fixes
- [ ] SIA documentation: fill placeholders with real results (use `opendoor-sia-docs`)

## Known issues / TODO later

- Postman runs leave one hired application (on a soft-deleted posting) + notifications for the demo employer per run. Fine locally; before the production smoke (Phase 9) run only read-only folders there, or make Phase 8 analytics ignore soft-deleted postings.
- Gateway limit 120 req/min per IP: one Newman run is now 125 requests. Local `gateway/.env` uses `RATE_LIMIT_PER_MIN=300` (set 2026-10-06); CI needs the same; keep 120 in production (folder 09 may test 429).
- Windows: stopping a background `npm run …`/`npx …` task leaves its `node` child listening (Vite 5173 / gateway 8080). Start dev servers with `node` directly, or free the port (`Get-NetTCPConnection -LocalPort …`) after stopping.
- Live checks: the Playwright MCP Chrome window is visible; clicking in it during a scripted check moves the page. Upload test files must be inside the repo (e.g. git-ignored `.playwright-mcp/`).
- Demo employers/postings have `location_psgc = null` – fill real 10-digit PSGC codes (e.g. Quezon City 1381300000, Makati 1380300000) in the demo seeders before the snapshot live check (Phase 7).
- Railway: Core's local disk is ephemeral – logos/résumés need a Railway volume (or object storage) before production (Phase 9).
- Local Newman: bcrypt requests on Windows `php artisan serve` occasionally exceed the 1000 ms check (single-threaded dev server); rerun before treating as a regression.
- Frontend assumes: company logo PNG/JPG/WebP up to 2 MB, sent multipart as POST + `_method=PUT`; owner view of a posting may include `rejection_reason`.
- Gateway `npm audit`: 3 "high" (braces ← micromatch ← http-proxy-middleware). Not reachable: only our own `pathFilter` functions are used, no globs from requests. npm's "fix" is a downgrade to HPM 0.2.0 – ignore; re-check when HPM updates micromatch.

## Session log (newest first)

- 2026-10-07 – Overpass nearby places built and tested (88 Insights tests); live check OK once overpass-api.de recovered (it answered 504 earlier). Next: snapshot endpoint.
- 2026-10-06 – Nominatim geocoder built and tested (throttle, cooldown, cache, stale, centroid fallback); waiting for `NOMINATIM_CONTACT_EMAIL` for the centroid build + live check. Next: Overpass.
- 2026-10-06 – Insights Service scaffolded; PSGC location lists with MySQL cache, cooldown and bundled fallback (34 tests; live check through the gateway incl. PSGC down). OpenAPI: 10-digit codes, 404/422/503, `X-Data-Source`.
- 2026-10-06 – Phase 7 started: Core internal posting summary + service-key middleware (T16); OpenAPI adds `location_label` and the full breakdown. SIA doc sync for it at the end of Phase 7.
- 2026-10-06 – SIA doc synced for Phase 6 (4.1 admin employer list, 4.3 sample number = seeded CS201800777, normalization, ERROR checks, data model + registry seed); PDF 41 pages, no blank pages. **Phase 6 complete except the CI `xmllint` check.**
- 2026-10-06 – Postman 08 Admin & SOAP Registry done (T14/T15 against the running registry); Phase 6 code complete, SIA doc sync next.
- 2026-10-06 – Admin verification screen live-checked against the real SOAP registry (12 checks pass, incl. registry down); demo data reset (Kalinga pending, no checks).
- 2026-10-06 – Registry SOAP service done (39 checks); Core `BusinessRegistryClient` + `registry_checks` + admin employer queue/verify done (14 tests, 272 Core tests pass). Ran /doctor (user settings only: 3 unused plugins + 2 skills off, auto mode default).
- 2026-10-05 – SIA doc synced for M7 (4.1, 4.2, 6, 8, Appendix A + data model + seeders); fixed a blank page 8 (H1 now uses `pageBreakBefore` instead of page-break paragraphs); checked as PDF, 41 pages. **Phase 5 complete.**
- 2026-10-05 – Postman 06 Feedback & Trust Score done; seed moved candidate2@'s open hire to a closed employer2@ posting (2 earlier responses) so T10 really publishes a score. Phase 5 code complete; SIA doc sync next.
- 2026-10-05 – Feedback screens: `submitted` / `feedback_submitted` / empty-form handling; live-checked with a headless Chrome script (Playwright from the npx cache, `channel: 'chrome'`) because the Playwright MCP did not connect.
- 2026-10-05 – `DemoFeedbackSeeder`: 3 former employees rate employer@ (published 79%), candidate2@ has an open, unrated hire; fixed MySQL reserved alias `of` in the breakdown (feedback tests also pass on MySQL).
- 2026-10-05 – M7 Core done: feedback form/submit, hire-time accommodation snapshot, `TrustScoreService` + observer, public trust score; found + fixed a stale cached Employer skipping `feedback_count` writes.
- 2026-10-05 – Postman 05 Applications done. **Phase 4 complete.**
- 2026-10-05 – Phase 4 M6 applications: backend + tests, screens live-checked end to end; removed a leftover "Postman Data Encoder" posting from the rate-limited Newman run.
- 2026-10-05 – Backlog clean-up: page links via the gateway URL; SIA doc caught up (React 19/oxlint/Vitest, `SERVER_ERROR`, résumé + admin list endpoints in 4.1/Appendix A, data model, upload security, references) and checked as PDF (41 pages); dev references synced.
- 2026-10-05 – Postman 04 Candidate & Search done (multipart upload + signed link). **Phase 3 complete.**
- 2026-10-05 – M5 search + matching done (12 tests, 122 Core tests pass); Find jobs + job details live-checked with the demo candidate.
- 2026-10-05 – Submit/pagination buttons keep focus while busy (shared `Button`, 25 buttons in 14 files); verified in Chrome (focus stays, repeated Enter sends once); 92 Vitest tests.
- 2026-10-05 – M2 closed: OpenAPI for profile/needs/résumé + `GET /resumes/{id}`; live résumé check OK; found submit buttons losing focus when disabled (next step).
- 2026-10-04 – M2 candidate profile backend done (profiles, needs, résumé with signed links, DemoCandidateSeeder, shared UsableAccommodation rule); stopped at the usage limit before the live résumé check.
- 2026-10-04 – Postman 03 Employer & Postings done (cleans up after itself). **Phase 2 complete.**
- 2026-10-04 – Admin posting approval done; live check (reject with reason, approve → public employer page) found focus lost after list reloads → app-wide focus rescue.
- 2026-10-04 – M4 postings done (CRUD, accommodations + notes, status rules, soft delete, auto-close, demo postings); live UI check found + fixed dialog focus loss after deleting a row and a dead error-summary link.
- 2026-10-04 – M3 company profile done (employers table, GET/PUT company with logo, public page + logo route, demo companies); frontend sends `location_label`; live UI check incl. logo upload through the gateway.
- 2026-10-04 – Postman 01 Auth + 02 Master Data done and passing with Newman. **Phase 1 complete.**
- 2026-10-04 – Live browser check (Vite → gateway → Core): register with server errors, profile with real accommodation groups, admin master data CRUD, dialogs/focus, axe 0 violations on register/profile/master data, no sideways scroll at 360 px + 150% text + high contrast. Fixed h1 focus on first load under StrictMode.
- 2026-10-04 – All frontend screens built (public, candidate, employer, admin, notifications, account) against OpenAPI; 87 Vitest tests; OpenAPI extended for admin lists + dashboards.
- 2026-10-04 – Frontend scaffold done (API client, AuthContext, ProtectedRoute, accessible layout); browser check via Playwright through gateway + Core found and fixed logout→/login redirect race.
- 2026-10-04 – Gateway done (routing, CORS, rate limit, request ID, timeouts, health, /internal blocked); 23 Jest tests; live smoke with Core found and fixed Laravel `*` CORS leak.
- 2026-10-04 – M11 master data done (public lists, admin CRUD, delete-or-retire verified on MySQL). Core part of Phase 1 complete; 59 tests pass.
- 2026-10-04 – M1 auth done (register/login/logout/me/password, `role` + `active` middleware, login throttle); live smoke test on MySQL with demo admin OK. 44 tests pass.
- 2026-10-04 – Users/categories/accommodations migrations, models, factories, seeders done; `migrate:fresh --seed` on local MySQL OK. 21 tests pass.
- 2026-10-04 – User ran DB setup; both service users connect; Core default migrations ran on MySQL. Phase 0 complete.
- 2026-10-04 – Core scaffolded: Laravel 13.34 + Sanctum in `services/core-api`, timezone Asia/Manila, default tests pass (SQLite in-memory). DB creation still waits on the user. Error envelope + request IDs done.
- 2026-10-03 – Phase 0 done except DB creation (user runs SQL). Rule updates applied to skill + SIA doc; docs moved to `docs/`; OpenAPI draft; repo pushed.
- 2026-10-03 – Resolved all pending decisions; copied project to `C:\dev\opendoor`. Continue there.

- 2026-10-03 – Created skills (`opendoor-dev`, `opendoor-sia-docs`, `opendoor-continue`), `CLAUDE.md` and this file. No application code yet.
- 2026-10-02 – Reviewed IPT docs vs SIA template; generated `OpenDoor_SIA1_Final_Project_Documentation.docx` + 5 diagrams (`diagrams/`).
