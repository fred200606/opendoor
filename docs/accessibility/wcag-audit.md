# OpenDoor – WCAG 2.1 AA accessibility audit

| | |
|---|---|
| Standard | WCAG 2.1, levels A and AA |
| Date | 2026-10-11 |
| Build | `main` at `5be71dd` – production build (`vite build`) served by `vite preview`, local stack with the demo seed |
| Pages | 33 pages for guests, candidates, employers and admins (list below) |
| Status | Automated, scripted and code review done – **no open failures**. Screen-reader test with NVDA still to do (script in section 6). |

## 1. Pages

| Role | Pages |
|---|---|
| Guest | `/` · `/jobs` · `/jobs/3` · `/employers/1` · `/login` · `/register` · `/no-such-page` |
| Candidate | `/candidate/dashboard` · `/candidate/profile` · `/candidate/jobs` · `/candidate/jobs/3` · `/candidate/applications` · `/candidate/saved-jobs` · `/notifications` · `/account` |
| Candidate (hired) | `/candidate/applications/12` · `/candidate/applications/12/feedback` |
| Employer | `/employer/dashboard` · `/employer/company` · `/employer/jobs` · `/employer/jobs/new` · `/employer/jobs/2/edit` · `/employer/jobs/2/applicants` · `/employer/applications/27` · `/employer/trust-score` |
| Admin | `/admin/dashboard` · `/admin/employers` · `/admin/employers/1` · `/admin/job-postings` · `/admin/users` · `/admin/reports` · `/admin/feedback` · `/admin/master-data` |

The first candidate's own application page was skipped (the demo candidate had no application in this run); the same screen was checked for the hired candidate.

## 2. Method and tools

| Layer | Tool | What it covers |
|---|---|---|
| Automated rules | axe-core 4.14.0 in Playwright 1.64 + Chrome 154 (`tests/a11y/axe-pages.mjs`) | All axe rules tagged WCAG 2.0/2.1 A and AA, on all 33 pages. Also runs in the CI integration job on every push. |
| Automated rules (cross-check) | Lighthouse 12.6.1, accessibility category | The 6 guest pages (Lighthouse cannot sign in). |
| Scripted checks | `tests/a11y/wcag-checks.mjs` (Playwright) | What axe cannot decide on its own – see the table in section 3. |
| Code review | Reading the React components and shared form, dialog and status code | Error handling, status messages, time limits, grouping, images, contrast tokens. |
| Screen reader | NVDA + Chrome (by a teammate) | **Not done yet** – section 6. |

Rerun (stack running, frontend served on port 4173, gateway allowing that origin):

```bash
cd tests/a11y && npm ci
DEMO_PASSWORD=… APP_URL=http://localhost:4173 node axe-pages.mjs
DEMO_PASSWORD=… APP_URL=http://localhost:4173 PW_CHANNEL=chrome node wcag-checks.mjs results/run.json
```

Results files go to `tests/a11y/results/` (git-ignored). Run the checker alone: together with Vitest it can exhaust the memory of an 8 GB machine.

## 3. Results

### Automated

- **axe:** 33 pages, **0 violations**.
- **axe in the app's high-contrast mode at 150 % text** (M13 display settings): 33 pages, **0 violations**.
- **Lighthouse accessibility:** **100** on `/`, `/jobs`, `/jobs/3`, `/employers/1`, `/login`, `/register`.

### Scripted checks (`wcag-checks.mjs`, final run: all 33 pages pass)

