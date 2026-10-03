# Data model

## Core Service – MySQL `opendoor_core`

Accommodations live in one lookup table and are linked to postings, candidate needs and feedback through pivots, so the same vocabulary drives filtering, matching and ratings.

| Table | Fields | Constraints / notes |
|---|---|---|
| users | id, name, email, password, role enum(candidate, employer, admin), is_active bool default true, consented_at timestamp null, display_prefs json null, timestamps | unique email; admins never self-register |
| personal_access_tokens, password_reset_tokens, notifications | Laravel/Sanctum defaults | – |
| candidate_profiles | id, user_id FK unique, headline, skills json, experience text, location_psgc string(10) null, disability_type string null, show_disability bool default false, resume_path null, timestamps | 1:1 with candidate users |
| employers | id, user_id FK unique, company_name, business_reg_no, registry_type enum(DTI, SEC), industry, address, location_psgc null, description null, logo_path null, verified_at null, verification_rejected_reason null, trust_score unsigned tinyint null (whole % 0–100), feedback_count int default 0, timestamps | changing business_reg_no clears verified_at |
| registry_checks | id, employer_id FK, status enum(ACTIVE, EXPIRED, CANCELLED, NOT_FOUND, ERROR), registered_name null, name_match_score decimal(3,2) null, raw_response text null (XML), checked_by FK users, checked_at | stores every SOAP check |
| categories | id, name unique, timestamps | – |
| accommodations | id, name unique, group enum(physical_access, communication, work_arrangement, assistive_technology, support), description null, is_retired bool default false, timestamps | retire instead of delete when used |
| job_postings | id, employer_id FK, category_id FK, title, description, address, location_psgc, employment_type enum(full_time, part_time, contract, internship), work_setup enum(onsite, hybrid, remote), interview_format enum(online, onsite), status enum(draft, pending_approval, open, closed), closes_at date, is_approved bool, rejection_reason null, deleted_at, timestamps | soft deletes; index(status, category_id); fulltext(title, description) |
| job_posting_accommodation | job_posting_id, accommodation_id, note string null | composite PK |
| candidate_accommodation | candidate_profile_id, accommodation_id | composite PK |
| applications | id, job_posting_id, candidate_profile_id, status enum(pending, reviewed, hired, rejected, withdrawn), cover_note null, interview_request null, hired_at null, hire_confirmed_by enum(employer, candidate) null, timestamps | unique(job_posting_id, candidate_profile_id); never hard-deleted |
| feedback | id, application_id unique, comments null, is_hidden bool default false, timestamps | anonymous to employers |
| feedback_items | id, feedback_id, accommodation_id, rating enum(delivered, partial, not_delivered) | unique(feedback_id, accommodation_id) |
| reports | id, reporter_id FK users, job_posting_id, reason, status enum(open, dismissed, actioned), timestamps | – |
| saved_jobs | candidate_profile_id, job_posting_id, timestamps | composite PK |

**Model naming:** use `JobPosting` / `job_postings` (Laravel already uses `jobs` for queues). `ApplicationStatus` is a PHP backed enum cast on `Application`.

**Relationships:** User hasOne CandidateProfile | Employer; Employer hasMany JobPostings, RegistryChecks; JobPosting belongsToMany Accommodation (withPivot note); CandidateProfile belongsToMany Accommodation; JobPosting hasMany Applications; Application hasOne Feedback; Feedback hasMany FeedbackItems.

## Insights Service – MySQL `insights_cache`

| Table | Fields | TTL |
|---|---|---|
| geocode_cache | address_hash PK, query, lat, lon, precision enum(street, city), fetched_at | 30 days |
| overpass_cache | key PK (`lat,lon,radius` rounded to 4 dp), payload json, fetched_at | 24 h |
| psgc_cache | key PK (`regions` / `provinces:{code}` / `cities:{code}`), payload json, fetched_at | 7 days |

## Business Registry – SQLite `registry.db`

`registrations(registration_number PK, registry_type, registered_name, status, date_registered)`, seeded with sample DTI and SEC records that match the demo employers plus a few EXPIRED/CANCELLED ones for negative tests.

All enum values are also listed in SIA doc Appendix F and `docs/openapi.yaml` – keep the three identical.

## Seeders (Core)

- ~10 categories (industries).
- Accommodation types grouped per RA 7277:
  - physical_access: Wheelchair-accessible entrance; Accessible restroom; Elevator or ground-floor workspace; Accessible parking
  - communication: Sign language interpreter; Written or captioned meetings; Screen-reader-compatible work tools
  - work_arrangement: Remote work; Hybrid work; Flexible hours; Part-time schedule; Modified duties
  - assistive_technology: Screen reader software provided; Adjustable workstation; Assistive listening devices
  - support: Job coach or onboarding buddy; Service animal allowed; Transportation assistance
- One admin, demo candidate and employer accounts (passwords from `DEMO_PASSWORD`, never hard-coded), demo postings with real Metro Manila addresses, and enough hired applications + feedback for at least one employer to have a published trust score (≥3 responses).
