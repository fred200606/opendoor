// Texts of the Run & Demo Guide (docs/guides/OpenDoor-Run-and-Demo-Guide.pdf). Edit here, then run
// `node guides/build-run-guide.mjs`. HTML is allowed in the strings. Never put a password here:
// the copy with passwords gets them from environment variables at build time.

export const meta = {
  title: 'OpenDoor – Run & Demo Guide',
  subtitle: 'How to start, show, test and explain the running system',
  purpose:
    'For the professor and the team. It starts from a computer where OpenDoor is already installed (the installation steps are in the repository README) and shows how to run every service, which accounts to use, how to present the system, and – click by click – what each screen sends to the backend and what changes in the database.',
  project: 'OpenDoor – PWD job matching by workplace accommodations · SIA 1 and IPT final project · Group 3 – ICARUS, IT31S1',
};

export const production = {
  app: 'https://opendoor-rust.vercel.app',
  gateway: 'https://gateway-production-4e58.up.railway.app',
};

// [component, folder, port, start command, ready when the terminal shows …]
export const services = [
  ['MySQL 8', 'Windows service <code>MySQL80</code>', '3306', '<code>Start-Service MySQL80</code> (admin PowerShell) – usually starts with Windows', '<code>Get-Service MySQL80</code> → <code>Running</code>'],
  ['Business Registry (SOAP)', '<code>services/business-registry-soap</code>', '8003', '<code>php -S 127.0.0.1:8003 -t public</code>', '<code>Development Server (http://127.0.0.1:8003) started</code>'],
  ['Core Service (Laravel)', '<code>services/core-api</code>', '8001', '<code>php artisan serve --host=127.0.0.1 --port=8001</code>', '<code>Server running on [http://127.0.0.1:8001]</code>'],
  ['Insights Service', '<code>services/insights-service</code>', '8002', '<code>npm run dev</code>', '<code>OpenDoor Insights Service listening on http://localhost:8002 …</code>'],
  ['API Gateway', '<code>gateway</code>', '8080', '<code>npm run dev</code>', '<code>OpenDoor gateway listening on http://localhost:8080 (core: …, insights: …)</code>'],
  ['React app (Vite)', '<code>frontend</code>', '5173', '<code>npm run dev</code>', '<code>Local: http://localhost:5173/</code>'],
];

// [email, name, role, use it to show …]
export const accounts = [
  ['admin@opendoor.test', 'OpenDoor Admin', 'Admin', 'Employer verification with the SOAP registry, removing postings, users, reports, feedback moderation, master data, dashboard charts'],
  ['candidate@opendoor.test', 'Maria Santos', 'Candidate (complete profile, 3 needs, résumé on file)', '"Recommended for me" with the match score, job details + Accessibility Snapshot, apply, confirming a hire, saved jobs, applications'],
  ['candidate2@opendoor.test', 'Juan Dela Cruz', 'Candidate (hired 45 days ago at Kalinga Foods)', 'The open accommodation rating form – the 3rd response publishes Kalinga Foods’ trust score'],
  ['employer@opendoor.test', 'Ana Reyes', 'Employer (Bayanihan Tech Solutions, verified)', 'Dashboard, postings, applicants, stages (Under review → Shortlisted → Contacted), reporting a hire, published trust score (79 %)'],
  ['employer2@opendoor.test', 'Ramon Villanueva', 'Employer (Kalinga Foods Inc., waiting for verification on a fresh seed)', 'An employer the admin still has to verify – it can publish its draft job (Packing Line Staff) only once it is verified'],
];