| Criterion | Check | Result |
|---|---|---|
| 1.3.1 Info and relationships | One `<h1>` per page, no skipped heading levels | Pass |
| 1.3.5 Identify input purpose | Name, email, phone and password fields have `autocomplete` | Pass (fixed – section 4) |
| 1.4.4 Resize text | Root font size 200 %: no clipped text, no sideways scrolling | Pass |
| 1.4.10 Reflow | 320 CSS px wide: the page does not scroll sideways (wide data tables may scroll inside their own box) | Pass (fixed – section 4) |
| 1.4.12 Text spacing | Line height 1.5, letter 0.12 em, word 0.16 em, paragraph 2 em: nothing clipped | Pass |
| 2.1.1 Keyboard · 2.4.3 Focus order | Tab from the top reaches every focusable element in order and leaves the page at the end | Pass |
| 2.4.1 Bypass blocks | First Tab stop is "Skip to main content" and it moves focus into `<main>` | Pass |
| 2.4.2 Page titled | Every page has a title; no two pages one user can open share a title | Pass (fixed – section 4) – 30 distinct titles for 33 pages (repeats only for the same page in the public and candidate area, or for pages of different roles) |
| 2.4.3 | No positive `tabindex` | Pass |
| 2.4.7 Focus visible | Every Tab stop shows an outline or box shadow | Pass |
| 3.1.1 Language of page | `<html lang="en">` | Pass |
| 2.5.8 Target size (WCAG 2.2, advisory) | Targets under 24 × 24 px without enough spacing | 0 found |

### Code review

| Criterion | Finding | Result |
|---|---|---|
| 1.1.1 Non-text content | Company logos have alt text ("Bayanihan Tech Solutions logo"); icons in badges are `aria-hidden` next to text | Pass |
| 1.3.1 Info and relationships | Radio and checkbox groups (work setup, accommodations, feedback ratings, location) use `fieldset` + `legend`; data tables have captions and `scope` | Pass |
| 1.4.1 Use of colour | Status, match and verification badges show text (and an icon), not colour alone | Pass |
| 1.4.3 / 1.4.11 Contrast | Text colours 6.4:1 – 15.8:1 on white; input borders 4.6:1; focus outline 6.6:1 | Pass |
| 2.2.1 Timing adjustable | Login tokens do not expire (Sanctum `expiration: null`), so no form is cut off by a time-out | Pass |
| 3.3.1 / 3.3.3 Error identification and suggestion | Field errors are text, linked with `aria-describedby`, field marked `aria-invalid`; an error summary (`role="alert"`) lists them after a failed submit | Pass |
| 3.3.2 Labels or instructions | Every field has a visible `<label>`; hints linked with `aria-describedby` | Pass |
| 3.3.4 Error prevention | Applications can be withdrawn; withdrawing, confirming a hire, changing an applicant's status, suspending a user, hiding feedback and removing a posting ask for confirmation in a dialog | Pass |
| 4.1.3 Status messages | Save confirmations, errors, loading and result counts are announced from live regions | Pass (fixed – section 4) |

## 4. Fixes made during the audit

