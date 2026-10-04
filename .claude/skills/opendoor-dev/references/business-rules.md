# Business rules

These are enforced on the server and covered by feature tests.

## Application status workflow

| From | To | Who | Condition |
|---|---|---|---|
| (none) | pending | Candidate | posting is open + approved, not past `closes_at`, candidate has not applied before |
| pending | reviewed | Employer | happens automatically when the employer opens the application |
| pending / reviewed | withdrawn | Candidate | final |
| reviewed | rejected | Employer | final |
| reviewed | hired | Employer **or** Candidate ("I was hired") | sets `hired_at` and `hire_confirmed_by`; final |

- Anything else → 422 `INVALID_STATUS_TRANSITION`. Status never moves backward.
- Implement in `ApplicationStatus::canTransitionTo(self $to, string $actorRole): bool`.
- Every change notifies the other party (M9).
- Duplicate apply → 409 `ALREADY_APPLIED`; closed posting → 422 `POSTING_CLOSED`.

## Posting lifecycle

`draft → pending_approval → open → closed` (admin approval moves pending_approval → open; reject keeps it out with a reason). Only `open` + approved + not soft-deleted postings appear in search, matching and the Insights snapshot. Postings auto-close after `closes_at` (`postings:close-expired`, daily 00:05 Manila). An employer needs a company profile to post. `submit:true` (create or edit) → `pending_approval` and `is_approved=false` – editing an open posting sends it back for approval; `submit:false` only while still a draft. Owner may close an open posting and reopen a closed one if approved and before `closes_at`. Unpublished postings are 404 for everyone except the owner and admins. Closed postings stop accepting applications. An employer manages only its own postings (JobPostingPolicy).

## Matching ("Matches my needs")

1. Load the candidate's needs.
2. For each open, approved posting, `met` = number of those needs in the posting's accommodations (Eloquent `withCount` on the pivot filtered by the need IDs).
3. Order: full matches first, then by `met` desc, then the requested sort.
4. Apply keyword (title, description, company name), category and extra accommodation filters on top.
5. Guests and candidates with no saved needs see all open postings (`match_mode: false`).
6. `missing` lists the unmet needs by name. Disability type is never used.

## Feedback and trust score

- Only an application with status `hired` can submit feedback, once (409 `FEEDBACK_EXISTS`), and only from **calendar day 30 after the hire date** (422 `FEEDBACK_NOT_OPEN`): `today('Asia/Manila') >= hired_at->timezone('Asia/Manila')->startOfDay()->addDays(30)` – hired on 1 Oct (any time) → opens 31 Oct 00:00 Manila time. `APP_TIMEZONE=Asia/Manila`.
- The form lists the accommodations the posting advertised at the time of hire; one rating per item.
- Values: delivered = 1, partial = 0.5, not_delivered = 0.
- `trust_score = round(sum(values) / count(rated items) * 100)` → a **whole percentage 0–100** (integer, e.g. `86`; PHP `round()` half away from zero) across all non-hidden feedback items for the employer; store on `employers.trust_score` and `feedback_count` (number of non-hidden feedback responses). The API returns an integer, the UI shows `86%`.
- Recalculate in an observer when feedback is saved or hidden/unhidden.
- Publish only when `feedback_count >= 3`; otherwise return `published:false, score:null`.
- Per-accommodation breakdown returns counts (`delivered`, `partial`, `not_delivered`, `of`); if a percentage is shown it uses the same whole-% formula per accommodation ("Sign language interpreter: 1 of 3 delivered").
- Employers never see individual responses or authors.

## Employer verification

- Employer submits `business_reg_no` + `registry_type`. Admin runs `action=check` → Core calls the SOAP registry → stores a `registry_checks` row → returns the result. Highlight to the admin when status ≠ ACTIVE or `name_match < 0.80`.
- Admin decides `approve` (sets `verified_at`, Verified badge) or `reject` (reason). The registry result never auto-approves.
- Registry failure → 502 `REGISTRY_UNAVAILABLE`; the employer stays in the manual review queue.
- Changing `business_reg_no` clears `verified_at`.

## Permissions (Policies)

| Data | Guest | Candidate | Employer | Admin |
|---|---|---|---|---|
| User account | C (register) | R, U own | R, U own | C admins, R all, U suspend |
| Candidate profile + needs | – | C, R, U own | R only via applications to own postings | R |
| Company profile | R public | R public | C, R, U own | R, U verify |
| Job posting | R open | R open | C, R, U, D own | R all, U approve, D |
| Application | – | C, R own, U withdraw/confirm hire | R, U status (own postings) | R |
| Feedback | – | C, R own (once, after hire) | score only | R, U hide |
| Trust score | R (≥3) | R (≥3) | R own | R all |
| Categories / accommodation types | R | R | R | C, R, U, D |
| Reports | – | C | – | R, U |
| Notifications | – | R, U own | R, U own | – |
| Saved jobs | – | C, R, D own | – | – |

## Privacy (RA 10173)

- Registration requires the consent checkbox; store `consented_at` before any accommodation data.
- Disability type optional, hidden by default, never used in matching or shown to employers unless `show_disability`.
- Suspended users cannot log in and their tokens are revoked.
- Never log request bodies containing accommodation needs or feedback.
