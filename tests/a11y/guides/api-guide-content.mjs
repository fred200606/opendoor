// Texts of the API & Integration Guide (docs/guides/OpenDoor-API-and-Integration-Guide.pdf). Edit
// here, then run `node guides/build-api-guide.mjs`. The endpoint reference comes from
// docs/openapi.yaml and the examples from capture-api-examples.mjs; this file holds the prose.

export const meta = {
  title: 'OpenDoor – API & Integration Guide',
  subtitle: 'How the components talk: REST, SOAP, the mashup and the gateway',
  purpose:
    'For the professor and the team. It explains the request path, authentication, every endpoint, the error format, the legacy SOAP integration and the mashup, follows one complete scenario through every component, and ends with the questions we expect at the defense. The examples are real exchanges captured from the running system.',
  project: 'OpenDoor – PWD job matching by workplace accommodations · SIA 1 and IPT final project · Group 3 – ICARUS, IT31S1',
};

export const production = {
  app: 'https://opendoor-rust.vercel.app',
  gateway: 'https://gateway-production-4e58.up.railway.app',
};

// Who may call an operation when the path does not say it (/admin, /candidate, /employer, /internal)
// and the operation is not public. Key: "METHOD path" as in openapi.yaml.
export const who = {
  'POST /logout': 'Signed in',
  'GET /me': 'Signed in',
  'PUT /me/password': 'Signed in',
  'PUT /me/display-prefs': 'Signed in',
  'PUT /me/email-notifications': 'Candidate, Employer',
  'PATCH /me/onboarding': 'Candidate, Employer',
  'GET /job-postings': 'Public (candidate: match)',
  'GET /job-postings/{id}': 'Public (candidate: match)',
  'POST /job-postings': 'Employer',
  'PUT /job-postings/{id}': 'Employer (owner)',
  'DELETE /job-postings/{id}': 'Employer (owner)',
  'PATCH /job-postings/{id}/status': 'Employer (owner)',
  'POST /job-postings/{id}/applications': 'Candidate',
  'GET /applications': 'Candidate (own), Employer (own postings)',
  'GET /applications/{id}': 'Candidate (own), Employer (own postings)',
  'PATCH /applications/{id}/status': 'Candidate, Employer',
  'POST /applications/{id}/hiring-reports': 'Candidate, Employer (of this application)',
  'POST /applications/{id}/hiring-reports/{reportId}/response': 'The other party of the report',
  'GET /applications/{id}/feedback-form': 'Candidate (hired)',
  'POST /applications/{id}/feedback': 'Candidate (hired, day 30+ after the start date)',
  'GET /notifications': 'Candidate, Employer',
  'PATCH /notifications/{id}/read': 'Candidate, Employer',
  'PATCH /notifications/read-all': 'Candidate, Employer',
  'POST /job-postings/{id}/reports': 'Candidate',
};

// [method/path pattern, target, timeout]
export const routing = [
  ['<code>/api/health</code>', 'Gateway itself (pings Core and Insights)', '3 s per service'],
  ['<code>/api/insights/*</code>', 'Insights Service', '15 s'],
  ['<code>/api/*</code> (everything else)', 'Core Service', '10 s'],
  ['<code>/internal/*</code>', 'never routed – 404', '–'],
];

