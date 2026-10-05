# OpenDoor – Development Progress

> **Single source of truth for "where are we".** Read this before doing anything; update it after every completed step.
> Rules: see `CLAUDE.md` → "Progress protocol". Keep entries short. Newest session log entry on top.

## Now

- **Current phase:** Phase 3 – Candidate side
- **In progress:** –
- **Next step:** Phase 3 – Postman folder 04 (Candidate & Search): profile GET/PUT, needs PUT (retired/unknown/duplicate → 422), résumé upload (PDF + non-PDF 422) and signed link (200 / tampered 403), search as guest (match_mode false), candidate `match=1` ranking + `match` on details, filters (q, category, accommodations[] = all), validation 422. Extend `tests/postman/build-collection.mjs`; run the whole collection with Newman.
- **Blockers:** –

## Pending decisions (ask the user once; record the answer in "Decisions" and remove it here)

- (none)

## Decisions (final – do not re-ask)

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
- [ ] Postman: folder 04

### Phase 4 – Applications
- [ ] Core: `ApplicationStatus` enum + `canTransitionTo`; apply / list / details / status endpoints; notifications on change
- [ ] Core: feature tests for every allowed + disallowed transition, duplicate apply, closed posting
- [ ] Frontend: apply (cover note, interview request), my applications, employer applicants + decision screens wired – UI built 2026-10-04 against OpenAPI; tick after a live check with the real endpoints
- [ ] Postman: folder 05

### Phase 5 – Verification (feedback + trust score)
- [ ] Core: feedback form + submit (window, once-only), `TrustScoreService`, observer, publish threshold 3, breakdown
- [ ] Core: feature tests for math, threshold, window
- [ ] Frontend: feedback form, TrustScoreCard on job details / employer page / employer trust-score page – UI built 2026-10-04 against OpenAPI; tick after a live check with the real endpoints
- [ ] Postman: folder 06

### Phase 6 – Legacy SOAP integration
- [ ] Registry: WSDL, SoapServer handler, UsernameToken check, SQLite seed, faults
- [ ] Core: `BusinessRegistryClient`, `registry_checks` table, `PATCH /admin/employers/{id}/verify` (check/approve/reject), fault mapping
- [ ] Tests: faked SoapClient in Core; registry smoke test; `xmllint` WSDL check
- [ ] Frontend: admin employer verification screen shows registry result – UI built 2026-10-04 against OpenAPI; tick after a live check with the real endpoints
- [ ] Postman: folder 08 (registry part)

### Phase 7 – Mashup (Insights)
- [ ] Core: `/internal/job-postings/{id}/summary` + ServiceKey middleware
- [ ] Insights: PSGC locations endpoints + cache + fallback JSON
- [ ] Insights: Nominatim client (throttle 1/s, UA) + cache
- [ ] Insights: Overpass client + cache; tag→category transform; haversine
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

- Paginated lists expose Core's internal URL in `meta.path` / `meta.links` / `links` (e.g. `http://127.0.0.1:8001/api/...`). Frontend only uses the page numbers. Fix before deployment: build paginator paths from `PUBLIC_API_URL` (e.g. `Paginator::currentPathResolver`) or drop the links.
- SIA doc endpoint list needs `GET /resumes/{id}` (signed 30-min résumé link through the gateway) – update with `opendoor-sia-docs`.
- Live checks: the Playwright MCP Chrome window is visible; clicking in it during a scripted check moves the page. Upload test files must be inside the repo (e.g. git-ignored `.playwright-mcp/`).
- Demo employers have `location_psgc = null` – fill real 10-digit PSGC codes in `DemoEmployerSeeder` once the Insights PSGC client exists (Phase 7).
- Railway: Core's local disk is ephemeral – logos/résumés need a Railway volume (or object storage) before production (Phase 9).
- Local Newman: bcrypt requests on Windows `php artisan serve` occasionally exceed the 1000 ms check (single-threaded dev server); rerun before treating as a regression.
- SIA doc needs the frontend-driven contract additions (admin list endpoints, dashboard fields, upload limits) – update endpoint list + Appendix with `opendoor-sia-docs`.
- Frontend assumes: dashboard response shapes (candidate/employer/admin) must be added to OpenAPI (frontend step 8); company logo PNG/JPG/WebP up to 2 MB, sent multipart as POST + `_method=PUT`; owner view of a posting may include `rejection_reason`.
- SIA doc says "React 18" (tech stack table, section 3.x) – change to React 19 with `opendoor-sia-docs`; also mention oxlint instead of ESLint in the testing section.
- Gateway `npm audit`: 3 "high" (braces ← micromatch ← http-proxy-middleware). Not reachable: only our own `pathFilter` functions are used, no globs from requests. npm's "fix" is a downgrade to HPM 0.2.0 – ignore; re-check when HPM updates micromatch.
- SIA doc endpoint list needs the new `GET /admin/accommodations` (admin list incl. retired) – update with `opendoor-sia-docs`.
- Demo seed data still missing: hired applications + ≥3 feedback for one employer (Phase 5). Add to `DatabaseSeeder` in those phases.
- SIA doc error-code table needs the new `SERVER_ERROR` (500) row – update with `opendoor-sia-docs`.
- SIA doc 8.5 now references `docs/setup/create-databases.sql`, registry `seed.php` and `public/` – create these with those exact names.

## Session log (newest first)

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