// The ~10-minute presentation. [minutes, who, what to do, what to say]
export const demoScript = [
  ['0:00', 'Guest', 'Open the home page, then <b>Find jobs</b>. Point at the utility bar (text size, high contrast, quiet mode).', 'OpenDoor matches persons with disabilities to jobs by the accommodations a workplace gives, not by disability type.'],
  ['1:00', 'Candidate', 'Log in as <code>candidate@</code>. Dashboard → <b>Find jobs</b> (<b>Recommended for me</b> is on) → open <b>Why this match?</b> on the first card.', 'Maria’s profile (place, skills, education, preferences) and her needs give every open job a match score from 0 to 100; the parts explain it.'],
  ['2:30', 'Candidate', 'Open <b>Data Encoder</b> → <b>Show Workplace Accessibility Snapshot</b>.', 'This is the mashup: the Insights Service combines Core’s posting, PSGC place names, Nominatim coordinates and OpenStreetMap places from Overpass. If a source is down the page still works.'],
  ['3:30', 'Candidate', 'Write a cover note and an interview request → <b>Send application</b>.', 'One request through the gateway; Core checks the profile and the résumé, stores the application and notifies the employer.'],
  ['4:30', 'Employer', 'Log out, log in as <code>employer@</code>. Dashboard → <b>Needs attention</b> → open Maria’s application → <b>Report hiring</b> with a start date.', 'Opening the application marks it Under review. A hire is never one-sided: the employer reports it, Maria has to confirm it.'],
  ['5:30', 'Candidate', 'Log in as <code>candidate@</code> → <b>Notifications</b> → the report → <b>Confirm</b>.', 'Now the application is Hired. 30 days after the start date Maria can rate each promised accommodation – that builds the trust score.'],
  ['6:30', 'Admin', 'Log in as <code>admin@</code>. <b>Employers</b> → Kalinga Foods Inc. → <b>Check with the business registry</b> → <b>Approve</b>.', 'Core calls the legacy SOAP registry (WS-Security) and stores its answer. The admin decides; the registry only advises. Only a verified company can publish jobs – there is no posting approval queue.'],
  ['7:30', 'Anyone', 'Open the employer’s public page (trust score card) and <b>How trust scores work</b>; as admin, show the dashboard charts.', 'Hired employees rate each promised accommodation anonymously; the score shows after 3 responses.'],
  ['8:30', 'Presenter', 'Show DevTools → Network on one click (request, <code>X-Request-ID</code>), and the gateway terminal line with the same id.', 'Every request goes through the gateway; the id follows it through every service and the error envelope.'],
  ['9:30', 'Presenter', 'Run <code>python tests/validate/validate_opendoor.py</code> (or show the CI run on GitHub).', '14 checks: every service is up, the gateway routes correctly and Insights reaches Core with its service key.'],
];