export const basics = [
  ['Base URL', `Local <code>http://localhost:8080/api</code> · production <code>${production.gateway}/api</code>. The React app knows only this address (<code>VITE_API_URL</code>).`],
  ['Format', 'REST over HTTPS, JSON request and response bodies (<code>Content-Type: application/json</code>, <code>Accept: application/json</code>). Résumé and logo uploads use <code>multipart/form-data</code>.'],
  ['Authentication', '<code>POST /api/login</code> returns a Laravel Sanctum token. Send it as <code>Authorization: Bearer &lt;token&gt;</code>. Core checks it on every protected route; the gateway passes the header through unchanged.'],
  ['Roles', '<b>Guest</b> (no token), <b>Candidate</b>, <b>Employer</b>, <b>Admin</b>; service-to-service calls use a service key instead. A wrong role gets 403, no or a revoked token 401.'],
  ['Request ID', 'The gateway gives every request an <code>X-Request-ID</code> (UUID v4, or keeps the caller’s) and passes it to the services. It comes back in the response header and in every error body as <code>request_id</code>.'],
  ['Lists', '12 items per page, <code>?page=</code>; the response has <code>data</code> and <code>meta</code> (current page, last page, total).'],
  ['Dates', 'ISO 8601 with the Manila offset (<code>2026-10-19T23:29:24+08:00</code>); dates without time as <code>YYYY-MM-DD</code>.'],
  ['CORS', 'Only the app’s origin (<code>CORS_ALLOWED_ORIGIN</code>: the Vercel domain in production, <code>http://localhost:5173</code> locally) gets <code>Access-Control-Allow-Origin</code>. The gateway drops any CORS headers the services send, so it alone decides.'],
  ['Rate limits', 'Gateway: 120 requests per minute per IP in production (<code>RATE_LIMIT_PER_MIN</code>; 300 on the local machine for testing) → 429 <code>RATE_LIMITED</code> with <code>Retry-After</code>. Core additionally allows 5 log-in (and 5 password-reset) attempts per minute per email + IP.'],
  ['Contract', 'The full machine-readable contract is <code>docs/openapi.yaml</code> (OpenAPI 3.1). Section 4 is generated from it.'],
];

export const errorCodes = [
  ['400', 'BAD_REQUEST', 'A request Core cannot process (a malformed JSON body is read as empty and gives 422 instead)', 'Core'],
  ['401', 'UNAUTHENTICATED', 'No token, a revoked token, or a wrong service key on <code>/internal</code>', 'Core'],
  ['403', 'FORBIDDEN', 'Signed in, but the role or ownership does not allow it', 'Core'],
  ['403', 'ACCOUNT_SUSPENDED', 'The account was suspended by an admin (log-in refused, tokens revoked)', 'Core'],
  ['404', 'NOT_FOUND', 'Unknown id, a posting that is not visible, or <code>/internal</code> through the gateway', 'Core, Insights, Gateway'],
  ['409', 'ALREADY_APPLIED', 'The candidate applied to this posting before', 'Core'],
  ['409', 'FEEDBACK_EXISTS', 'Feedback for this hire was already sent', 'Core'],
  ['409', 'HIRING_REPORT_PENDING', 'A hiring report for this application is already waiting for an answer', 'Core'],
  ['409', 'HIRING_REPORT_CLOSED', 'The hiring report was already answered or cancelled', 'Core'],
  ['422', 'VALIDATION_FAILED', 'Input rules failed; <code>errors</code> lists the messages per field', 'Core, Insights'],
  ['422', 'INVALID_STATUS_TRANSITION', 'The stage cannot move that way (stages only move forward, e.g. hired → reviewed), or <code>hired</code> is set directly – a hire needs a confirmed hiring report', 'Core'],
  ['422', 'PROFILE_INCOMPLETE', 'Applying without a complete profile (place, at least 3 skills, education, work preferences)', 'Core'],
  ['422', 'RESUME_REQUIRED', 'Applying without a résumé on file', 'Core'],
  ['422', 'POSTING_CLOSED', 'Applying to a closed posting or after its closing date', 'Core'],
  ['422', 'FEEDBACK_NOT_OPEN', 'Feedback before day 30 after the confirmed start date, or the application is not hired', 'Core'],
  ['422', 'REGISTRY_INVALID_REQUEST', 'The SOAP registry refused the input (<code>Client.Validation</code> fault)', 'Core'],
  ['429', 'RATE_LIMITED', 'Too many requests; wait for <code>Retry-After</code> seconds', 'Gateway, Core (log-in)'],
  ['500', 'SERVER_ERROR', 'Unexpected error; generic message, never a stack trace', 'any'],
  ['502', 'REGISTRY_UNAVAILABLE', 'The registry is down, timed out (5 s) or sent a <code>Server</code> fault', 'Core'],
  ['502', 'REGISTRY_AUTH_FAILED', 'The registry refused Core’s WS-Security credentials', 'Core'],
  ['502', 'UPSTREAM_ERROR', 'A service answered with something the gateway could not pass on', 'Gateway'],
  ['503', 'SERVICE_UNAVAILABLE', 'The service behind the gateway cannot be reached (or Insights cannot reach Core)', 'Gateway, Insights'],
  ['504', 'UPSTREAM_TIMEOUT', 'The service did not answer in time (Core 10 s, Insights 15 s)', 'Gateway'],
];

