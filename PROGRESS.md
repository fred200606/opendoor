# OpenDoor – Development Progress

> **Single source of truth for "where are we".** Read this before doing anything; update it after every completed step.
> Rules: see `CLAUDE.md` → "Progress protocol". Keep entries short. Newest session log entry on top.

## Now

- **Current phase:** Phase 0 – Setup
- **In progress:** –
- **Next step:** Phase 1 – Core: `composer create-project laravel/laravel` (13.x) into `services/core-api` (keep our `.env.example`), install Sanctum, `APP_TIMEZONE=Asia/Manila`.
- **Blockers:** User must run the DB setup SQL (root password) before Core migrations.

## Pending decisions (ask the user once; record the answer in "Decisions" and remove it here)

- (none)

## Decisions (final – do not re-ask)

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
- [ ] Create MySQL databases `opendoor_core`, `insights_cache` (+ users) – script `docs/setup/create-databases.sql` ready; **user must run it** (root password needed)
- [x] `docs/openapi.yaml` draft from the API contract (Redocly lint: valid)
- [x] GitHub remote created and pushed (private `fred200606/opendoor`, branches `main` + `develop`)

### Phase 1 – Foundation
- [ ] Core: Laravel project + Sanctum + `APP_TIMEZONE=Asia/Manila`
- [ ] Core: error envelope + `ApiException` + request-ID logging
- [ ] Core: users / categories / accommodations migrations + seeders (admin, demo users via `DEMO_PASSWORD`)
- [ ] Core: M1 register / login / logout / me / password + role middleware + login rate limit
- [ ] Core: M11 public lists + admin CRUD (retire instead of delete)
- [ ] Core: feature tests for M1, M11
- [ ] Gateway: routing, CORS, rate limit, X-Request-ID, timeouts, `/api/health`, `/internal` blocked + Jest tests
- [ ] Frontend: fresh React (Vite) app in `frontend/`; Axios client, AuthContext, ProtectedRoute, role redirect
- [ ] Frontend: register + login pages wired through the gateway
- [ ] Postman: folders 01 Auth, 02 Master Data

### Phase 2 – Employer side
- [ ] Core: M3 company profile (+ `registry_type`, `location_psgc`)
- [ ] Core: M4 postings CRUD, structured accommodations with notes, draft → pending_approval → open → closed, soft delete, auto-close command
- [ ] Core: admin posting approval
- [ ] Core: Policies + feature tests (owner-only)
- [ ] Frontend: company profile, my postings, create/edit posting screens wired
- [ ] Postman: folder 03

### Phase 3 – Candidate side
- [ ] Core: M2 profile + accommodation needs + resume upload
- [ ] Core: M5 search, category/accommodation filters, matching (`withCount`, ordering, `missing`), sort, pagination
- [ ] Core: feature tests for matching order and privacy rules
- [ ] Frontend: profile, find jobs (match mode, aria-live count), job details wired
- [ ] Postman: folder 04

### Phase 4 – Applications
- [ ] Core: `ApplicationStatus` enum + `canTransitionTo`; apply / list / details / status endpoints; notifications on change
- [ ] Core: feature tests for every allowed + disallowed transition, duplicate apply, closed posting
- [ ] Frontend: apply (cover note, interview request), my applications, employer applicants + decision screens wired
- [ ] Postman: folder 05

### Phase 5 – Verification (feedback + trust score)
- [ ] Core: feedback form + submit (window, once-only), `TrustScoreService`, observer, publish threshold 3, breakdown
- [ ] Core: feature tests for math, threshold, window
- [ ] Frontend: feedback form, TrustScoreCard on job details / employer page / employer trust-score page
- [ ] Postman: folder 06

### Phase 6 – Legacy SOAP integration
- [ ] Registry: WSDL, SoapServer handler, UsernameToken check, SQLite seed, faults
- [ ] Core: `BusinessRegistryClient`, `registry_checks` table, `PATCH /admin/employers/{id}/verify` (check/approve/reject), fault mapping
- [ ] Tests: faked SoapClient in Core; registry smoke test; `xmllint` WSDL check
- [ ] Frontend: admin employer verification screen shows registry result
- [ ] Postman: folder 08 (registry part)

### Phase 7 – Mashup (Insights)
- [ ] Core: `/internal/job-postings/{id}/summary` + ServiceKey middleware
- [ ] Insights: PSGC locations endpoints + cache + fallback JSON
- [ ] Insights: Nominatim client (throttle 1/s, UA) + cache
- [ ] Insights: Overpass client + cache; tag→category transform; haversine
- [ ] Insights: snapshot endpoint with `sources` flags + Jest/nock tests (each source failing)
- [ ] Gateway: `/api/insights/*` route verified
- [ ] Frontend: Accessibility Snapshot section + PSGC location picker
- [ ] Postman: folder 07

### Phase 8 – Administration
- [ ] Core: M10 users (suspend → revoke tokens), reports, feedback hide
- [ ] Core: M8 dashboards (candidate, employer, admin analytics)
- [ ] Core: M9 notifications list / read / read-all
- [ ] Frontend: admin screens, dashboards, notification bell wired
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

- SIA doc 8.5 now references `docs/setup/create-databases.sql`, registry `seed.php` and `public/` – create these with those exact names.

## Session log (newest first)

- 2026-10-03 – Phase 0 done except DB creation (user runs SQL). Rule updates applied to skill + SIA doc; docs moved to `docs/`; OpenAPI draft; repo pushed.
- 2026-10-03 – Resolved all pending decisions; copied project to `C:\dev\opendoor`. Continue there.

- 2026-10-03 – Created skills (`opendoor-dev`, `opendoor-sia-docs`, `opendoor-continue`), `CLAUDE.md` and this file. No application code yet.
- 2026-10-02 – Reviewed IPT docs vs SIA template; generated `OpenDoor_SIA1_Final_Project_Documentation.docx` + 5 diagrams (`diagrams/`).