// Explanations of the walkthrough steps (the data comes from capture-walkthrough.mjs).
// key: [method, path regex] of the call(s) to show in full; inside: what happens behind the screen.
export const steps = {
  login: {
    click: 'On <b>Log in</b>, type the email and password and press <b>Log in</b>.',
    key: [['POST', /^\/api\/login$/]],
    inside: [
      'React (<code>LoginPage</code> → <code>AuthContext</code>) sends <code>POST /api/login</code> to the gateway – the only backend address the browser knows (<code>VITE_API_URL</code>).',
      'The gateway adds an <code>X-Request-ID</code>, checks CORS and the rate limit (120 requests per minute per IP) and forwards <code>/api/*</code> to Core unchanged.',
      'Core checks the password hash and that the account is not suspended, then creates a Sanctum token (one row in <code>personal_access_tokens</code>, stored as a SHA-256 hash).',
      'The browser keeps the token and sends it as <code>Authorization: Bearer …</code> on every later call; the dashboard loads with <code>GET /api/candidate/dashboard</code>.',
    ],
    db: 'A new token row for the candidate (user 2). The table holds only a hash of the token – the plain token is shown to the browser once.',
  },
  search: {
    click: 'Open <b>Find jobs</b> (<b>Recommended for me</b> is on for candidates) and open <b>Why this match?</b> on the first card.',
    key: [['GET', /^\/api\/job-postings\?/]],
    inside: [
      '<code>GET /api/job-postings?match=1&amp;sort=best</code> – Core’s <code>MatchingService</code> scores every open posting of a verified company for this candidate: skills 40, location 20, qualifications 15, work preferences 10 and accommodation needs 15 points. A part without data is left out and the rest re-weighted, so the score stays 0–100.',
      'Each posting comes back with <code>match: { score, label, met, total, missing, skills, location, education, experience, preferences }</code> – the parts are what <b>Why this match?</b> lists. The disability type is never used (RA 10173).',
      'Work setup and distance filters (10–100 km between city centres) narrow the list first; the city centres come from the Insights Service when a location is saved.',
      'With <code>npm run dev</code> React’s StrictMode loads each page twice, so DevTools shows every call two times. The built app (Vercel, and these captures) calls once.',
    ],
    db: 'Nothing changes – this is a read. The rows below are what the score uses: the candidate’s profile (skills, education, preferences, place) and needs (<code>candidate_accommodation</code>).',
  },
  snapshot: {
    click: 'Open <b>Data Encoder</b> and press <b>Show Workplace Accessibility Snapshot</b>.',
    key: [['GET', /^\/api\/insights\/job-postings\/\d+$/]],
    inside: [
      'The gateway sends <code>/api/insights/*</code> to the Insights Service (15 s timeout) instead of Core.',
      'Insights asks Core for the posting over the private route <code>GET /internal/job-postings/{id}/summary</code> with its <code>X-Service-Key</code> (service-to-service; the gateway never exposes <code>/internal</code>).',
      'Then PSGC (official place names), Nominatim (coordinates of the address) and Overpass (wheelchair-accessible places nearby). Each answer is cached in the <code>insights_cache</code> database.',
      'The whole snapshot must finish in 12 s. A source that is down or slow is reported in <code>sources</code> as <code>unavailable</code> or <code>stale</code> and the snapshot is still 200 – external services never block hiring.',
    ],
    db: 'Insights owns its own cache tables (database <code>insights_cache</code>); Core’s data is never copied there – Insights only asks Core’s API. The rows below are the cached answers this posting’s snapshot uses: the coordinates of its address (Nominatim, kept 30 days), the accessible places around them (Overpass, 24 h – after that the old copy is only used as <code>stale</code> when Overpass fails) and the PSGC place lists. <code>fetched_at</code> shows when each answer was fetched.',
  },
  apply: {
    click: 'Fill <b>Cover note</b> and <b>Interview accommodation request</b>, then press <b>Send application</b>.',
    key: [['POST', /^\/api\/job-postings\/\d+\/applications$/]],
    inside: [
      'Core checks the role (candidate), that the profile is complete (422 <code>PROFILE_INCOMPLETE</code>) and a résumé is on file (422 <code>RESUME_REQUIRED</code> – the form offers an upload when there is none), that the posting is open and not past its closing date, and that the candidate has not applied already (409 <code>ALREADY_APPLIED</code>).',
      'It stores the application with status <code>pending</code> and notifies the employer (in-app notice, plus an email when the employer has email notifications on).',
    ],
    db: 'A new <code>applications</code> row (status <code>pending</code>) and an <code>application_received</code> notification for the employer’s account.',
  },
  review: {
    click: 'As the employer, open the application (Dashboard → <b>Needs attention</b> or the posting’s applicants → the applicant).',
    key: [['GET', /^\/api\/applications\/\d+$/]],
    inside: [
      'Core’s policy allows the employer to see only applications to their own postings (others get 403). Only through this application does the employer see the candidate’s needs.',
      'The first time the employer opens a <code>pending</code> application Core sets it to <code>reviewed</code> (Under review) and tells the candidate. From here the employer can Shortlist, Mark as contacted or say Not selected – stages only move forward.',
    ],
    db: 'Status <code>pending → reviewed</code>, <code>reviewed_at</code> filled, and a notification for the candidate.',
  },
  report: {
    click: 'In <b>Hiring confirmation</b> press <b>Report hiring</b>, enter the first working day and press <b>Send report</b>.',
    key: [['POST', /^\/api\/applications\/\d+\/hiring-reports$/]],
    inside: [
      '<code>POST /api/applications/{id}/hiring-reports</code> with <code>{"start_date": …}</code>. A hire is never set directly – <code>PATCH …/status</code> with <code>hired</code> is refused (422).',
      'Core checks that the employer owns the posting, that the application is still in progress and that no other report waits for an answer (409 <code>HIRING_REPORT_PENDING</code>). The date may be from the application date up to 365 days ahead.',
      'Nothing about the application changes yet: the report waits for the candidate, who gets a <code>hiring_report</code> notice. A candidate can also report first; then the employer answers.',
    ],
    db: 'A <code>hiring_reports</code> row (<code>pending</code>) with a <code>reported</code> event, and a notification for the candidate. The application keeps its stage.',
  },
  confirm: {
    click: 'As the candidate, open the application (or the notice), press <b>Confirm</b> and confirm in the dialog.',
    key: [['POST', /^\/api\/applications\/\d+\/hiring-reports\/\d+\/response$/]],
    inside: [
      '<code>POST /api/applications/{id}/hiring-reports/{report}/response</code> with <code>{"answer":"confirm"}</code>. Only the other party may answer (the reporter gets 403); the other answers are <b>Not yet</b> (optionally a new start date) and <b>Incorrect</b>.',
      'Under a row lock Core sets the application to <code>hired</code>, <code>hired_at</code> (now) and <code>hire_start_date</code> (the report’s date), and records which accommodations the posting promised (<code>application_accommodation</code>).',
      'The rating opens on calendar day 30 after the start date (Asia/Manila) – the page shows that date, and a daily 08:00 job reminds the candidate once it opens. The ratings build the employer’s trust score, published from 3 responses.',
    ],
    db: 'Status → <code>hired</code>, <code>hired_at</code> and <code>hire_start_date</code> filled, the report <code>confirmed</code> with a <code>confirmed</code> event, the promised accommodations saved, and a notification for the employer.',
  },
  registry: {
    click: 'As the admin, open <b>Employers</b> → <b>Kalinga Foods Inc.</b> → <b>Check with the business registry</b>.',
    key: [['PATCH', /^\/api\/admin\/employers\/\d+\/verify$/]],
    inside: [
      '<code>PATCH /api/admin/employers/{id}/verify</code> with <code>{"action":"check"}</code> (admins only).',
      'Core’s <code>BusinessRegistryClient</code> calls the legacy SOAP 1.1 service <code>VerifyBusinessRegistration</code> with a WS-Security UsernameToken, 5 s timeout. The registry looks the number up in its own SQLite data (a simulated DTI/SEC registry).',
      'Core stores the answer, including the raw XML, in <code>registry_checks</code>. A SOAP fault or a timeout becomes a clear error message; the admin can still decide by hand.',
    ],
    db: 'A new <code>registry_checks</code> row with the registry’s status, registered name and name-match score.',
  },
  verify: {
    click: 'Press <b>Approve</b>.',
    key: [['PATCH', /^\/api\/admin\/employers\/\d+\/verify$/]],
    inside: [
      'Same endpoint with <code>{"action":"approve"}</code>. The employer becomes verified (badge on postings and the public page) and is notified.',
      'There is no separate posting approval: only a verified company can publish, and its postings are visible as soon as they are published (an unverified company’s stay hidden). So from this moment Kalinga Foods can publish its draft <i>Packing Line Staff</i> (shown below) – before, <b>Publish</b> was refused. Administrators can still remove an inappropriate posting with a reason.',
    ],
    db: '<code>employers.verified_at</code> filled, and an <code>employer_verification</code> notification for the employer. Its postings do not change: the draft waits for the employer to publish it, the closed one stays closed.',
  },
};

