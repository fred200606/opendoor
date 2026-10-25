# OpenDoor

OpenDoor helps persons with disabilities (PWDs) find jobs by the **workplace accommodations** they need, and lets hired PWDs verify, accommodation by accommodation, whether the employer delivered. Employers earn a public **trust score** from that feedback.

Final project for **SIA 1** (Systems Integration and Architecture) and **IPT**. The approved design is in [`docs/OpenDoor_SIA1_Final_Project_Documentation.docx`](docs/OpenDoor_SIA1_Final_Project_Documentation.docx).

**Live:** https://opendoor-rust.vercel.app (API gateway: https://gateway-production-4e58.up.railway.app/api/health)

## Functional modules

All 13 modules of the OpenDoor Modules and Features Specification are built. Roles: **C** candidate (job seeker), **E** employer, **A** administrator, **P** public.

| Module | Who | What it covers |
|---|---|---|
| **M1 Accounts and authentication** | P, all | Sign up as a job seeker or employer (name, email, password of at least 8 characters, data-privacy consent; administrators cannot sign up), log in and out with a Sanctum API token, current user, change password, forgot/reset password by email (60-minute link, signs out everywhere). Login and reset are limited to 5 tries a minute; suspended accounts cannot log in. |
| **M2 Candidate profile** | C | Required profile (skills from the shared list, education, years of experience, preferred work setup and type of work, city from the PSGC picker), accommodation needs, PDF résumé (max 5 MB, opened through a signed 30-minute link) with skill suggestions read from it. Matching uses needs, never the disability itself (RA 10173). |
| **M3 Company profile and verification** | E, A, P | Company profile with logo, registration type and number and PSGC location; public employer page. Administrators check the company against the Business Registry (legacy SOAP service) and approve or reject it – only a verified company can publish jobs. |
| **M4 Job postings** | E, A | Create, edit, close, reopen and delete postings: required skills, qualifications, salary range, responsibilities, benefits, schedule, application requirements, work setup, location and the **workplace accommodations offered**. Drafts for unverified companies; verified companies publish at once; postings close on their deadline. Administrators can remove any posting with a reason. |
| **M5 Job search and matching** | P, C | Live search with filters (category, accommodations, work setup, distance) and sorting. For job seekers: a 0–100 **match score** (skills 40, location 20, qualifications 15, preferences 10, accommodation needs 15) with "Why this match?" and a "Recommended for me" view. |
| **M6 Applications and hiring** | C, E | Apply with a résumé, cover note and interview accommodation request. Stages Submitted → Under review → Shortlisted → Contacted → Hired, plus Not selected, Withdrawn and Job closed. **Hired only by mutual confirmation:** either side reports the hire with a start date and the other side confirms. |
| **M7 Accommodation feedback and trust score** | C, P | From day 30 after the confirmed start date the hired job seeker rates each promised accommodation (delivered / partly / not delivered), anonymously and once. The employer's **trust score** is published after 3 responses, with a per-accommodation breakdown. |
| **M8 Dashboards** | C, E, A | A dashboard per role: applications by stage, pending hire confirmations, items that need attention, recent activity, 12-week charts; administrator analytics (funnel, top needs vs offered accommodations, delivery). Every chart can be shown as a table. |
| **M9 Notifications** | C, E | In-app notices for new applications, application stages, hiring reports, verification results, rating reminders and removed postings; mark one or all as read. Emails are sent through Brevo in production. |
| **M10 Moderation** | A, C | Suspend and reactivate accounts, review job reports from job seekers, remove postings, hide inappropriate feedback. |
| **M11 Master data** | A, P | Job categories, accommodation types (retired instead of deleted when in use) and the shared skills list with aliases. |
| **M12 Saved jobs** | C | Bookmark jobs and see them on one page. |
| **M13 Account settings** | all | Display settings saved with the account (text size, high contrast, reduced motion), notification emails on or off, rating reminder email. |