// The examples shown in section 5 (ids from capture-api-examples.mjs), with a one-line reason.
export const errorExamples = [
  ['e401', 'Protected route without a token.'],
  ['e403', 'A candidate calls an admin endpoint.'],
  ['e404', 'A posting id that does not exist.'],
  ['e409', 'The candidate applies to the same posting twice.'],
  ['e422', 'Registration with missing and invalid fields – Laravel’s <code>errors</code> object is kept for the form, plus the envelope.'],
  ['e422-transition', 'The employer tries to move a hired application back to reviewed.'],
  ['e422-hired', 'The employer tries to set <code>hired</code> through the status endpoint – a hire is reported by one side and confirmed by the other.'],
  ['e409-report', 'The candidate reports the hire while the employer’s report still waits for the candidate’s answer.'],
  ['e422-feedback', 'The candidate rates the employer right after confirming the hire – the start date is a week ahead, so the form opens 37 days from now.'],
  ['e422-login', 'Wrong email or password – the same message for both cases, and a suspended account is reported only after a correct password.'],
  ['e429', 'Six log-in attempts in a minute for one email: Core’s log-in limit.'],
  ['down-core', 'Core is not running: the gateway answers for it with the same envelope.'],
];

export const soapFacts = [
  ['Service', 'Simulated DTI/SEC business registry (no public government API exists), PHP <code>SoapServer</code>, SQLite data. Only Core calls it.'],
  ['Contract', 'WSDL at <code>/soap?wsdl</code>, SOAP 1.1, document/literal, namespace <code>urn:opendoor:registry:v1</code>.'],
  ['Operation', '<code>VerifyBusinessRegistration</code>(RegistrationNumber, RegistryType DTI|SEC, BusinessName) → Found, Status (ACTIVE · EXPIRED · CANCELLED · NOT_FOUND), RegisteredName, DateRegistered, NameMatchScore 0–1, CheckedAt.'],
  ['Security', 'WS-Security <code>UsernameToken</code> header (user and password from <code>REGISTRY_SOAP_USER</code> / <code>REGISTRY_SOAP_PASSWORD</code>); the registry never logs the password. In production it is reachable only on Railway’s private network.'],
  ['Faults', '<code>Client.Authentication</code> (credentials), <code>Client.Validation</code> (bad input), <code>Server</code> (internal, generic message).'],
  ['Core side', '<code>BusinessRegistryClient</code> (PHP <code>SoapClient</code>, 5 s timeout) adds the header, stores every answer in <code>registry_checks</code> (with the raw XML) and maps faults to API errors: authentication → 502 <code>REGISTRY_AUTH_FAILED</code>, validation → 422 <code>REGISTRY_INVALID_REQUEST</code>, server fault / timeout / connection error → 502 <code>REGISTRY_UNAVAILABLE</code> (stored as an <code>ERROR</code> check).'],
  ['Decision', 'The result is advice. The admin approves or rejects; status ≠ ACTIVE or a name match below 0.80 is highlighted.'],
];

// [source, what for, call, limits, cache, when it fails]
export const mashupSources = [
  ['Core (internal)', 'The posting: address, PSGC code, accommodations, trust score', '<code>GET /internal/job-postings/{id}/summary</code> + <code>X-Service-Key</code>', '3 s', 'never cached', '404 → snapshot 404; anything else → 503 (the only required source)'],
  ['PSGC API', 'Official place names (region, province, city)', '<code>psgc.gitlab.io/api</code>', 'cooldown 60 s after a failure', '7 days', 'expired copy (<code>stale</code>) → bundled lists → Core’s label'],
  ['Nominatim (OpenStreetMap)', 'Coordinates of the workplace address', '<code>/search?q=…&amp;countrycodes=ph</code>, User-Agent with contact email', '1 request per second (queue), 5 s', '30 days', 'city centre (<code>precision: city</code>) or <code>unavailable</code>'],
  ['Overpass (OpenStreetMap)', 'Wheelchair-accessible places within 500 m', 'Overpass QL <code>around:500</code>, 2 servers (second after 5 s or a failure)', '25 s per server, 60 s cooldown', '24 hours', 'expired copy (<code>stale</code>), else <code>unavailable</code>; background retries after 90 s, 5 min, 15 min'],
];

