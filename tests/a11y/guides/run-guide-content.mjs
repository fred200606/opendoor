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
  ['admin@opendoor.test', 'OpenDoor Admin', 'Admin', 'Employer verification with the SOAP registry, posting approval, users, reports, feedback moderation, master data, analytics'],
  ['candidate@opendoor.test', 'Maria Santos', 'Candidate', 'Search with "Matches my needs", job details + Accessibility Snapshot, apply, saved jobs, applications'],
  ['candidate2@opendoor.test', 'Juan Dela Cruz', 'Candidate', 'A hired candidate: the accommodation feedback form (trust score input)'],
  ['employer@opendoor.test', 'Ana Reyes', 'Employer (Bayanihan Tech Solutions, verified)', 'Postings, applicants, status changes (reviewed → hired), published trust score'],
  ['employer2@opendoor.test', 'Ramon Villanueva', 'Employer (Kalinga Foods Inc., waiting for verification on a fresh seed)', 'An employer the admin still has to verify; a posting waiting for approval'],
];

// The ~10-minute presentation. [minutes, who, what to do, what to say]
export const demoScript = [
  ['0:00', 'Guest', 'Open the home page, then <b>Find jobs</b>. Point at the utility bar (text size, high contrast, quiet mode).', 'OpenDoor matches persons with disabilities to jobs by the accommodations a workplace gives, not by disability type.'],
  ['1:00', 'Candidate', 'Log in as <code>candidate@</code>. Dashboard → <b>Find jobs</b>, tick <b>Matches my needs</b>.', 'The candidate saved her needs once; Core ranks every open posting by how many of them it meets.'],
  ['2:30', 'Candidate', 'Open <b>Data Encoder</b> → <b>Show Workplace Accessibility Snapshot</b>.', 'This is the mashup: the Insights Service combines Core’s posting, PSGC place names, Nominatim coordinates and OpenStreetMap places from Overpass. If a source is down the page still works.'],
  ['3:30', 'Candidate', 'Write a cover note and an interview request → <b>Send application</b>.', 'One request through the gateway; Core stores the application and notifies the employer.'],
  ['4:30', 'Employer', 'Log out, log in as <code>employer@</code>. Dashboard → the posting → <b>Applicants</b> → open Maria’s application → <b>Mark as hired</b>.', 'Opening the application marks it reviewed; hiring records the promised accommodations that Maria will rate after 30 days.'],
  ['6:00', 'Admin', 'Log in as <code>admin@</code>. <b>Employers</b> → Kalinga Foods Inc. → <b>Check with the business registry</b> → <b>Approve</b>.', 'Core calls the legacy SOAP registry (WS-Security) and stores its answer. The admin decides; the registry only advises.'],
  ['7:30', 'Admin', '<b>Postings</b> → <b>Approve</b> Packing Line Staff.', 'Only approved postings are visible to candidates.'],
  ['8:00', 'Anyone', 'Open the employer’s public page (trust score card) and <b>How trust scores work</b>.', 'Hired employees rate each promised accommodation anonymously; the score shows after 3 responses.'],
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
    click: 'Open <b>Find jobs</b> and tick <b>Matches my needs</b>.',
    key: [['GET', /^\/api\/job-postings\?/]],
    inside: [
      '<code>GET /api/job-postings?match=1&amp;sort=best</code> – Core reads the candidate’s saved needs and ranks the open, approved postings by how many of them each one offers – full matches first, then newest.',
      'Each posting comes back with <code>match: { met, total, missing }</code>; the disability type is never used for matching (RA 10173).',
      'In development React runs each page load twice (StrictMode), so DevTools shows every call two times. The built app on Vercel calls once.',
    ],
    db: 'Nothing changes – this is a read. The rows below are the candidate’s needs that the match uses (<code>candidate_accommodation</code>).',
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
    db: 'Insights owns its own cache tables (database <code>insights_cache</code>). Core’s data is not copied – Insights only asks Core’s API.',
  },
  apply: {
    click: 'Fill <b>Cover note</b> and <b>Interview accommodation request</b>, then press <b>Send application</b>.',
    key: [['POST', /^\/api\/job-postings\/\d+\/applications$/]],
    inside: [
      'Core checks the role (candidate), that the posting is open and not past its closing date, and that the candidate has not applied already (409 <code>ALREADY_APPLIED</code>).',
      'It stores the application with status <code>pending</code> and notifies the employer (in-app notice, plus an email when the employer has email notifications on).',
    ],
    db: 'A new <code>applications</code> row (status <code>pending</code>) and an <code>application_received</code> notification for the employer’s account.',
  },
  review: {
    click: 'As the employer, open the application (Dashboard → posting → <b>Applicants</b> → the applicant).',
    key: [['GET', /^\/api\/applications\/\d+$/]],
    inside: [
      'Core’s policy allows the employer to see only applications to their own postings (others get 403). Only through this application does the employer see the candidate’s needs.',
      'The first time the employer opens a <code>pending</code> application Core sets it to <code>reviewed</code> and tells the candidate.',
    ],
    db: 'Status <code>pending → reviewed</code>, <code>reviewed_at</code> filled, and a notification for the candidate.',
  },
  hire: {
    click: 'Press <b>Mark as hired</b> and confirm in the dialog.',
    key: [['PATCH', /^\/api\/applications\/\d+\/status$/]],
    inside: [
      '<code>PATCH /api/applications/{id}/status</code> with <code>{"status":"hired"}</code>. Core checks the allowed status workflow (hired and not selected are final).',
      'Core records which accommodations the posting promised (<code>application_accommodation</code>). After 30 days the candidate rates each one – that feedback builds the employer’s trust score.',
    ],
    db: 'Status <code>reviewed → hired</code>, <code>hired_at</code> and <code>hire_confirmed_by</code> filled, the promised accommodations saved, and a notification for the candidate.',
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
    inside: ['Same endpoint with <code>{"action":"approve"}</code>. The employer becomes verified (badge on postings and the public page) and is notified.'],
    db: '<code>employers.verified_at</code> filled, and an <code>employer_verification</code> notification for the employer.',
  },
  approve: {
    click: 'Open <b>Postings</b> (waiting for approval) and press <b>Approve</b> next to Packing Line Staff.',
    key: [['PATCH', /^\/api\/admin\/job-postings\/\d+\/approve$/]],
    inside: [
      '<code>PATCH /api/admin/job-postings/{id}/approve</code> with <code>{"action":"approve"}</code>. The page then reloads the queue.',
      'From now on the posting is in search results and can receive applications.',
    ],
    db: 'Status <code>pending_approval → open</code>, <code>is_approved</code> 0 → 1, and a <code>posting_review</code> notification for the employer.',
  },
};