Beyond the modules: the **Workplace Accessibility Snapshot** on every job page (Insights mashup of PSGC, Nominatim and OpenStreetMap/Overpass data with the employer's promises and the trust score), Read aloud and Voice input, and onboarding for new users (a guided welcome tour and a "Get started" checklist).

### Accounts and security

- **No email verification at sign-up:** a new account can log in right away. Email ownership is proven only when a password reset link is used. Employers are checked separately – a company cannot publish jobs until an administrator has verified it against the Business Registry.
- Passwords are hashed (bcrypt); API tokens are Laravel Sanctum bearer tokens. Each role reaches only its own portal, and every request is authorized again on the server (role middleware and Laravel policies).
- Only the gateway is public: CORS for the frontend's origin only, a rate limit per client, request IDs, and one JSON error format with no stack traces.

## Architecture

```
React SPA (Vercel) ──HTTPS──▶ API Gateway (Node/Express, :8080) ─┬─▶ Core Service (Laravel 13 + MySQL, :8001) ──SOAP──▶ Business Registry (PHP SoapServer, :8003)
                                                                └─▶ Insights Service (Node/Express, :8002) ──▶ Nominatim · Overpass · PSGC
                                                                         └── /internal/* ──▶ Core Service
```

| Folder | Component |
|---|---|
| `frontend/` | React (Vite) SPA – public area and Candidate / Employer / Admin portals |
| `gateway/` | API Gateway – single public entry, routing, CORS, rate limit, request IDs |
| `services/core-api/` | Core Service – auth, profiles, postings, matching, applications, feedback, trust score |
| `services/insights-service/` | Accessibility Insights mashup – Workplace Accessibility Snapshot, PSGC locations |
| `services/business-registry-soap/` | Simulated DTI/SEC registry exposed as a legacy SOAP 1.1 service |
| `tests/postman/`, `tests/jmeter/`, `tests/validate/` | API and load tests; quick service validation script |
| `docs/` | SIA documentation, diagrams, `openapi.yaml`, setup scripts |

## Requirements

PHP 8.4 with Composer, Node.js 22, MySQL 8. Docker is **not** needed for local development (it is only used by CI and the Railway images).

## Local setup

```bash
# 1. Environment files (then fill in the empty values – never commit .env)
cp frontend/.env.example frontend/.env
cp gateway/.env.example gateway/.env
cp services/core-api/.env.example services/core-api/.env
cp services/insights-service/.env.example services/insights-service/.env
cp services/business-registry-soap/.env.example services/business-registry-soap/.env

# 2. Databases (once): replace the CHANGE_ME passwords in a local copy, then
mysql -u root -p < docs/setup/create-databases.sql

# 3. Core Service                         http://localhost:8001
cd services/core-api && composer install && php artisan key:generate
php artisan migrate --seed && php artisan serve --port=8001

# 4. Business Registry (SOAP)             http://localhost:8003/soap?wsdl
cd services/business-registry-soap && php seed.php && php -S 127.0.0.1:8003 -t public  # not "localhost": on Windows it may bind IPv6 only, and Core calls 127.0.0.1

# 5. Insights Service and API Gateway     http://localhost:8002 · http://localhost:8080
cd services/insights-service && npm ci && npm run dev
cd gateway && npm ci && npm run dev

# 6. React client                         http://localhost:5173
cd frontend && npm ci && npm run dev
```

Forgot-password emails are queued (`PASSWORD_RESET_QUEUE=database`, so the response time reveals no account): run `php artisan queue:work database --stop-when-empty` in `services/core-api` to send them, or set `PASSWORD_RESET_QUEUE=sync` in the local `.env`. With the `log` mailer the email (and its link) is written to `storage/logs/laravel.log`.

Shared values that must match:

| Value | Set in |
|---|---|
| `SERVICE_KEY_INSIGHTS` | core-api, insights-service |
| `REGISTRY_SOAP_USER` / `REGISTRY_SOAP_PASSWORD` | core-api, business-registry-soap |

## Tests

```bash
cd services/core-api && php artisan test
cd gateway && npm test
cd services/insights-service && npm test
cd services/business-registry-soap && php tests/run.php
cd frontend && npm run lint && npm test
npx newman run tests/postman/OpenDoor.postman_collection.json -e tests/postman/local.postman_environment.json
python tests/validate/validate_opendoor.py   # running stack: services up, gateway routing, Insights -> Core
```

**CI** (`.github/workflows/ci.yml`, GitHub Actions) runs on every push and pull request to `main`/`develop`:
lint + tests per component (only for the components that changed; Core tests on MySQL 8), then an
integration job that builds the backend images, starts them with `docker-compose.yml` +
`docker-compose.ci.yml` (PSGC, Nominatim and Overpass replaced by `tests/mock-external`), migrates and
seeds Core, and runs the whole Postman collection with Newman (plus T13 with Overpass down) and an
axe-core WCAG 2.1 A/AA check of the built frontend's main pages for every role (`tests/a11y`). The
Newman HTML reports are attached to the run as the `newman-reports` artifact. Secrets for CI are generated per
run; nothing has to be configured in GitHub.

## Deployment

| Part | Where | URL |
|---|---|---|
| React client | Vercel (`frontend/`) | https://opendoor-rust.vercel.app |
| API gateway (the only public backend) | Railway, Singapore | https://gateway-production-4e58.up.railway.app/api |
| Core Service + scheduler, Insights Service, Business Registry, MySQL 8 | Railway private network | – |

Pushing to `main` deploys automatically: Vercel builds the frontend, and Railway rebuilds only the services whose folder changed (Core runs `php artisan migrate --force` before it starts). Secrets exist only as Railway variables. They were all rotated on 25 October 2026 after Railway's security incident.

**Demo accounts** (seeded; ask the team for the password – it is not kept in the repository): `admin@opendoor.test`, `candidate@opendoor.test`, `candidate2@opendoor.test` (a confirmed hire whose rating form is open), `employer@opendoor.test`, `employer2@opendoor.test` (two of the three ratings needed for a trust score).

**Production smoke test** (read-only): `node tests/postman/build-smoke.mjs`, then run `OpenDoor.smoke.postman_collection.json` with `production.postman_environment.json` – see [`tests/postman/README.md`](tests/postman/README.md). Last run on 25 October 2026: 80 requests, 435 assertions, 0 failed.

## Development workflow

- Branches: `main` (deployed), `develop`, `feature/<module>-<desc>`, `fix/<desc>`
- Conventional Commits with the component as scope, e.g. `feat(core): add match ranking`
- Progress is tracked in [`PROGRESS.md`](PROGRESS.md)

## Credits

- The look of the React client (layout, colours, type scale, components) and the briefcase mascot
  are adapted, with his permission, from **Francis Ruzgal**'s
  [opendoor-ipt](https://github.com/ryujiinnn08/opendoor-ipt) ([live](https://opendoor-ipt.ruzgal.org)).
  Routes, API calls, features and tests are OpenDoor's own.
- Map data © OpenStreetMap contributors; location lists from the Philippine Standard Geographic Code (PSGC).