export const sourceFlags = [
  ['ok', 'Fetched now from the source'],
  ['cached', 'Served from the cache, still fresh'],
  ['stale', 'The source failed; an expired cached copy is shown'],
  ['unavailable', 'The source failed or ran out of the 12 s budget and nothing is cached; that part of the snapshot is empty'],
];

// End-to-end scenario. Participants: B browser, G gateway, C Core, D MySQL, R registry, I Insights, X external APIs.
// Messages: [from, to, label, kind] – kind 'reply' draws a dashed return arrow, 'self' a note on one lane.
export const scenario = [
  {
    id: 'register',
    title: 'Employer registers and fills in the company profile',
    text: 'The employer creates an account (consent required) and enters the business registration number. The company starts unverified.',
    flow: [
      ['B', 'G', 'POST /api/register {role: employer, …}'],
      ['G', 'C', 'forward + X-Request-ID'],
      ['C', 'D', 'INSERT users, personal_access_tokens'],
      ['C', 'B', '201 {token, user}', 'reply'],
      ['B', 'G', 'PUT /api/employer/company {business_reg_no, registry_type, …}'],
      ['G', 'C', 'forward (Bearer token)'],
      ['C', 'D', 'INSERT employers (verified_at NULL)'],
      ['C', 'B', '200 company', 'reply'],
    ],
  },
  {
    id: 'verify',
    title: 'Admin checks the employer with the SOAP registry and approves',
    text: 'Core is the SOAP client. The registry answers from its own data; Core stores the answer and the admin decides.',
    flow: [
      ['B', 'G', 'PATCH /api/admin/employers/{id}/verify {action: check}'],
      ['G', 'C', 'forward'],
      ['C', 'R', 'SOAP VerifyBusinessRegistration + WS-Security'],
      ['R', 'R', 'check credentials, look up SQLite', 'self'],
      ['R', 'C', 'SOAP response (Status, NameMatchScore)', 'reply'],
      ['C', 'D', 'INSERT registry_checks (raw XML)'],
      ['C', 'B', '200 {registry}', 'reply'],
      ['B', 'G', 'PATCH …/verify {action: approve}'],
      ['G', 'C', 'forward'],
      ['C', 'D', 'UPDATE employers.verified_at; INSERT notification'],
      ['C', 'B', '200 {verified_at}', 'reply'],
    ],
  },
  {
    id: 'post',
    title: 'The verified employer publishes a job',
    text: 'There is no approval step: only a verified company can publish, and its posting is visible at once. Core asks Insights for the city-centre point of the place (service key) so that distance searches work; if Insights does not answer in 4 s the posting is still saved and a scheduled job fills the point later.',
    flow: [
      ['B', 'G', 'POST /api/job-postings {…, skills, salary, accommodations, submit: true}'],
      ['G', 'C', 'forward'],
      ['C', 'C', 'company verified? at least one skill?', 'self'],
      ['C', 'D', 'INSERT job_postings (open, approved) + accommodations'],
      ['C', 'I', 'GET /internal/places/{psgc} + X-Service-Key'],
      ['I', 'C', '200 {city, province, region, lat, lon}', 'reply'],
      ['C', 'D', 'UPDATE location_lat/lon, province'],
      ['C', 'B', '201 posting', 'reply'],
    ],
  },
  {
    id: 'match',
    title: 'Candidate finds the job by its match score and opens the snapshot',
    text: 'Matching runs in Core on the candidate’s profile and needs: skills 40, location 20, qualifications 15, work preferences 10, accommodation needs 15 – a score from 0 to 100. The snapshot is the mashup: Insights combines Core’s posting with three public APIs.',
    flow: [
      ['B', 'G', 'GET /api/job-postings?match=1'],
      ['G', 'C', 'forward'],
      ['C', 'D', 'filters in SQL (setup, distance, category, needs offered)'],
      ['C', 'C', 'score each posting: skills, place, qualifications, preferences, needs', 'self'],
      ['C', 'B', '200 postings with match {score, label, parts, met, missing}', 'reply'],
      ['B', 'G', 'GET /api/insights/job-postings/{id}'],
      ['G', 'I', 'forward (15 s)'],
      ['I', 'C', 'GET /internal/job-postings/{id}/summary + X-Service-Key'],
      ['C', 'I', '200 summary', 'reply'],
      ['I', 'X', 'PSGC names → Nominatim coordinates → Overpass places (cache first)'],
      ['X', 'I', 'answers (or timeout → unavailable)', 'reply'],
      ['I', 'B', '200 snapshot + sources flags', 'reply'],
    ],
  },
  {
    id: 'apply',
    title: 'Candidate applies; employer reviews',
    text: 'Applying needs a complete profile and a résumé. Every stage change is checked against the workflow (stages only move forward) and notifies the other side.',
    flow: [
      ['B', 'G', 'POST /api/job-postings/{id}/applications {cover_note, …}'],
      ['G', 'C', 'forward'],
      ['C', 'C', 'profile complete? résumé? posting open? not applied yet?', 'self'],
      ['C', 'D', 'INSERT applications (pending); notification to employer'],
      ['C', 'B', '201 application', 'reply'],
      ['B', 'G', 'GET /api/applications/{id} (as the employer)'],
      ['G', 'C', 'forward'],
      ['C', 'D', 'UPDATE status = reviewed; notification to candidate'],
      ['C', 'B', '200 application', 'reply'],
    ],
  },
  {
    id: 'hire',
    title: 'The hire is reported by one side and confirmed by the other',
    text: 'A hire is never set directly. The employer (or the candidate) reports it with the start date; the other side answers Confirm, Not yet (optionally a new date) or Incorrect. Only Confirm makes the application Hired – the rating opens on day 30 after that start date.',
    flow: [
      ['B', 'G', 'POST /api/applications/{id}/hiring-reports {start_date} (employer)'],
      ['G', 'C', 'forward'],
      ['C', 'D', 'INSERT hiring_reports (pending) + event; notification to candidate'],
      ['C', 'B', '201 application (stage unchanged)', 'reply'],
      ['B', 'G', 'POST …/hiring-reports/{report}/response {answer: confirm} (candidate)'],
      ['G', 'C', 'forward'],
      ['C', 'D', 'row lock; status = hired, hired_at, hire_start_date; application_accommodation'],
      ['C', 'B', '200 application {feedback_opens_on}', 'reply'],
    ],
  },
  {
    id: 'feedback',
    title: 'From day 30 after the start date: feedback builds the trust score',
    text: 'The hired candidate rates each promised accommodation anonymously. An observer recomputes the employer’s score; it is published from 3 responses and then appears on the public page and in the snapshot.',
    flow: [
      ['B', 'G', 'GET /api/applications/{id}/feedback-form'],
      ['G', 'C', 'forward'],
      ['C', 'B', '200 {is_open, items}', 'reply'],
      ['B', 'G', 'POST /api/applications/{id}/feedback {items: [rating…]}'],
      ['G', 'C', 'forward'],
      ['C', 'D', 'INSERT feedback; observer → UPDATE employers.trust_score'],
      ['C', 'B', '201', 'reply'],
      ['B', 'G', 'GET /api/employers/{id}/trust-score'],
      ['G', 'C', 'forward'],
      ['C', 'B', '200 {published, score, breakdown}', 'reply'],
    ],
  },
];