// [tool, folder, command, what it checks]
export const tests = [
  ['PHPUnit (Core)', '<code>services/core-api</code>', '<code>php artisan test</code>', 'Auth, roles and policies, every module’s endpoints, stages and hiring confirmation, match score, trust score, SOAP client (faults, timeouts), error envelope'],
  ['Jest (gateway)', '<code>gateway</code>', '<code>npm test</code>', 'Routing, CORS, rate limit, request IDs, timeouts and the error envelope when a service is down'],
  ['Jest (Insights)', '<code>services/insights-service</code>', '<code>npm test</code>', 'Snapshot building, caching, budgets and fallbacks when PSGC, Nominatim or Overpass fail'],
  ['Registry runner', '<code>services/business-registry-soap</code>', '<code>php tests/run.php</code>', 'Lookups, name matching, WS-Security and SOAP faults, plus a smoke test on its own port'],
  ['Vitest (React)', '<code>frontend</code>', '<code>npm test</code> (and <code>npm run lint</code>)', 'Pages and components: forms, validation messages, role menus, accessibility behaviour'],
  ['Postman / Newman', 'repo root', '<code>npx newman run tests/postman/OpenDoor.postman_collection.json -e tests/postman/local.postman_environment.json --env-var "demoPassword=…"</code>', 'The SIA test plan (T01–T16) end to end through the gateway: 217 requests, every response checked for status, body, <code>X-Request-ID</code> and time'],
  ['JMeter', '<code>tests/jmeter</code>', '<code>jmeter -n -t opendoor-matching.jmx -Jhost=&lt;gateway host&gt; -l results.jtl -e -o report/run</code>', 'Load (50 users) and stress (100/200 users) on the matching search; needs test data from <code>php artisan load-test:data</code>'],
  ['axe-core / Lighthouse', '<code>tests/a11y</code>', '<code>npm run axe</code> with <code>APP_URL</code> (built app, <code>npm run preview</code> on 4173), <code>API_URL</code>, <code>DEMO_PASSWORD</code>', 'WCAG 2.1 A/AA rules on the main pages of every role'],
  ['Validation script', 'repo root', '<code>python tests/validate/validate_opendoor.py</code>', '14 quick checks of a running stack (section 7)'],
  ['GitHub Actions CI', '<code>.github/workflows/ci.yml</code>', 'runs on every push / pull request', 'All of the above per changed component, then the whole stack in Docker with Newman and axe'],
];

