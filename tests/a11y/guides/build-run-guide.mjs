// Builds docs/guides/OpenDoor-Run-and-Demo-Guide.pdf from run-guide-content.mjs and the walkthrough
// that capture-walkthrough.mjs saved in tests/a11y/results/guides/walkthrough/ (HTML printed to PDF
// by Chrome).
//   node guides/build-run-guide.mjs
//
// The committed PDF names no passwords ("ask the team"). For the copy with passwords set
// PROD_DEMO_PASSWORD and/or LOCAL_DEMO_PASSWORD: the PDF then goes to docs/guides/private/
// (git-ignored) instead, and the committed PDF is not touched.

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import * as C from './run-guide-content.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const CAPTURE = join(HERE, '..', 'results', 'guides', 'walkthrough');
const OUT = join(HERE, '..', 'results', 'guides');
const passwords = { production: process.env.PROD_DEMO_PASSWORD || null, local: process.env.LOCAL_DEMO_PASSWORD || null };
const withPasswords = Boolean(passwords.production || passwords.local);
const PDF = withPasswords
  ? join(REPO, 'docs', 'guides', 'private', 'OpenDoor-Run-and-Demo-Guide-with-passwords.pdf')
  : join(REPO, 'docs', 'guides', 'OpenDoor-Run-and-Demo-Guide.pdf');

const walkthrough = JSON.parse(readFileSync(join(CAPTURE, 'walkthrough.json'), 'utf8'));
const validateOutput = existsSync(join(CAPTURE, 'validate.txt')) ? readFileSync(join(CAPTURE, 'validate.txt'), 'utf8').trim() : null;
const commit = execSync('git rev-parse --short HEAD', { cwd: REPO }).toString().trim();
const dateOf = (iso) => new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', dateStyle: 'long' }).format(new Date(iso));
const generated = dateOf(new Date().toISOString());
const captured = dateOf(walkthrough.generated_at);

// ------------------------------------------------------------------ helpers

const esc = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const list = (items) => (items?.length ? `<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>` : '');
const pre = (text, className = '') => `<pre class="${className}">${esc(text)}</pre>`;

function trimLines(text, max) {
  const lines = text.split('\n');
  return lines.length <= max ? text : `${lines.slice(0, max).join('\n')}\n… (${lines.length - max} more lines)`;
}