| Criterion | Problem | Fix | Commit |
|---|---|---|---|
| 1.4.10 Reflow | The trust-score breakdown table (public employer page, employer's trust score page) made the whole page scroll sideways at 320 px | The table scrolls inside its own region; the region can take keyboard focus (the table has nothing focusable) and is named by the table caption | `8b6560d` |
| 1.3.5 Input purpose | Company name had no `autocomplete` | `autocomplete="organization"`; admin name fields (category, rename, accommodation type) `autocomplete="off"` | `8b6560d` |
| 2.4.2 Page titled | The admin's employer review page had the same title as the public employer page | Title "‹Company› – Employer verification" | `8b6560d` |
| 4.1.3 Status messages | On the 8 paged lists (admin employers, postings, users, reports, feedback; candidate applications; employer postings, applicants) the result count was inside the loaded content, so when a filter left no results it disappeared without an announcement | Shared `ResultCount` region that stays on the page, is cleared while reloading and reads "0 users" (screen readers only, the page shows its empty state) | `5be71dd` |

Earlier runs of the checker were used to debug the checker itself (for example its Tab walk); the results above are from the final run.

## 5. Advisory notes (not failures)

- **"Verified employer" badge:** its explanation ("Business registration checked by OpenDoor") is only a mouse tooltip (`title`). The visible text carries the meaning; consider putting the explanation on the employer page.
- **Date field (posting deadline):** Tab stops on the month, day and year parts of the field. This is Chrome's own date input, not an extra stop added by the app.
- **Coverage limits:** Chrome only; Lighthouse on guest pages only; no mobile screen reader (TalkBack/VoiceOver) test.

## 6. NVDA test script (for a teammate)

**Set-up:** Windows, NVDA (latest), Chrome. Use the demo accounts (`candidate@opendoor.test`, `employer@opendoor.test`, `admin@opendoor.test`; the password is in the team's notes, not in the repo). Turn the monitor off or look away for the main tasks – use only the keyboard and speech.

**NVDA keys:** `Insert` is the NVDA key. `Insert+Space` switches browse/focus mode · `H` / `Shift+H` next/previous heading · `D` next landmark · `F` next form field · `T` next table · `Ctrl+Alt+arrows` move in a table · `Insert+F7` list of links/headings/landmarks · `Insert+T` read the page title · `Insert+Tab` read the focused element.

Record each step as **Pass**, **Problem** (what was heard) or **Blocked**.

| # | Task | Expected |
|---|---|---|
| 1 | Open the home page. Press `Insert+T`, then `Tab` once and `Enter`. | Title "Find work that fits how you work – OpenDoor". First Tab says "Skip to main content, link"; Enter moves into the main content. |
| 2 | Press `Insert+F7` → Landmarks, then Headings. | Banner, navigation, main (and search where there is one); one level-1 heading per page. |
| 3 | Go to Find jobs. Type a keyword in the search field, open the accommodation filter and tick two accommodations. | Each checkbox is read with its group name ("Physical access, grouping") and state. After the results update, NVDA says "‹n› jobs found" without moving focus. |
| 4 | Choose filters that match nothing. | NVDA says "0 jobs found"; the "No jobs match these filters" message is reachable with the arrow keys. |
| 5 | Log in as the candidate with a wrong password, then the right one. | The error is announced and the field is read as "invalid entry" with its message. After login focus starts at the dashboard's heading. |
| 6 | Profile and needs: change one accommodation need and save. | The groups are read as groups; "Your needs are saved." is announced. |
| 7 | Find jobs with "Matches my needs": open the first job with `Enter`. | The match badge is read as text (e.g. "Meets 3 of your 4 needs"). On the job page focus is on the job title heading. |
| 8 | On the job page, read the Accessibility Snapshot section with `H` and the arrow keys. | Plain-language headings; distances read as text ("220 m away"); unavailable parts are explained in words. |
| 9 | Apply to the job, then open My applications and withdraw it. | A confirmation is announced after applying. The withdraw dialog takes focus and is read with its title; `Tab` stays inside it; `Escape` closes it. After withdrawing, focus is on the page and the new status is read. |
| 10 | Log in as the employer. Post a new job: submit the form empty first. | An error summary is announced and lists the problems; each link moves to its field. |
| 11 | Fill the form (category, work setup radio buttons, deadline, accommodations with a note) and submit. | Radio groups and the deadline field are read with their labels; the note field appears after ticking an accommodation and is read with its label. |
| 12 | Open Applicants for a posting, open one applicant and change the status. | The table is read with headers (`Ctrl+Alt+arrows`); the status change is confirmed in a dialog and announced. |
| 13 | Open Your trust score; with `T` go to the breakdown table. | The table is read with its caption and column headers; the scroll region is announced with the caption as its name. |
| 14 | Log in as the admin. Users: filter by a name that does not exist. | NVDA says "0 users" after the search. |
| 15 | Employers: open an employer under review and run the registry check. | "The registry check is done." is announced; the "Business registry result" section reads the result as text (or explains in words when the registry did not respond). |
| 16 | Account settings: set text size 150 % and high contrast, save. | The setting change is announced; the page stays readable and in order. |
| 17 | Open any notification from the notifications link. | The link says how many are unread ("Notifications, 3 unread"); the list is read in order, newest first. |

Report problems to the team with the page, the step number and what NVDA said; fix and rerun the scripted checks (section 2).