// Last results per tool (local runs on the date given, or the reference runs in the SIA doc).
export const testResults = {
  'PHPUnit (Core)': '506 tests, 2,247 assertions passed – on SQLite and again on MySQL 8 (Oct 23, 2026)',
  'Jest (gateway)': '24 passed (Oct 23, 2026)',
  'Jest (Insights)': '141 passed (Oct 23, 2026)',
  'Registry runner': '39/39 checks passed (Oct 23, 2026)',
  'Vitest (React)': '197 passed (Oct 23, 2026)',
  'Postman / Newman': 'Local, fresh test database: 216 requests / 1,065 assertions / 1 failed – a timing check while both public Overpass servers were down – and T13 15 / 87 / 0 (Oct 23, 2026); production smoke 73 / 389 / 0 (Oct 16, 2026)',
  'JMeter': 'Production, 50 users: P95 204 ms, 0 % errors (Oct 16, 2026) – SIA doc 7.3',
  'axe-core / Lighthouse': 'axe: 0 violations on 33 pages (Oct 23, 2026); Lighthouse 100 on 6 guest pages (Oct 11, before the redesign)',
  'Validation script': '14/14 local (Oct 23, 2026)',
  'GitHub Actions CI': 'All 7 jobs green (run 38493807232, Oct 14 – before the Oct 21–23 changes, which are not pushed yet)',
};