function table(result, caption) {
  if (!result) return '';
  const body = result.rows.length
    ? result.rows.map((row) => `<tr>${row.map((value) => `<td>${esc(value)}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${result.columns.length}" class="empty">(no rows)</td></tr>`;
  return `<div class="dbtable">${caption ? `<div class="dbtable__caption">${caption}</div>` : ''}<code class="sql">${esc(result.sql)}</code>
    <table class="grid small"><thead><tr>${result.columns.map((column) => `<th>${esc(column)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`;
}

/** A database snapshot is one query result or an object of named results. */
function dbSnapshot(snapshot, label) {
  if (!snapshot) return '';
  if (snapshot.sql) return table(snapshot, label);
  return Object.entries(snapshot)
    .map(([name, result]) => table(result, `${label} – ${name}`))
    .join('');
}

const shot = (file, caption) => `<figure class="shot"><img src="walkthrough/shots/${file}" alt=""><figcaption>${caption}</figcaption></figure>`;

// ------------------------------------------------------------------ walkthrough

const shotCaptions = {
  'login-form': 'The login form, filled in',
  'login-dashboard': 'After Log in: the candidate dashboard',
  'search-match': 'Find jobs with “Matches my needs” ticked',
  'job-details': 'Job details',
  'job-snapshot': 'The Workplace Accessibility Snapshot opened',
  'apply-form': 'The application form, filled in',
  'apply-done': 'After Send application',
  'review-application': 'The employer’s view of the application',
  'hire-confirm': 'The confirmation dialog',
  'hire-done': 'After Mark as hired',
  'registry-before': 'The employer waiting for verification',
  'registry-result': 'The registry result after the check',
  'verify-done': 'After Approve',
  'approve-queue': 'Postings waiting for approval',
  'approve-done': 'After Approve',
};

function keyCalls(step, text) {
  const calls = step.calls.filter((call) => text.key.some(([method, pattern]) => call.method === method && pattern.test(call.url)));
  // StrictMode sends GETs twice in development; one is enough.
  const seen = new Set();
  return calls.filter((call) => {
    const id = `${call.method} ${call.url}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function otherCalls(step, keys) {
  const keyIds = new Set(keys.map((call) => `${call.method} ${call.url}`));
  const names = [...new Set(step.calls.map((call) => `${call.method} ${call.url}`))].filter((id) => !keyIds.has(id));
  return names.length ? `<p class="note">Also on this screen: ${names.map((name) => `<code>${esc(name)}</code>`).join(', ')} (page data: user, notifications, lists).</p>` : '';
}

function callBlock(call) {
  const head = [
    `${call.method} ${call.full_url}`,
    `Status: ${call.status}`,
    `X-Request-ID: ${call.request_id ?? '–'}`,
    ...(call.authorization ? [`Authorization: ${call.authorization}`] : []),
  ].join('\n');
  return `<div class="call">
    <div class="label">Request (DevTools → Network → Headers / Payload)</div>
    ${pre(call.request_body ? `${head}\n\n${call.request_body}` : head, 'code')}
    ${call.response_body ? `<div class="label">Response (DevTools → Response)</div>${pre(trimLines(call.response_body, 34), 'code')}` : ''}
  </div>`;
}

function logBlock(step, keys) {
  const ids = new Set(keys.map((call) => call.request_id));
  const paths = keys.map((call) => call.url.split('?')[0]);
  const parts = [];
  const gateway = (step.logs.gateway ?? []).filter((line) => [...ids].some((id) => id && line.includes(id)));
  if (gateway.length) parts.push(['Gateway terminal (one JSON line per request, no headers or bodies)', gateway]);
  const core = (step.logs.core ?? []).filter((line) => paths.some((path) => line.endsWith(` ${path}`)) || line.includes('/internal/'));
  if (core.length) parts.push(['Core terminal', [...new Set(core.map((line) => line.replace(/^\[[^\]]+\] 127\.0\.0\.1:\d+ /, '')))].map((line) => line)]);
  const insights = step.logs.insights ?? [];
  if (insights.length) parts.push(['Insights terminal', insights]);
  const registry = step.logs.registry ?? [];
  if (registry.length) parts.push(['Business Registry terminal', registry.map((line) => line.replace(/^\[[^\]]+\] 127\.0\.0\.1:\d+ /, ''))]);
  if (!parts.length) return '';
  return `<div class="label">Service logs (the terminals)</div>${parts.map(([title, lines]) => `<p class="logtitle">${title}</p>${pre(lines.join('\n'), 'code log')}`).join('')}`;
}

let stepNo = 0;
const walkSteps = walkthrough.steps
  .map((step) => {
    const text = C.steps[step.id];
    if (!text) throw new Error(`No text for walkthrough step "${step.id}"`);
    stepNo += 1;
    const keys = keyCalls(step, text);
    const soap =
      step.id === 'registry' && walkthrough.soap
        ? `<div class="label">The SOAP messages between Core and the registry</div>
           <p class="note">Not visible in the browser – Core sends them server to server. Same envelope as Core’s client; the WS-Security user name and password are hidden here.</p>
           ${pre(walkthrough.soap.request, 'code xml')}${pre(walkthrough.soap.response, 'code xml')}`
        : '';
    return `<section class="step" id="step-${step.id}">
      <h2><span class="no">6.${stepNo}</span>${step.title} <span class="role">${step.role}</span></h2>
      <p><b>In the UI:</b> ${text.click}</p>
      ${step.shots.map((file) => shot(file, shotCaptions[file.replace(/\.jpg$/, '')] ?? '')).join('')}
      <div class="label">What happens behind the screen</div>
      ${list(text.inside)}
      ${keys.map(callBlock).join('')}
      ${otherCalls(step, keys)}
      ${soap}
      ${logBlock(step, keys)}
      <div class="label">Database</div>
      <p>${text.db}</p>
      ${step.db_before && step.db_after ? `${dbSnapshot(step.db_before, 'Before')}${dbSnapshot(step.db_after, 'After')}` : dbSnapshot(step.db_before ?? step.db_after, step.db_after ? 'After' : 'Read by this step')}
    </section>`;
  })
  .join('');

// ------------------------------------------------------------------ sections

const toc = [
  ['about', '1', 'About this guide'],
  ['glance', '2', 'The system at a glance'],
  ['run', '3', 'Starting and stopping'],
  ['accounts', '4', 'Addresses and demo accounts'],
  ['demo', '5', 'Presentation demo script (about 10 minutes)'],
  ['walkthrough', '6', 'UI ↔ backend walkthrough'],
  ...walkthrough.steps.map((step, index) => [`step-${step.id}`, `6.${index + 1}`, step.title, true]),
  ['validate', '7', 'Validation script'],
  ['tests', '8', 'Testing tools'],
  ['trouble', '9', 'Troubleshooting'],
  ['rebuild', 'A', 'Rebuilding this guide'],
];

const cover = `<section class="cover">
  <div class="cover__band"><span class="cover__brand">OpenDoor</span><span class="cover__kind">Run &amp; Demo Guide</span></div>
  <h1 class="cover__title">Run &amp; Demo Guide</h1>
  <div class="cover__subtitle">${C.meta.subtitle}</div>
  <p class="cover__purpose">${C.meta.purpose}</p>
  <table class="cover__meta">
    <tr><th>Live system</th><td><a href="${C.production.app}">${C.production.app}</a></td></tr>
    <tr><th>API gateway</th><td><code>${C.production.gateway}</code></td></tr>
    <tr><th>Walkthrough</th><td>Captured ${captured} on a local, freshly seeded stack</td></tr>
    <tr><th>Version</th><td>${generated} · commit <code>${commit}</code>${withPasswords ? ' · <b>copy with passwords – do not share outside the team and the professor</b>' : ''}</td></tr>
  </table>
  <div class="cover__project">${C.meta.project}</div>
</section>`;

const contents = `<section class="toc"><h1>Contents</h1><ul class="toc__list">${toc
  .map(([id, no, title, sub]) => `<li class="${sub ? 'toc__sub' : 'toc__main'}"><a href="#${id}"><span class="toc__no">${no}</span>${title}</a></li>`)
  .join('')}</ul></section>`;

const about = `<section class="chapter" id="about">
  <h1><span class="no">1</span>About this guide</h1>
  <p class="lead">Everything needed to run OpenDoor on a prepared computer, present it, and explain what happens between the screen and the database.</p>
  ${list([
    '<b>Not covered:</b> installing PHP, Node.js, MySQL, the packages, the <code>.env</code> files and the databases. Those steps are in the repository <code>README.md</code>; this guide assumes they are done.',
    '<b>Sections 3–5</b> are for running and presenting. <b>Section 6</b> follows nine clicks through the whole system with the real requests, responses, log lines and database rows, captured from the running system.',
    '<b>Secrets:</b> passwords, tokens, the service key and the SOAP credentials are never printed. Where one appears it is replaced by <code>•••••• (hidden)</code>.',
    `<b>Production:</b> React on Vercel (<a href="${C.production.app}">${C.production.app}</a>); gateway, services and MySQL on Railway (Singapore). Only the gateway is public.`,
  ])}
</section>`;

const diagram = `<svg class="diagram" viewBox="0 0 720 250" role="img" aria-label="Request path: browser to gateway to Core, Insights and the SOAP registry">
  <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#47306f"/></marker></defs>
  <g font-family="Segoe UI, Arial, sans-serif" font-size="12" fill="#1f2328">
    <rect x="10" y="95" width="120" height="60" rx="8" fill="#f3effa" stroke="#6a4c9c"/><text x="70" y="120" text-anchor="middle" font-weight="700">React app</text><text x="70" y="138" text-anchor="middle" font-size="10.5">:5173 · Vercel</text>
    <rect x="185" y="95" width="130" height="60" rx="8" fill="#6a4c9c"/><text x="250" y="120" text-anchor="middle" font-weight="700" fill="#fff">API Gateway</text><text x="250" y="138" text-anchor="middle" font-size="10.5" fill="#fff">Express :8080</text>
    <rect x="375" y="25" width="150" height="60" rx="8" fill="#f3effa" stroke="#6a4c9c"/><text x="450" y="50" text-anchor="middle" font-weight="700">Core Service</text><text x="450" y="68" text-anchor="middle" font-size="10.5">Laravel :8001</text>
    <rect x="375" y="165" width="150" height="60" rx="8" fill="#f3effa" stroke="#6a4c9c"/><text x="450" y="190" text-anchor="middle" font-weight="700">Insights Service</text><text x="450" y="208" text-anchor="middle" font-size="10.5">Express :8002</text>
    <rect x="580" y="25" width="130" height="60" rx="8" fill="#fff8e6" stroke="#9a6700"/><text x="645" y="50" text-anchor="middle" font-weight="700">Business Registry</text><text x="645" y="68" text-anchor="middle" font-size="10.5">SOAP 1.1 :8003</text>
    <rect x="580" y="165" width="130" height="60" rx="8" fill="#effaf3" stroke="#1a7f37"/><text x="645" y="185" text-anchor="middle" font-weight="700">PSGC · Nominatim</text><text x="645" y="203" text-anchor="middle" font-weight="700">Overpass</text><text x="645" y="218" text-anchor="middle" font-size="10">public REST APIs</text>
    <rect x="430" y="103" width="130" height="44" rx="6" fill="#fff" stroke="#8a939c" stroke-dasharray="4 3"/><text x="495" y="121" text-anchor="middle" font-size="10.5">MySQL :3306</text><text x="495" y="137" text-anchor="middle" font-size="8.5">opendoor_core · insights_cache</text>
    <g stroke="#47306f" stroke-width="1.6" fill="none" marker-end="url(#arrow)">
      <path d="M130 125 H183"/><path d="M315 115 L373 62"/><path d="M315 135 L373 188"/><path d="M525 55 H578"/><path d="M525 195 H578"/><path d="M395 165 L395 87"/>
    </g>
    <g stroke="#8a939c" stroke-width="1.2" fill="none" stroke-dasharray="3 2">
      <path d="M495 85 V103"/><path d="M495 165 V147"/>
    </g>
    <text x="150" y="115" font-size="10">HTTPS</text>
    <text x="318" y="78" font-size="10">/api/*</text>
    <text x="300" y="180" font-size="10">/api/insights/*</text>
    <text x="530" y="47" font-size="10">SOAP</text>
    <text x="530" y="187" font-size="10">REST</text>
    <text x="345" y="130" font-size="9.5">/internal</text>
  </g>
</svg>`;

const glance = `<section class="chapter" id="glance">
  <h1><span class="no">2</span>The system at a glance</h1>
  ${diagram}
  ${list([
    'The browser talks <b>only</b> to the gateway. The gateway adds an <code>X-Request-ID</code>, applies CORS and the rate limit, and forwards <code>/api/insights/*</code> to Insights and every other <code>/api/*</code> path to Core.',
    'Core owns the main data (<code>opendoor_core</code>) and calls the SOAP registry when an admin checks an employer.',
    'Insights builds the Workplace Accessibility Snapshot. It reads posting data from Core’s <code>/internal</code> route with a service key (never from Core’s database) and caches the public APIs in its own <code>insights_cache</code> database.',
    'Every error from any service has the same JSON envelope: <code>{"error":{"code","message","request_id"}}</code>.',
  ])}
  <table class="grid">
    <thead><tr><th>Component</th><th>Folder</th><th>Port</th></tr></thead>
    <tbody>${C.services.map(([name, folder, port]) => `<tr><td>${name}</td><td>${folder}</td><td>${port}</td></tr>`).join('')}</tbody>
  </table>
</section>`;

const run = `<section class="chapter" id="run">
  <h1><span class="no">3</span>Starting and stopping</h1>
  <h2>3.1 Before you start</h2>
  ${list([
    'MySQL 8 is running (Windows service <code>MySQL80</code>).',
    'Every service folder has its <code>.env</code> file and the databases are migrated and seeded (installation, see <code>README.md</code>).',
    'Open one PowerShell terminal per service (VS Code: <b>Terminal → Split</b> works well, so all logs are visible during the demo). Each command runs from the repository folder <code>C:\\dev\\opendoor</code>.',
  ])}
  <h2>3.2 Start order and commands</h2>
  <p>Start them top to bottom – each one needs the ones above it. Leave every terminal open: it is the service, and it shows its log.</p>
  <table class="grid">
    <thead><tr><th>#</th><th>Component</th><th>Terminal: go to</th><th>Start command</th><th>Ready when you see</th></tr></thead>
    <tbody>${C.services.map(([name, folder, , command, ready], index) => `<tr><td>${index}</td><td>${name}</td><td>${index === 0 ? '–' : `<code>cd ${folder.replace(/<\/?code>/g, '')}</code>`}</td><td>${command}</td><td>${ready}</td></tr>`).join('')}</tbody>
  </table>
  <p class="note">Use <code>127.0.0.1</code> for the PHP servers: on Windows <code>localhost</code> may bind IPv6 only, and the other services call <code>127.0.0.1</code>. Open the app itself at <code>http://localhost:5173</code> – that is the origin the gateway allows (CORS).</p>
  <h2>3.3 Check that everything runs</h2>
  ${list([
    'Browser: <code>http://localhost:8080/api/health</code> → <code>{"status":"ok","services":{"core":"up","insights":"up"}}</code>.',
    'Or run the validation script (section 7): <code>python tests/validate/validate_opendoor.py</code> → <code>Result: 14/14 checks passed</code>.',
    'Then open <code>http://localhost:5173</code> and log in with a demo account (section 4).',
  ])}
  <h2>3.4 Stopping, and freeing a busy port</h2>
  ${list([
    'Stop a service with <b>Ctrl+C</b> in its terminal (answer <b>Y</b> if asked). Stop in reverse order: React, gateway, Insights, Core, registry. MySQL can keep running.',
    'If a start command says the port is in use, find the process that holds it and stop it (PowerShell):',
  ])}
  ${pre('Get-NetTCPConnection -LocalPort 8001 -State Listen | Select-Object LocalPort, OwningProcess\nGet-Process -Id <OwningProcess>          # check what it is (php, node)\nStop-Process -Id <OwningProcess>', 'code')}
  <p class="note">Replace 8001 with the busy port (8001 Core, 8002 Insights, 8003 registry, 8080 gateway, 5173 React).</p>
  <h2>3.5 Optional: background jobs</h2>
  <p>Forgot-password emails are queued so the response time never reveals whether an account exists. Locally, send them with <code>php artisan queue:work database --stop-when-empty</code> in <code>services/core-api</code>; with the local <code>log</code> mailer the email (and its link) is written to <code>storage/logs/laravel.log</code>. In production the scheduler inside the Core container works the queue every minute and mail goes out through Brevo.</p>
  <h2>3.6 Production</h2>
  ${list([
    `App: <a href="${C.production.app}">${C.production.app}</a> · Gateway health: <code>${C.production.gateway}/api/health</code>.`,
    'Nothing needs to be started. A few minutes before presenting, open the health URL (wakes the services) and open each job page once (fills the snapshot cache).',
    'Logs: Railway dashboard → project → service → <b>Deployments → View logs</b> (the gateway shows the same JSON lines as locally).',
  ])}
</section>`;

const passwordRow = withPasswords
  ? `<table class="grid"><thead><tr><th>Where</th><th>Password for all five demo accounts</th></tr></thead><tbody>
      ${passwords.production ? `<tr><td>Production (${C.production.app})</td><td><code>${esc(passwords.production)}</code></td></tr>` : ''}
      ${passwords.local ? `<tr><td>Local stack (the team’s seeded database)</td><td><code>${esc(passwords.local)}</code></td></tr>` : ''}
    </tbody></table>`
  : '<p class="callout"><b>Passwords:</b> all five accounts share one demo password (<code>DEMO_PASSWORD</code>, set when the database is seeded). It is not written in this copy – ask the team for the copy with passwords or for the password itself.</p>';

const accounts = `<section class="chapter" id="accounts">
  <h1><span class="no">4</span>Addresses and demo accounts</h1>
  <table class="grid">
    <thead><tr><th></th><th>Local</th><th>Production</th></tr></thead>
    <tbody>
      <tr><th>App (React)</th><td><code>http://localhost:5173</code></td><td><a href="${C.production.app}">${C.production.app}</a></td></tr>
      <tr><th>API gateway</th><td><code>http://localhost:8080/api</code></td><td><code>${C.production.gateway}/api</code></td></tr>
      <tr><th>Health check</th><td><code>http://localhost:8080/api/health</code></td><td><code>${C.production.gateway}/api/health</code></td></tr>
      <tr><th>Core / Insights</th><td><code>http://127.0.0.1:8001</code> / <code>http://127.0.0.1:8002</code></td><td>private (Railway network only)</td></tr>
      <tr><th>SOAP registry WSDL</th><td><code>http://127.0.0.1:8003/soap?wsdl</code></td><td>private (Railway network only)</td></tr>
    </tbody>
  </table>
  <h2>Demo accounts</h2>
  <table class="grid">
    <thead><tr><th>Email</th><th>Name</th><th>Role</th><th>Use it to show</th></tr></thead>
    <tbody>${C.accounts.map(([email, name, role, use]) => `<tr><td><code>${email}</code></td><td>${name}</td><td>${role}</td><td>${use}</td></tr>`).join('')}</tbody>
  </table>
  ${passwordRow}
  <p class="note">New candidate or employer accounts can be registered from the home page; they see a short welcome tour and a “Get started” checklist. Admin accounts are only seeded.</p>
</section>`;

const demo = `<section class="chapter" id="demo">
  <h1><span class="no">5</span>Presentation demo script (about 10 minutes)</h1>
  <p class="lead">One path through all three roles that touches every component: gateway, Core, the mashup, the SOAP registry and the database. Section 6 shows what each of these clicks does behind the screen.</p>
  <table class="grid demo">
    <thead><tr><th>Time</th><th>As</th><th>Do</th><th>Say</th></tr></thead>
    <tbody>${C.demoScript.map(([time, who, action, say]) => `<tr><td class="nowrap">${time}</td><td>${who}</td><td>${action}</td><td>${say}</td></tr>`).join('')}</tbody>
  </table>
  <h2>Before the presentation</h2>
  ${list([
    'Production: open <code>/api/health</code> and every open job page once (wakes Railway, fills the snapshot cache).',
    'Local: start everything (section 3) and run the validation script.',
    'Production: as the admin, check that an employer and a posting are still waiting for approval (<b>Employers</b> / <b>Postings</b>). If earlier tests already approved Kalinga Foods or Packing Line Staff, use any waiting one, or register a new employer and submit a posting before the presentation.',
    'The demo changes data (an application, a hire, an approval). On production these stay; locally re-seed with <code>php artisan migrate:fresh --seed</code> to start again (deletes all local data).',
    'Keep a browser with DevTools open (F12 → <b>Network</b>, filter <b>Fetch/XHR</b>) and the gateway terminal visible.',
  ])}
</section>`;

const walkIntro = `<section class="chapter" id="walkthrough">
  <h1><span class="no">6</span>UI ↔ backend walkthrough</h1>
  <p class="lead">Nine clicks from the demo, each with the screen, the HTTP call the page made, the log lines in the service terminals and the database rows before and after.</p>
  <h2>How to show this live</h2>
  ${list([
    '<b>Browser – DevTools:</b> F12 → <b>Network</b> → filter <b>Fetch/XHR</b>. Click a request: <b>Headers</b> (method, URL, status, <code>X-Request-ID</code>, <code>Authorization</code>), <b>Payload</b> (the JSON sent) and <b>Response</b> (the JSON returned). The <code>OPTIONS</code> requests are CORS preflights answered by the gateway.',
    '<b>Gateway terminal:</b> one JSON line per request with the same <code>request_id</code> as the response header – search for it to follow one click.',
    '<b>Core / registry terminals:</b> each request Core and the SOAP registry receive. Insights logs every request and every external source that fails.',
    '<b>Database:</b> MySQL Workbench or <code>mysql -u opendoor_core -p opendoor_core</code>, then run the <code>SELECT</code> shown under each step.',
  ])}
  <p class="note">Captured ${captured} on the local stack, freshly seeded database (<code>${walkthrough.database}</code>), built React app (<code>npm run build</code> + <code>npx vite preview --port 5173</code>), so each call appears once. Times in the logs are UTC (Manila = UTC+8). Core here ran on PHP’s built-in server; <code>php artisan serve</code> shows the same requests in its own format. Response bodies are shortened (long lists show 2 items).</p>
</section>`;

const validate = `<section class="chapter" id="validate">
  <h1><span class="no">7</span>Validation script</h1>
  <p class="lead"><code>tests/validate/validate_opendoor.py</code> checks a running stack in a few seconds: every service, the gateway’s routing and the service-to-service call. It sends only <code>GET</code> requests and changes no data, so it is safe on production. Python 3.8+, standard library only.</p>
  <h2>Run it</h2>
  ${pre('python tests/validate/validate_opendoor.py                     # local stack (all 14 checks)\npython tests/validate/validate_opendoor.py --timeout 5         # slower machine\npython tests/validate/validate_opendoor.py --gateway ' + C.production.gateway + ' --gateway-only   # production (7 checks)', 'code')}
  <p>Exit code 0 = all passed, 1 = something failed. Options: <code>--id 3</code> (sample posting), <code>--gateway/--core/--insights/--registry URL</code>, <code>--snapshot-timeout</code> (default 15 s).</p>
  <h2>What it checks</h2>
  <table class="grid"><thead><tr><th>Check</th><th>Proves</th></tr></thead>
    <tbody>${C.validatorChecks.map(([check, proves]) => `<tr><td>${check}</td><td>${proves}</td></tr>`).join('')}</tbody></table>
  ${validateOutput ? `<h2>Sample output (local stack, ${captured})</h2>${pre(validateOutput, 'code')}` : ''}
  <p class="note"><code>psgc</code>, <code>nominatim</code> and <code>overpass</code> may be <code>unavailable</code> when the public servers are busy – the designed fallback, not a failure. Only <code>core</code> must be <code>ok</code>. The script’s README (<code>tests/validate/README.md</code>) lists the common causes when a check fails.</p>
</section>`;

const testsSection = `<section class="chapter" id="tests">
  <h1><span class="no">8</span>Testing tools</h1>
  <table class="grid">
    <thead><tr><th>Tool</th><th>Folder</th><th>Command</th><th>What it checks</th><th>Last result</th></tr></thead>
    <tbody>${C.tests.map(([tool, folder, command, what]) => `<tr><td>${tool}</td><td>${folder}</td><td class="cmd">${command}</td><td>${what}</td><td>${C.testResults[tool] ?? '–'}</td></tr>`).join('')}</tbody>
  </table>
  ${list([
    'Unit tests need no running services (Core uses an in-memory SQLite database). Newman, axe and the validation script need the running stack.',
    'Newman’s full collection creates and deletes test data; run it locally or in CI only. Production gets the read-only smoke collection (<code>OpenDoor.smoke.postman_collection.json</code>). Details: <code>tests/postman/README.md</code>, <code>tests/jmeter/README.md</code>.',
    'Results of the last full runs (CI, production smoke, JMeter) are in the SIA documentation, sections 7.1–7.3.',
  ])}
</section>`;

const trouble = `<section class="chapter" id="trouble">
  <h1><span class="no">9</span>Troubleshooting</h1>
  <table class="grid">
    <thead><tr><th>Problem</th><th>Likely cause</th><th>Fix</th></tr></thead>
    <tbody>${C.troubleshooting.map(([problem, cause, fix]) => `<tr><td>${problem}</td><td>${cause}</td><td>${fix}</td></tr>`).join('')}</tbody>
  </table>
  <p>Any error the API returns carries a <code>request_id</code>. Search for it in the gateway terminal (and Railway’s logs) to find the request and the service that answered.</p>
</section>`;

const rebuild = `<section class="chapter" id="rebuild">
  <h1><span class="no">A</span>Rebuilding this guide</h1>
  ${list([
    'Texts: <code>tests/a11y/guides/run-guide-content.mjs</code>. Builder: <code>build-run-guide.mjs</code>. Walkthrough capture: <code>capture-walkthrough.mjs</code> (same folder).',
    'Capture: start the stack on a freshly seeded copy of the database (for example <code>opendoor_core_test</code>), with each service’s output written to a log file, then in <code>tests/a11y</code>: <code>DEMO_PASSWORD=… LOG_DIR=&lt;log folder&gt; node guides/capture-walkthrough.mjs</code>.',
    'Build: <code>node guides/build-run-guide.mjs</code> → <code>docs/guides/OpenDoor-Run-and-Demo-Guide.pdf</code> (no passwords).',
    'Copy with passwords (not committed): set <code>PROD_DEMO_PASSWORD</code> and/or <code>LOCAL_DEMO_PASSWORD</code> and run the build again → <code>docs/guides/private/OpenDoor-Run-and-Demo-Guide-with-passwords.pdf</code> (git-ignored).',
  ])}
</section>`;

// ------------------------------------------------------------------ styles

const css = `
@page { size: A4; margin: 15mm 15mm 17mm; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: 'Segoe UI', system-ui, Roboto, Arial, sans-serif; font-size: 9.6pt; line-height: 1.45; color: #1f2328; }
code, pre { font-family: Consolas, 'Cascadia Mono', monospace; }
code { font-size: 0.92em; background: #f6f8fa; border-radius: 3px; padding: 0 0.2em; }
a { color: #6a4c9c; text-decoration: none; }
h1, h2, h3 { line-height: 1.25; break-after: avoid; }
h1 { font-size: 19pt; color: #47306f; margin: 0 0 4mm; padding-bottom: 2mm; border-bottom: 1.5pt solid #6a4c9c; }
h2 { font-size: 13pt; margin: 6mm 0 2.5mm; color: #1f2328; }
.label { font-size: 9pt; font-weight: 700; margin: 4mm 0 1.2mm; color: #47306f; text-transform: uppercase; letter-spacing: 0.04em; break-after: avoid; }
p { margin: 0 0 2.5mm; }
ul { margin: 0 0 2mm; padding-left: 5mm; }
li { margin: 0 0 0.8mm; }
.no { display: inline-block; min-width: 9mm; color: #6a4c9c; font-weight: 700; }
.lead { font-size: 10.5pt; color: #3a4048; }
.note { color: #57606a; font-size: 8.8pt; }
.nowrap { white-space: nowrap; }
.callout { border-left: 2.5pt solid #9a6700; background: #fff8e6; padding: 2mm 3mm; }
.chapter { break-before: page; }
.step { break-before: page; }
.step h2 { font-size: 14pt; margin-top: 0; padding: 2mm 3mm; background: #f6f8fa; border-left: 2.5pt solid #6a4c9c; }
.role { float: right; font-size: 8.5pt; font-weight: 600; color: #57606a; margin-top: 1.5mm; }

pre { margin: 0 0 2mm; padding: 2mm 2.5mm; background: #f6f8fa; border: 0.5pt solid #d0d7de; border-radius: 1.5mm; font-size: 7.6pt; line-height: 1.35; white-space: pre-wrap; word-break: break-all; }
pre.log { font-size: 7pt; }
pre.xml { font-size: 7.2pt; }
.logtitle { margin: 1.5mm 0 0.8mm; font-weight: 600; font-size: 8.6pt; }
.call { break-inside: auto; }

table { border-collapse: collapse; width: 100%; }
table.grid { margin: 0 0 4mm; font-size: 8.8pt; }
table.grid th, table.grid td { text-align: left; vertical-align: top; padding: 1.2mm 2mm; border: 0.5pt solid #d0d7de; }
table.grid thead th { background: #f6f8fa; font-weight: 600; }
table.grid tbody th { background: #fbfbfc; font-weight: 600; white-space: nowrap; }
table.grid tr { break-inside: avoid; }
table.small { font-size: 7.6pt; margin-bottom: 2mm; }
table.small td, table.small th { padding: 0.8mm 1.5mm; word-break: break-all; }
table.demo td:nth-child(3) { width: 42%; }
td.cmd code { word-break: break-all; }
.dbtable { break-inside: avoid; margin-bottom: 2mm; }
.dbtable__caption { font-weight: 600; font-size: 8.6pt; margin: 1.5mm 0 0.5mm; }
code.sql { display: block; font-size: 7.4pt; background: none; padding: 0; margin-bottom: 1mm; color: #57606a; }
td.empty { color: #8a939c; font-style: italic; }

figure.shot { margin: 2mm 0 3mm; break-inside: avoid; }
figure.shot img { display: block; max-width: 100%; max-height: 112mm; border: 0.6pt solid #b7c0c9; }
figcaption { font-size: 8pt; color: #57606a; margin-top: 1mm; }
svg.diagram { width: 100%; height: auto; margin: 0 0 4mm; }

.cover { height: 262mm; display: flex; flex-direction: column; }
.cover__band { display: flex; justify-content: space-between; align-items: center; background: #6a4c9c; color: #fff; padding: 6mm 8mm; border-radius: 2mm; }
.cover__brand { font-size: 20pt; font-weight: 700; }
.cover__kind { font-size: 10pt; text-transform: uppercase; letter-spacing: 0.08em; }
.cover__title { border: 0; font-size: 32pt; color: #1f2328; margin: 42mm 0 3mm; padding: 0; }
.cover__subtitle { font-size: 15pt; color: #6a4c9c; margin-bottom: 10mm; }
.cover__purpose { font-size: 11pt; max-width: 150mm; color: #3a4048; margin-bottom: 10mm; }
.cover__meta th { text-align: left; width: 30mm; color: #57606a; font-weight: 600; padding: 1.8mm 0; vertical-align: top; }
.cover__meta td { padding: 1.8mm 0; border-bottom: 0.5pt solid #d0d7de; }
.cover__project { margin-top: auto; color: #57606a; font-size: 9pt; }

.toc { break-before: page; }
.toc__list { list-style: none; padding: 0; }
.toc__list li { margin: 0; }
.toc__main { font-weight: 600; margin-top: 2.2mm !important; }
.toc__sub { padding-left: 9mm; font-size: 9pt; }
.toc__list a { color: #1f2328; }
.toc__no { display: inline-block; min-width: 9mm; color: #6a4c9c; }
`;

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${C.meta.title}</title><style>${css}</style></head>
<body>${cover}${contents}${about}${glance}${run}${accounts}${demo}${walkIntro}${walkSteps}${validate}${testsSection}${trouble}${rebuild}</body></html>`;

mkdirSync(OUT, { recursive: true });
const htmlFile = join(OUT, withPasswords ? 'run-guide-private.html' : 'run-guide.html');
writeFileSync(htmlFile, html);

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome' });
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(htmlFile).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  mkdirSync(dirname(PDF), { recursive: true });
  await page.pdf({
    path: PDF,
    format: 'A4',
    preferCSSPageSize: true,
    printBackground: true,
    outline: true,
    tagged: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: `<div style="width:100%;font:7.5pt 'Segoe UI',Arial,sans-serif;color:#57606a;padding:0 15mm;display:flex;justify-content:space-between"><span>${C.meta.title} · ${generated} · ${commit}</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
  });
} finally {
  await browser.close();
}
if (withPasswords) writeFileSync(htmlFile, ''); // the HTML copy held the passwords too
console.log(`PDF: ${PDF} (${(statSync(PDF).size / 1024 / 1024).toFixed(1)} MB)`);
