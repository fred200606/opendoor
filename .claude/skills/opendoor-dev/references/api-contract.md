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
| M1 Auth | GET | /me | any | current user + role |
| M1 Auth | PUT | /me/password | any | `{current_password,password,password_confirmation}` |
| M2 Profile | GET, PUT | /candidate/profile | C | `{headline,skills[],experience,location_psgc,disability_type?,show_disability}` |
| M2 Profile | PUT | /candidate/accommodations | C | `{accommodation_ids:[...]}` replaces needs |
| M2 Profile | POST | /candidate/resume | C | multipart PDF, size-limited |
| M3 Company | GET, PUT | /employer/company | E | `{company_name,business_reg_no,registry_type:'DTI'|'SEC',industry,address,location_psgc,description,logo?}` |
| M3 Company | GET | /employers/{id} | P | public page: company, verified, open postings, trust score |
| M3 Company | PATCH | /admin/employers/{id}/verify | A | `{action:'check'|'approve'|'reject', reason?}` → `{registry:{status,registered_name,name_match,checked_at}, verified_at}` |
| M4 Postings | GET | /employer/job-postings | E | own postings (`?status=`) with `applicants_count` |
| M4 Postings | POST | /job-postings | E | `{title,description,category_id,address,location_psgc,employment_type,work_setup,interview_format,closes_at,accommodations:[{id,note?}],submit:bool}` → 201 |
| M4 Postings | PUT, DELETE | /job-postings/{id} | E owner | update / soft-delete |
| M4 Postings | PATCH | /job-postings/{id}/status | E owner | `{status:'open'|'closed'}` |
| M4 Postings | PATCH | /admin/job-postings/{id}/approve | A | `{action:'approve'|'reject', reason?}` |
| M5 Search | GET | /job-postings | P (match: C) | `?q=&category=&accommodations[]=&match=1&sort=best|newest|closing&page=` |
| M5 Search | GET | /job-postings/{id} | P | details (+ `match` for C) |
| M5/M11 | GET | /categories, /accommodations | P | filter options (accommodations grouped) |
| M6 Applications | POST | /job-postings/{id}/applications | C | `{cover_note?, interview_request?}` → 201 `{id,job_posting_id,status:'pending',created_at}` |
| M6 Applications | GET | /applications, /applications/{id} | C own / E own postings | `?status=&job_posting_id=`; includes `feedback_opens_on` (date) when hired |
| M6 Applications | PATCH | /applications/{id}/status | C / E | `{status:'reviewed'|'hired'|'rejected'|'withdrawn'}` |
| M7 Feedback | GET | /applications/{id}/feedback-form | C (hired) | `{opens_on, is_open, items:[{accommodation_id,name}]}` |
| M7 Feedback | POST | /applications/{id}/feedback | C (hired, ≥30 days) | `{items:[{accommodation_id,rating:'delivered'|'partial'|'not_delivered'}],comments?}` → 201 |
| M7 Feedback | GET | /employers/{id}/trust-score | P | `{published, score, based_on, breakdown:[{accommodation_id,name,delivered,partial,not_delivered,of}]}` |
| M8 Dashboards | GET | /candidate/dashboard, /employer/dashboard, /admin/dashboard | C / E / A | summaries |
| M9 Notifications | GET | /notifications | C, E | list (`meta.unread_count`) |
| M9 Notifications | PATCH | /notifications/{id}/read, /notifications/read-all | C, E | mark read |
| M10 Moderation | GET | /admin/users | A | `?role=&q=` |
| M10 Moderation | PATCH | /admin/users/{id}/suspend | A | `{suspended:bool}` (revokes tokens) |
| M10 Moderation | POST | /job-postings/{id}/reports | C | `{reason}` |
| M10 Moderation | GET, PATCH | /admin/reports, /admin/reports/{id} | A | `?status=`; PATCH `{status:'dismissed'|'actioned', note?}` |
| M10 Moderation | PATCH | /admin/feedback/{id}/hide | A | `{hidden:bool}` hide/unhide a response (recomputes score) |
| M11 Master data | POST, PUT, DELETE | /admin/categories/{id?}, /admin/accommodations/{id?} | A | delete only if unused; accommodations are retired, not deleted, when in use |
| M12 Saved jobs | GET / POST, DELETE | /candidate/saved-jobs, /candidate/saved-jobs/{jobId} | C | bookmarks |
| Insights | GET | /insights/job-postings/{id} | P | Accessibility Snapshot |
| Insights | GET | /insights/locations/{regions|provinces|cities}?parent= | P | `[{code,name,level}]` |
| Internal (Core) | GET | /internal/job-postings/{id}/summary | S | not routed by gateway |

## Key response shapes

Posting in lists/details:
```json
{ "id": 42, "title": "Data Encoder",
  "employer": { "id": 7, "company_name": "Bright Path BPO Inc.", "verified": true },
  "category": { "id": 3, "name": "Administrative" },
  "location": { "psgc_code": "137404000", "label": "Quezon City, NCR" },
  "employment_type": "full_time", "work_setup": "hybrid", "interview_format": "online",
  "closes_at": "2026-11-30",
  "accommodations": [ { "id": 1, "name": "Wheelchair-accessible entrance", "group": "physical_access", "note": "Ramp at main entrance" } ],
  "match": { "met": 4, "total": 5, "missing": [ { "id": 6, "name": "Sign language interpreter" } ] },
  "trust_score": { "published": true, "score": 86, "based_on": 5 } }
```
`match` only for logged-in candidates with saved needs. `trust_score.score` is `null` and `published:false` below 3 responses. List `meta` includes `match_mode: true|false`.

Internal summary (Core → Insights):
```json
{ "id": 42, "address": "123 Quezon Ave.", "psgc_code": "137404000",
  "accommodations": [ { "id": 1, "name": "...", "group": "physical_access" } ],
  "trust_score": { "published": true, "score": 86, "based_on": 5, "breakdown": [ { "accommodation_id": 1, "delivered": 5, "of": 5 } ] } }
```

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
| 400 | BAD_REQUEST | any |
| 401 | UNAUTHENTICATED | Core, Insights (`/internal`) |
| 403 | FORBIDDEN, ACCOUNT_SUSPENDED | Core |
| 404 | NOT_FOUND | Core, Insights, Gateway |
| 409 | ALREADY_APPLIED, FEEDBACK_EXISTS | Core |
| 422 | VALIDATION_FAILED, INVALID_STATUS_TRANSITION, POSTING_CLOSED, FEEDBACK_NOT_OPEN, REGISTRY_INVALID_REQUEST | Core |
| 429 | RATE_LIMITED (with `Retry-After`) | Gateway, Core login |
| 500 | SERVER_ERROR (unexpected error; generic message, no details) | any |
| 502 | REGISTRY_UNAVAILABLE, REGISTRY_AUTH_FAILED, UPSTREAM_ERROR | Core, Gateway |
| 503 | SERVICE_UNAVAILABLE | Gateway |
| 504 | UPSTREAM_TIMEOUT | Gateway |

In Laravel, implement the envelope once in `bootstrap/app.php` (`withExceptions`) and throw a custom `DomainException`-style class carrying `code` + HTTP status for business errors.