// [check, proves]
export const validatorChecks = [
  ['Core, Insights, registry and its WSDL are up', 'Each service runs; the registry has its data'],
  ['Gateway <code>/api/health</code> shows core and insights <code>up</code>', 'The gateway’s <code>CORE_URL</code> / <code>INSIGHTS_URL</code> are right'],
  ['A sample posting from the search list', 'There is data to test with'],
  ['Core returns it directly, and the same through the gateway', 'The gateway forwards <code>/api/*</code> to Core'],
  ['Unknown posting → 404 <code>NOT_FOUND</code> with <code>request_id</code>', 'The error envelope passes through the gateway'],
  ['<code>/api/me</code> without a token → 401', 'Protected routes need a login'],
  ['Insights snapshot with <code>sources.core = ok</code>, directly and through the gateway', 'Service-to-service: Insights reached Core’s <code>/internal</code> route with the service key'],
  ['Core <code>/internal</code> without the key → 401; gateway <code>/internal</code> → 404', 'Internal routes are protected and never public'],
];

// [problem, cause, fix]
export const troubleshooting = [
  ['A start command says the port is already in use', 'An old terminal or a crashed run still holds it', 'Find and stop the process (see 3.4), or close the old terminal.'],
  ['The app shows "Something went wrong" or every page fails to load', 'The gateway is not running, or Core behind it is down', 'Open <code>http://localhost:8080/api/health</code>: <code>core: down</code> → start Core; no answer → start the gateway.'],
  ['Log in fails with a network error in the browser console (CORS)', 'The app was opened on another address than the gateway allows', 'Open <code>http://localhost:5173</code> (not 127.0.0.1); the gateway allows the origin in <code>CORS_ALLOWED_ORIGIN</code>.'],
  ['Log in says the email or password is wrong', 'The database was seeded with another <code>DEMO_PASSWORD</code>', 'Use the password the database was seeded with (ask the team), or re-seed: <code>php artisan migrate:fresh --seed</code> (deletes local data).'],
  ['Core errors with "SQLSTATE … Connection refused"', 'MySQL is not running', '<code>Start-Service MySQL80</code> in an admin PowerShell.'],
  ['Registry check says the registry is unavailable', 'The SOAP registry (8003) is not running or was started on <code>localhost</code>', 'Start it with <code>php -S 127.0.0.1:8003 -t public</code> (on Windows <code>localhost</code> may bind IPv6 only).'],
  ['The snapshot shows "not available" or no nearby places', 'Overpass or Nominatim (public servers) are busy or offline – the designed fallback', 'Open the job page again after a minute (Insights retries and caches). Before a presentation, open each job page once so the answers are cached.'],
  ['In <code>npm run dev</code> only: the snapshot of a place that is not cached yet shows "not available" after ~20 s', 'React development mode sends the request twice; Chrome waits for the first identical request, so the second one runs out of time when Overpass is slow', 'Open the page again once the first answer is cached, or present from the built app (Vercel or <code>npm run build</code> + <code>npm run preview</code>).'],
  ['Forgot-password email never arrives (local)', 'Reset emails are queued; locally mail goes to the log', 'Run <code>php artisan queue:work database --stop-when-empty</code> in <code>services/core-api</code>; the link is in <code>storage/logs/laravel.log</code>.'],
  ['Production is slow on the first request', 'Railway services were idle', 'Open <code>/api/health</code> on the gateway a few minutes before presenting.'],
  ['Newman: a few requests over 1000 ms locally', '<code>php artisan serve</code> handles one request at a time; or the public Overpass servers are slow, so the second snapshot waits for the first', 'Run again; production and CI (mock external APIs) are the reference for timing.'],
  ['The first request to Core takes several seconds after starting it', 'PHP loads and compiles the framework on the first request', 'Open <code>http://127.0.0.1:8001/up</code> once before testing or presenting.'],
  ['"Complete your profile before you apply" or "Add your résumé"', 'Applying needs a complete profile (place, 3 skills, education, work preferences) and a résumé', 'Use the demo candidates (complete, with a résumé) or finish <b>Profile</b> first; the Apply form offers a résumé upload.'],
  ['A new employer’s job does not appear in search', 'Only verified companies can publish; an unverified company’s postings stay hidden', 'Verify the company as admin (<b>Employers</b> → <b>Check with the business registry</b> → <b>Approve</b>).'],
];