export const participants = [
  ['B', 'Browser (React)'],
  ['G', 'API Gateway'],
  ['C', 'Core Service'],
  ['D', 'MySQL'],
  ['R', 'SOAP Registry'],
  ['I', 'Insights'],
  ['X', 'External APIs'],
];

// [area, what OpenDoor does]
export const security = [
  ['Exposure', 'Only the gateway is public. Core, Insights, the registry and MySQL are on Railway’s private network. <code>/internal/*</code> is never routed (404).'],
  ['Authentication', 'Laravel Sanctum bearer tokens, stored as SHA-256 hashes. Passwords hashed with bcrypt. Log-out deletes the token; a password reset signs the user out everywhere; suspension revokes all tokens. Tokens have no time limit otherwise (Sanctum <code>expiration</code> is not set).'],
  ['Authorization', 'On the server, in three layers: <code>auth:sanctum</code> → role middleware → Laravel Policies (ownership, e.g. an employer sees only applications to their own postings). The React route guards are only navigation.'],
  ['Service-to-service', 'Insights → Core (posting summary) and Core → Insights (city-centre points) with <code>X-Service-Key</code> (compared in constant time); Core → registry with a WS-Security UsernameToken. No service reads another service’s database.'],
  ['Input', 'Validation on every write (Laravel Form Requests): types, lengths, enums, existing ids. Uploads: résumé PDF ≤ 5 MB, logo PNG/JPG/WebP ≤ 2 MB, checked by extension and content type. Search text treats <code>%</code> and <code>_</code> literally; Eloquent uses bound parameters (no SQL injection).'],
  ['Abuse', 'Gateway rate limit per IP; 5 log-in and 5 password-reset attempts per minute per email + IP. Forgot-password always answers the same and only queues a job, so neither the answer nor its timing reveals whether an account exists.'],
  ['Browser', 'CORS only for the app’s origin; the gateway removes <code>X-Powered-By</code> and the services’ own CORS headers. HTTPS everywhere in production (Vercel, Railway).'],
  ['Errors and logs', 'One error envelope with a request id, never a stack trace (<code>APP_DEBUG=false</code> in production). The gateway logs method, path, status and time – never headers or bodies, so tokens, needs and feedback are not logged.'],
  ['Privacy (RA 10173)', 'Consent at registration. Matching uses accommodation needs, never the disability type (optional, hidden by default). Employers see a candidate’s needs only through an application to their own posting. Feedback is anonymous and the score stays hidden until 3 responses. Emails carry no needs or disability details. Résumé text is read only to suggest skills and never stored.'],
  ['Secrets', 'Only in <code>.env</code> files (git-ignored) and Railway/Vercel variables. CI generates its own per run. A gitleaks scan of the whole history found no leaks.'],
];

