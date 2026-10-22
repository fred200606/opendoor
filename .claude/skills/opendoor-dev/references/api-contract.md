# API contract

Base URL (client): `${VITE_API_URL}` = `{GATEWAY}/api`. JSON only. Protected routes need `Authorization: Bearer <sanctum token>`. Lists are paginated, 12 per page (`?page=`), returning `{ data: [...], meta: { current_page, per_page, total, ... } }`.

Access: P = public, C = candidate, E = employer, A = admin, S = internal service key, any = any logged-in user.
When an endpoint here and `docs/openapi.yaml` disagree, the OpenAPI file wins (it exists since Phase 0 – validate with `npx @redocly/cli lint docs/openapi.yaml`); keep them in sync.

## Endpoints

| Module | Method | Path | Access | Purpose |
|---|---|---|---|---|
| Gateway | GET | /health | P | `{status:'ok'|'degraded', services:{core:'up'|'down', insights:'up'|'down'}}` |
| M1 Auth | POST | /register | P | `{name,email,password,password_confirmation,role:'candidate'|'employer',consent:true}` → 201 `{user, token}` |
| M1 Auth | POST | /login | P | `{email,password}` → 200 `{token, user:{id,name,email,role}}` (rate-limited 5/min) |
| M1 Auth | POST | /logout | any | revoke token → 204 |
| M1 Auth | GET | /me | any | current user + role + `display_prefs` (M13; null until saved) + `email_notifications` (M13; bool, default true) + `onboarding {tour_done, checklist_hidden}` (null for admins) + `profile_complete` (candidates; null for others – decision 2026-10-21) – also in the login/register `user`, not in admin user lists |
| M1 Auth | PUT | /me/password | any | `{current_password,password,password_confirmation}` |
| M1 Auth | POST | /forgot-password | P | `{email}` → always 200 `{message}` (same for every email; added 2026-10-13, beyond the SIA M1 list). Every request only queues `SendPasswordResetLink` (`PASSWORD_RESET_QUEUE`, default `database`, worked by the scheduler every minute) – equal timing for every email; the job emails an active account (security email, ignores the M13 switch) with `{PUBLIC_APP_URL}/reset-password?token=&email=`, valid 60 min, once; 60 s between links per account; limit 5/min per email+IP |
| M1 Auth | POST | /reset-password | P | `{token,email,password,password_confirmation}` → 200 `{message}`, revokes all tokens; wrong/used/expired token or unknown email → 422 `errors.token` (one message); limit 5/min per email+IP |
| M2 Profile | GET, PUT | /candidate/profile | C | `{headline,skills[],experience,education_level,experience_years,preferred_work_setups[],preferred_employment_types[],location_psgc,location_label,disability_type?,show_disability}` + read-only `profile_complete`, `profile_missing[]`; skills stored under list names; GET never 404s (empty profile created on first access) |
| M2 Profile | GET | /candidate/resume/skill-suggestions | C | `{data:{readable, skills[]}}` – list skills found in the stored résumé PDF (smalot/pdfparser, first 10 pages, text never stored) minus the profile's; no résumé → 404 |
| M2 Profile | PUT | /candidate/accommodations | C | `{accommodation_ids:[...]}` replaces needs |
| M2 Profile | POST | /candidate/resume | C | multipart PDF ≤ 5 MB → `{resume_url}` (signed gateway link, 30 min) |
| M2 Profile | GET | /resumes/{id}?expires=&signature= | P (signed) | opens the PDF without a token; tampered/expired → 403 |
| M3 Company | GET, PUT | /employer/company | E | `{company_name,business_reg_no,registry_type:'DTI'|'SEC',industry,address,location_psgc,description,logo?}` |
| M3 Company | GET | /employers/{id} | P | public page: company, verified, open postings, trust score |
| M3 Company | GET | /employers/{id}/logo | P | logo image (PNG/JPG/WebP ≤ 2 MB); `logo_url` built from `PUBLIC_API_URL` |
| M3 Company | PATCH | /admin/employers/{id}/verify | A | `{action:'check'|'approve'|'reject', reason?}` → `{registry:{status,registered_name,name_match,checked_at}, verified_at}` |
| M4 Postings | GET | /employer/job-postings | E | own postings (`?status=`) with `applicants_count` |
| M4 Postings | POST | /job-postings | E | `{title,description,responsibilities?,skills[],education_level?,experience_years?,qualifications?,salary_min?,salary_max?,salary_period?,benefits?,schedule?,application_requirements?,category_id,address,location_psgc,employment_type,work_setup,interview_format,closes_at,accommodations:[{id,note?}],submit:bool}` → 201; `submit:true` publishes at once (open) – verified company only (else 422 `errors.submit`), ≥1 skill (422 `errors.skills`) |
| M4 Postings | PUT, DELETE | /job-postings/{id} | E owner | update / soft-delete |
| M4 Postings | PATCH | /job-postings/{id}/status | E owner | `{status:'open'|'closed'}` |
| M4 Postings | DELETE | /admin/job-postings/{id} | A | `{reason}` required → 204; any status; soft delete (applications kept); employer gets `posting_review` notice with `removed:true`; already removed → 404 |
| M5 Search | GET | /job-postings | P (match, distance: C) | `?q=&category=&accommodations[]=&work_setup[]=&distance=10|25|50|100&match=1&sort=best|newest|closing&page=`; meta `match_mode`, `distance` (applied km or null) |
| M5 Search | GET | /job-postings/{id} | P | details (+ `match` for C) |
| M5/M11 | GET | /categories, /accommodations, /skills | P | filter options (accommodations grouped); skills `[{id,name,aliases[]}]` |
| M6 Applications | POST | /job-postings/{id}/applications | C | `{cover_note?, interview_request?}` → 201 Application (pending); incomplete profile 422 PROFILE_INCOMPLETE, no résumé 422 RESUME_REQUIRED, draft/unpublished 404, closed or past `closes_at` 422 POSTING_CLOSED, duplicate 409 ALREADY_APPLIED |
| M6 Applications | GET | /applications, /applications/{id} | C own / E own postings (others 403) | `?status=&job_posting_id=`; includes `reviewed_at`, `shortlisted_at`, `contacted_at`, `hired_at`, `hire_start_date`, `job_closed`, `hiring_reports` (history with `events`, `can_respond`), `feedback_opens_on` (date, once hired) and `feedback_submitted` (candidate only); employer gets `candidate {name,headline,skills,experience,education_level,experience_years,accommodations,disability_type (only if shown),resume_url}` |
| M6 Applications | PATCH | /applications/{id}/status | C / E | `{status:'reviewed'|'shortlisted'|'contacted'|'rejected'|'withdrawn'}` (workflow in business-rules.md; `hired` → 422) |
| M6 Applications | POST | /applications/{id}/hiring-reports | C / E (party) | `{start_date}` → 201 Application; final 422 INVALID_STATUS_TRANSITION, one pending 409 HIRING_REPORT_PENDING |
| M6 Applications | POST | /applications/{id}/hiring-reports/{reportId}/response | the other party | `{answer:'confirm'|'not_yet'|'incorrect', start_date? (not_yet only)}` → 200 Application; reporter 403, answered 409 HIRING_REPORT_CLOSED |
| M7 Feedback | GET | /applications/{id}/feedback-form | C (hired) | `{opens_on, is_open, submitted, items:[{accommodation_id,name}]}` (items recorded at the confirmed hire; not hired → 422 FEEDBACK_NOT_OPEN) |
| M7 Feedback | POST | /applications/{id}/feedback | C (hired, ≥30 days after the start date) | `{items:[{accommodation_id,rating:'delivered'|'partial'|'not_delivered'}],comments?}` → 201 `{id,application_id,items_rated}`; every form item rated once |
| M7 Feedback | GET | /employers/{id}/trust-score | P | `{published, score, based_on, breakdown:[{accommodation_id,name,delivered,partial,not_delivered,of}]}`; breakdown `[]` until published |
| M8 Dashboards | GET | /candidate/dashboard, /employer/dashboard, /admin/dashboard | C / E / A | summaries (OpenAPI schemas); counts zero-filled per status and equal to the linked lists: employer postings without deleted ones, employer applicants incl. deleted postings, admin analytics without deleted postings, plus admin `analytics` for the charts (`weeks` ×12 Manila weeks: applications/hires/new_accounts, `funnel` submitted→hired with skipped stages counted as passed, `needs` top 6 vs open jobs offering them, `delivery` delivered/partial/not_delivered of non-hidden items – Decision 2026-10-22d); candidate `matching_jobs` = visible postings with all needs (0 without needs), `feedback_due` = hired + unrated, earliest start date first; candidate/employer `pipeline` {submitted, under_review, shortlisted, contacted, hiring_pending, hired, closed} for the stage tiles (job closed counts as closed); employer `attention` {new_applications per open job, hiring_reports by candidates to answer}, `recent_activity` (latest 8: application_received, hiring_<action>; names only) and `weeks` ×12 (applications, hires) – Decision 2026-10-22f |
| M9 Notifications | GET | /notifications | C, E | newest first, 12/page (`meta.unread_count` = all unread); types `application_received`, `application_status_changed`, `hiring_report` (new report → the other party, answers → the reporter), `employer_verification`, `posting_review` (admin removed a posting → employer, with the reason), `feedback_reminder` (daily `feedback:remind` → hired candidate when the feedback form opens); each is also emailed when `email_notifications` is on (M13) |
| M9 Notifications | PATCH | /notifications/{id}/read, /notifications/read-all | C, E | 204; another user's / unknown id → 404; re-read keeps the first `read_at` |
| M10 Moderation | GET | /admin/users | A | `?role=&q=` (name/email); sorted by name |
| M10 Moderation | PATCH | /admin/users/{id}/suspend | A | `{suspended:bool}` → User; suspend revokes all tokens; own account → 422 `errors.suspended` |
| M10 Moderation | POST | /job-postings/{id}/reports | C | `{reason}` (≤ 1000) → 201 Report; visible postings only (else 404); one open report per candidate + posting (422 `errors.reason`) |
| M10 Moderation | GET, PATCH | /admin/reports, /admin/reports/{id} | A | `?status=` (open = oldest first, else newest); PATCH `{status:'dismissed'|'actioned', note?}` only while open (422 `errors.status`); Report adds `note`, `resolved_at` for admins |
| M10 Moderation | PATCH | /admin/feedback/{id}/hide | A | `{hidden:bool}` hide/unhide a response (recomputes score) |
| M11 Master data | POST, PUT, DELETE | /admin/categories/{id?}, /admin/accommodations/{id?} | A | delete only if unused; accommodations are retired, not deleted, when in use |
| M11 Master data | GET | /admin/accommodations | A | all types incl. retired (to restore via PUT `is_retired:false`) |
| M3 Company | GET | /admin/employers, /admin/employers/{id} | A | verification queue `?status=pending|verified|rejected&q=`; AdminEmployer = Company + owner + latest_registry_check |
| M4 Postings | GET | /admin/job-postings | A | every posting, newest first, `?status=` optional (no approval queue since decision 2026-10-21) |
| M10 Moderation | GET | /admin/feedback | A | `?employer_id=&hidden=0|1`; anonymous AdminFeedback (no author) |
| M12 Saved jobs | GET / POST, DELETE | /candidate/saved-jobs, /candidate/saved-jobs/{jobId} | C | bookmarks of visible postings, newest saved first, with `match` and `saved:true`; POST 201 (200 if already saved; hidden → 404); DELETE by id, idempotent → 204 |
| M13 Display settings | PUT | /me/display-prefs | any | `{text_size:'100'|'125'|'150', contrast:'normal'|'high', motion:'normal'|'reduce'}` (all required) → 200 the saved settings; follow the user to other devices |
| M13 Email notifications | PUT | /me/email-notifications | C, E | `{enabled:bool}` → 200 `{enabled}` (admins 403). Emails = notice text + link to `PUBLIC_APP_URL` + path, never needs/disability; sent after the response (`deferred` queue), not to suspended users; mail failures are logged, never fail the action |
| Onboarding | PATCH | /me/onboarding | C, E | `{tour_done?:bool, checklist_hidden?:bool}` (at least one) → 200 `{tour_done, checklist_hidden}` (admins 403). New accounts start false/false: welcome tour after the first sign-in + "Get started" list on the dashboard (steps from the user's own data); existing and demo accounts start as done (decision 2026-10-14) |
| Insights | GET | /insights/job-postings/{id} | P | Accessibility Snapshot |
| Insights | GET | /insights/locations/{regions|provinces|cities}?parent= | P | `[{code,name,level}]` |
| Internal (Core) | GET | /internal/job-postings/{id}/summary | S | not routed by gateway |
| Internal (Insights) | GET | /internal/places/{code} | S | Core → Insights: `{code,city,province,region,province_code,region_code,lat,lon,precision,sources}`; unknown 404, PSGC down 503; not routed by gateway |

## Key response shapes

Posting in lists/details:
```json
{ "id": 42, "title": "Data Encoder",
  "employer": { "id": 7, "company_name": "Bright Path BPO Inc.", "verified": true },
  "category": { "id": 3, "name": "Administrative" },
  "location": { "psgc_code": "1381300000", "label": "Quezon City, National Capital Region (NCR)" },
  "employment_type": "full_time", "work_setup": "hybrid", "interview_format": "online",
  "closes_at": "2026-11-30",
  "accommodations": [ { "id": 1, "name": "Wheelchair-accessible entrance", "group": "physical_access", "note": "Ramp at main entrance" } ],
  "skills": [ "Data entry", "Microsoft Excel" ], "education_level": "senior_high", "experience_years": 1, "qualifications": null,
  "responsibilities": "Encode customer records\nCheck records for errors", "salary": { "min": 18000, "max": 22000, "period": "month", "currency": "PHP" },
  "benefits": "HMO from the first month", "schedule": "Monday to Friday, 9:00 AM to 5:00 PM", "application_requirements": null,
  "match": { "score": 74, "label": "good", "met": 4, "total": 5, "missing": [ { "id": 6, "name": "Sign language interpreter" } ],
             "skills": { "matched": [ "Data entry" ], "missing": [ "Microsoft Excel" ] },
             "location": { "tier": "same_city", "distance_km": 2.4 },
             "education": { "required": "senior_high", "met": true }, "experience": { "required_years": 1, "met": false },
             "preferences": { "work_setup": true, "employment_type": true } },
  "trust_score": { "published": true, "score": 86, "based_on": 5 } }
```
Job details (Decision 2026-10-22e) are optional: `salary` is null when not disclosed (`max` null = a single amount; whole pesos; `salary_min` needs `salary_period`, `salary_max` ≥ `salary_min`), `responsibilities`/`benefits` are one item per line. `match` for logged-in candidates with a profile (on every posting, also with `match=0`; MatchingService, see business-rules.md); `match=1` from anyone else is ignored (`match_mode:false`). `sort=best` = match score (match mode) then newest; `newest`; `closing` = `closes_at` asc; ties by id desc. `accommodations[]` = posting must offer all. Page links (`meta.path`, `links`) point at the gateway. `trust_score.score` is `null` and `published:false` below 3 responses. List `meta` includes `match_mode: true|false`.

Internal summary (Core → Insights):
```json
{ "id": 42, "address": "123 Quezon Ave.", "psgc_code": "1381300000", "location_label": "Quezon City, National Capital Region (NCR)",
  "accommodations": [ { "id": 1, "name": "...", "group": "physical_access" } ],
  "trust_score": { "published": true, "score": 86, "based_on": 5,
    "breakdown": [ { "accommodation_id": 1, "name": "...", "delivered": 4, "partial": 1, "not_delivered": 0, "of": 5 } ] } }
```
Only open + approved, non-deleted postings (else 404); missing/wrong `X-Service-Key` → 401 before the lookup. `breakdown` is `[]` until published (same as the public trust score).

Snapshot shape: see `integrations.md`.

## Error envelope (all services)

```json
{ "error": { "code": "ALREADY_APPLIED", "message": "You have already applied to this posting.", "request_id": "uuid" } }
```
422 validation keeps Laravel's format plus the envelope:
```json
{ "message": "The given data was invalid.", "error": { "code": "VALIDATION_FAILED", "request_id": "uuid" },
  "errors": { "field": [ "message" ] } }
```

| HTTP | Code | Raised by |
|---|---|---|
| 400 | BAD_REQUEST (a malformed JSON body is read as empty → 422 VALIDATION_FAILED) | any |
| 401 | UNAUTHENTICATED | Core, Insights (`/internal`) |
| 403 | FORBIDDEN, ACCOUNT_SUSPENDED | Core |
| 404 | NOT_FOUND | Core, Insights, Gateway |
| 409 | ALREADY_APPLIED, FEEDBACK_EXISTS, HIRING_REPORT_PENDING, HIRING_REPORT_CLOSED | Core |
| 422 | VALIDATION_FAILED, INVALID_STATUS_TRANSITION, POSTING_CLOSED, PROFILE_INCOMPLETE, RESUME_REQUIRED, FEEDBACK_NOT_OPEN, REGISTRY_INVALID_REQUEST | Core (Insights: VALIDATION_FAILED for `parent`) |
| 429 | RATE_LIMITED (with `Retry-After`) | Gateway, Core login |
| 500 | SERVER_ERROR (unexpected error; generic message, no details) | any |
| 502 | REGISTRY_UNAVAILABLE, REGISTRY_AUTH_FAILED, UPSTREAM_ERROR | Core, Gateway |
| 503 | SERVICE_UNAVAILABLE | Gateway, Insights (PSGC list neither cached nor bundled) |
| 504 | UPSTREAM_TIMEOUT | Gateway |

In Laravel, implement the envelope once in `bootstrap/app.php` (`withExceptions`) and throw a custom `DomainException`-style class carrying `code` + HTTP status for business errors.