// [tool, folder, command, what it checks]
export const tests = [
  ['PHPUnit (Core)', '<code>services/core-api</code>', '<code>php artisan test</code>', 'Auth, roles and policies, every module’s endpoints, status workflow, matching, trust score, SOAP client (faults, timeouts), error envelope'],
  ['Jest (gateway)', '<code>gateway</code>', '<code>npm test</code>', 'Routing, CORS, rate limit, request IDs, timeouts and the error envelope when a service is down'],
  ['Jest (Insights)', '<code>services/insights-service</code>', '<code>npm test</code>', 'Snapshot building, caching, budgets and fallbacks when PSGC, Nominatim or Overpass fail'],
  ['Registry runner', '<code>services/business-registry-soap</code>', '<code>php tests/run.php</code>', 'Lookups, name matching, WS-Security and SOAP faults, plus a smoke test on its own port'],
  ['Vitest (React)', '<code>frontend</code>', '<code>npm test</code> (and <code>npm run lint</code>)', 'Pages and components: forms, validation messages, role menus, accessibility behaviour'],
  ['Postman / Newman', 'repo root', '<code>npx newman run tests/postman/OpenDoor.postman_collection.json -e tests/postman/local.postman_environment.json --env-var "demoPassword=…"</code>', 'The SIA test plan (T01–T16) end to end through the gateway: 199 requests, every response checked for status, body, <code>X-Request-ID</code> and time'],
  ['JMeter', '<code>tests/jmeter</code>', '<code>jmeter -n -t opendoor-matching.jmx -Jhost=&lt;gateway host&gt; -l results.jtl -e -o report/run</code>', 'Load (50 users) and stress (100/200 users) on the matching search; needs test data from <code>php artisan load-test:data</code>'],
  ['axe-core / Lighthouse', '<code>tests/a11y</code>', '<code>npm run axe</code> with <code>APP_URL</code> (built app, <code>npm run preview</code> on 4173), <code>API_URL</code>, <code>DEMO_PASSWORD</code>', 'WCAG 2.1 A/AA rules on the main pages of every role'],
  ['Validation script', 'repo root', '<code>python tests/validate/validate_opendoor.py</code>', '14 quick checks of a running stack (section 7)'],
  ['GitHub Actions CI', '<code>.github/workflows/ci.yml</code>', 'runs on every push / pull request', 'All of the above per changed component, then the whole stack in Docker with Newman and axe'],
];

// Last results per tool (local runs on the date given, or the reference runs in the SIA doc).
export const testResults = {
  'PHPUnit (Core)': '372 tests, 1,776 assertions passed (Oct 19, 2026)',
  'Jest (gateway)': '24 passed (Oct 19, 2026)',
  'Jest (Insights)': '135 passed (Oct 19, 2026)',
  'Registry runner': '39/39 checks passed (Oct 19, 2026)',
  'Vitest (React)': '165 passed (Oct 19, 2026)',
  'Postman / Newman': 'CI: 193 requests / 933 assertions / 0 failures; production smoke 73 / 389 / 0 (Oct 16, 2026)',
  'JMeter': 'Production, 50 users: P95 204 ms, 0 % errors (Oct 16, 2026) – SIA doc 7.3',
  'axe-core / Lighthouse': 'axe: 0 violations on 33 pages (CI); Lighthouse 100 on 6 guest pages',
  'Validation script': '14/14 local (Oct 19, 2026)',
  'GitHub Actions CI': 'All 7 jobs green (run 38493807232)',
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
  ['Newman: a few requests over 1000 ms locally', '<code>php artisan serve</code> handles one request at a time', 'Run again; production and CI are the reference for timing.'],
];