// Likely questions at the defense. [question, answer]
export const questions = [
  ['Why do you need an API gateway?', 'It is the single public entry: one URL and one CORS rule for the app, rate limiting, request IDs for tracing, timeouts, and the same error format even when a service is down. It also hides the services – in production only the gateway has a public address. It routes by path: <code>/api/insights/*</code> to Insights, everything else under <code>/api</code> to Core.'],
  ['How does a request get from the screen to the database?', 'React calls the gateway (Axios, bearer token). The gateway adds <code>X-Request-ID</code>, checks CORS and the rate limit and proxies to Core. Core authenticates the token (Sanctum), checks the role and the Policy, validates the input, runs the business rule and writes with Eloquent to MySQL, then answers JSON. Section 6 of the Run &amp; Demo Guide shows this with real data.'],
  ['How do the services communicate with each other?', 'REST/JSON between Insights and Core over the private <code>/internal</code> route with a service key; SOAP/XML between Core and the legacy registry with WS-Security; REST/JSON from Insights to the public PSGC, Nominatim and Overpass APIs. Services never share a database.'],
  ['Why SOAP for the registry?', 'The project needs a legacy component, and government business registries are the typical case. There is no public DTI/SEC API, so we built a simulated registry that behaves like one: published WSDL, document/literal SOAP 1.1, WS-Security, SOAP faults. Core integrates it exactly like a real external SOAP service.'],
  ['What happens if the registry is down?', 'Core waits at most 5 s, stores an <code>ERROR</code> check and answers 502 <code>REGISTRY_UNAVAILABLE</code>. The admin sees the message and can still decide by hand. Nothing else in the system depends on the registry.'],
  ['What is your mashup and why is it useful?', 'The Workplace Accessibility Snapshot combines four sources into something none of them has alone: the employer’s promised accommodations and the trust score from hired employees (Core), the official place name (PSGC), the coordinates (Nominatim) and wheelchair-accessible transit, toilets and parking nearby (Overpass/OpenStreetMap).'],
  ['What if an external API fails or is slow?', 'The snapshot still answers 200. Each source is cached (30 days, 24 h, 7 days), a failed source gets a 60 s cooldown, Overpass has a second server, and the whole snapshot has a 12 s budget. What is missing is marked in <code>sources</code> (<code>stale</code> or <code>unavailable</code>) and the page says so. Failed places are retried in the background. Only Core is required.'],
  ['How do you make sure an employer cannot see other employers’ applicants?', 'Laravel Policies on the server. The application query is limited to the employer’s own postings and <code>GET /applications/{id}</code> for anyone else returns 403. The Postman folder “Negative &amp; Security Cases” (T09 plus role, ownership and privacy checks) tests this on every CI run.'],
  ['Do tokens expire?', 'Not by time – Sanctum’s expiration is not set, which is common for SPA tokens. A token ends when the user logs out, resets the password (all tokens) or is suspended (all tokens). They are stored only as hashes. A time limit would be a one-line config change.'],
  ['How do you protect personal data (RA 10173)?', 'Consent at registration; matching by accommodation needs, never by disability type; the disability type is optional and hidden by default; employers see needs only through an application to their own posting; anonymous feedback with the score hidden until 3 responses; no bodies or tokens in logs; no needs in emails.'],
  ['How does the match score work?', 'Core’s <code>MatchingService</code> gives each posting 0–100 points for the signed-in candidate: skills 40 (the posting’s required skills the candidate has, compared through the shared skills list and its aliases), location 20 (remote or same city full, same province 60 %, same region 30 %), qualifications 15 (minimum education and years of experience), work preferences 10 (setup and employment type) and accommodation needs 15 (share of her needs the posting offers). A part without data on either side is left out and the rest re-weighted. Labels: Strong ≥ 80, Good ≥ 60, Fair ≥ 40, else Low. The disability type is never used.'],
  ['How do you know a hire really happened?', 'A hire needs both sides: one reports it with the start date (<code>POST /applications/{id}/hiring-reports</code>), the other confirms it. The employer cannot set <code>hired</code> directly (422), cannot answer its own report (403), and every report and answer is kept as history. Only a confirmed hire can rate the employer, from day 30 after the start date – so an employer cannot collect ratings from people it never hired.'],
  ['How is the trust score calculated?', 'Each rated accommodation counts delivered = 1, partial = 0.5, not delivered = 0. The score is the average × 100, rounded to a whole percent, over all responses that an admin has not hidden. An observer recomputes it whenever feedback is saved or hidden; it is published from 3 responses.'],
  ['How do you trace an error?', 'Every response carries <code>X-Request-ID</code>, also inside every error body. The gateway logs one line per request with that id, and Core and Insights receive it too, so one id finds the request in every log.'],
  ['How did you test the integration?', 'Unit tests per service (PHPUnit – also on MySQL 8 –, Jest, Vitest, the registry runner: 907 tests on October 23); the Postman collection (SIA test plan T01–T16, 217 requests) through the gateway with Newman – in CI with PSGC, Nominatim and Overpass replaced by mock servers, and locally against the live APIs – plus a run with Overpass down (T13); JMeter load and stress tests on production; axe-core for accessibility (33 pages, 0 violations); and a validation script for the running stack.'],
  ['Can someone bypass the gateway and call Core directly?', 'Not in production – Core has no public address. Locally it runs on its own port for development. Even then, every protected route needs a valid token and <code>/internal</code> needs the service key.'],
  ['Why REST/JSON for the main API?', 'The React client works with JSON natively, REST maps cleanly to the resources (postings, applications, feedback), it is stateless (scales behind the gateway) and it is documented in OpenAPI. SOAP is used only where the legacy system requires it.'],
  ['How is it deployed?', 'React on Vercel; gateway, Core, Insights, the registry and MySQL as five Railway services built from Dockerfiles, connected over Railway’s private network. GitHub Actions runs the tests on every push.'],
];
