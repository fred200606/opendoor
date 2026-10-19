// UI ↔ backend walkthrough for the Run & Demo Guide (docs/guides/): drives the demo story in the
// browser and records, for each step, the screen, the HTTP calls the page made (as DevTools shows
// them), the new service log lines and the database rows before and after.
//
// Run against a running local stack on a FRESHLY SEEDED test database, with every service's
// output written to a log file:
//   DEMO_PASSWORD=… LOG_DIR=<folder with gateway.log core.log insights.log registry.log> \
//     node guides/capture-walkthrough.mjs
// Defaults: APP_URL http://localhost:5173, API_URL http://127.0.0.1:8080/api, CORE_DB opendoor_core_test.
// Database credentials are read from services/core-api/.env and services/insights-service/.env.
// Output: tests/a11y/results/guides/walkthrough/ (git-ignored) – screenshots + walkthrough.json.
// Secrets never reach the output: passwords, tokens, the Authorization header and the SOAP
// password are replaced before anything is written.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const OUT = join(HERE, '..', 'results', 'guides', 'walkthrough');
const SHOTS = join(OUT, 'shots');

const APP_URL = (process.env.APP_URL ?? 'http://localhost:5173').replace(/\/+$/, '');
const API_URL = (process.env.API_URL ?? 'http://127.0.0.1:8080/api').replace(/\/+$/, '');
const PASSWORD = process.env.DEMO_PASSWORD;
const LOG_DIR = process.env.LOG_DIR;
const CORE_DB = process.env.CORE_DB ?? 'opendoor_core_test';
if (!PASSWORD || !LOG_DIR) {
  console.error('Set DEMO_PASSWORD (the seeded demo accounts) and LOG_DIR (the service log files).');
  process.exit(2);
}

const VIEWPORT = { width: 1440, height: 900 };
const SCALE = 1.25;
const HIDDEN = '•••••• (hidden)';

// ---------------------------------------------------------------- database

function readEnv(file) {
  const values = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}

const mysql = createRequire(join(REPO, 'services', 'insights-service', 'package.json'))('mysql2/promise');
const coreEnv = readEnv(join(REPO, 'services', 'core-api', '.env'));
const insightsEnv = readEnv(join(REPO, 'services', 'insights-service', '.env'));
const core = await mysql.createConnection({
  host: coreEnv.DB_HOST,
  port: Number(coreEnv.DB_PORT || 3306),
  user: coreEnv.DB_USERNAME,
  password: coreEnv.DB_PASSWORD,
  database: CORE_DB,
  dateStrings: true,
});
const cache = await mysql.createConnection({
  host: insightsEnv.CACHE_DB_HOST,
  port: Number(insightsEnv.CACHE_DB_PORT || 3306),
  user: insightsEnv.CACHE_DB_USER,
  password: insightsEnv.CACHE_DB_PASSWORD,
  database: insightsEnv.CACHE_DB_NAME,
  dateStrings: true,
});

/** Runs a read-only query and returns { sql, columns, rows } for the guide. */
async function query(connection, sql, params = []) {
  const [rows, fields] = await connection.query(sql, params);
  const shown = params.reduce((text, value) => text.replace('?', typeof value === 'number' ? String(value) : `'${value}'`), sql);
  return { sql: shown.replace(/\s+/g, ' ').trim(), columns: fields.map((field) => field.name), rows: rows.map((row) => fields.map((field) => cell(row[field.name]))) };
}

function cell(value) {
  if (value === null || value === undefined) return 'NULL';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return text.length > 90 ? `${text.slice(0, 87)}…` : text;
}

// ---------------------------------------------------------------- logs

const LOGS = ['gateway', 'core', 'insights', 'registry'];
const stripAnsi = (text) => text.replace(/\x1b\[[0-9;]*m/g, '');

function logMarks() {
  return Object.fromEntries(LOGS.map((name) => [name, existsSync(join(LOG_DIR, `${name}.log`)) ? statSync(join(LOG_DIR, `${name}.log`)).size : 0]));
}

/** New log lines since `marks`, without the PHP built-in server's Accepted/Closing noise. */
function logsSince(marks) {
  const result = {};
  for (const name of LOGS) {
    const file = join(LOG_DIR, `${name}.log`);
    if (!existsSync(file)) continue;
    const lines = stripAnsi(readFileSync(file).subarray(marks[name]).toString('utf8'))
      .split(/\r?\n/)
      .filter((line) => line.trim() && !/ (Accepted|Closing)$/.test(line) && !/\[vite\]/.test(line));
    if (lines.length) result[name] = lines;
  }
  return result;
}

// ---------------------------------------------------------------- HTTP capture

function redactBody(text) {
  if (!text) return null;
  try {
    return JSON.stringify(redactJson(JSON.parse(text)), null, 2);
  } catch {
    return text.length > 600 ? `${text.slice(0, 600)}…` : text;
  }
}

function redactJson(value, key = '') {
  if (Array.isArray(value)) {
    const kept = value.slice(0, 2).map((item) => redactJson(item));
    if (value.length > 2) kept.push(`… ${value.length - 2} more`);
    return kept;
  }
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, redactJson(item, name)]));
  if (/password/i.test(key)) return HIDDEN;
  if (key === 'token' && typeof value === 'string') return `${value.split('|')[0]}|${HIDDEN}`;
  if (typeof value === 'string' && value.length > 160) return `${value.slice(0, 157)}…`;
  return value;
}

/** Collects every API call the page makes until stop() is called. */
function recordCalls(page) {
  const calls = [];
  const pending = [];
  const onFinished = (request) => {
    if (!request.url().startsWith(API_URL.replace('127.0.0.1', 'localhost')) && !request.url().startsWith(API_URL)) return;
    if (request.method() === 'OPTIONS') return;
    pending.push(
      (async () => {
        const response = await request.response();
        const headers = await request.allHeaders();
        let body = null;
        try {
          body = await response.text();
        } catch {
          body = null;
        }
        const url = new URL(request.url());
        calls.push({
          at: Date.now(),
          method: request.method(),
          url: `${url.pathname}${url.search}`,
          full_url: `${url.origin}${url.pathname}${url.search}`,
          status: response.status(),
          request_id: (await response.allHeaders())['x-request-id'] ?? null,
          authorization: headers.authorization ? `Bearer ${headers.authorization.replace(/^Bearer /, '').split('|')[0]}|${HIDDEN}` : null,
          request_body: redactBody(request.postData()),
          response_body: redactBody(body),
        });
      })(),
    );
  };
  page.on('requestfinished', onFinished);
  return {
    async stop() {
      page.off('requestfinished', onFinished);
      await Promise.all(pending);
      return calls.sort((a, b) => a.at - b.at);
    },
  };
}

// ---------------------------------------------------------------- browser

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome' });
const walkthrough = { generated_at: new Date().toISOString(), app_url: APP_URL, api_url: API_URL, database: CORE_DB, steps: [] };

async function settle(page) {
  await page.waitForLoadState('networkidle');
  await page
    .waitForFunction(() => ![...document.querySelectorAll('.loading')].some((element) => element.offsetParent !== null), null, { timeout: 30_000 })
    .catch(() => console.warn(`  still loading: ${page.url()}`));
  await page.evaluate(() => document.fonts.ready);
}

async function screenshot(page, id, { full = false } = {}) {
  const file = `${id}.jpg`;
  await page.screenshot({ path: join(SHOTS, file), type: 'jpeg', quality: 78, fullPage: full });
  return file;
}

async function newPage() {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE, locale: 'en-PH', timezoneId: 'Asia/Manila' });
  // Skip the first-visit tour and checklist only if a fresh account shows them (demo accounts don't).
  return context.newPage();
}

/** Logs in through the real form (not recorded – step 1 shows the login itself). */
async function logIn(page, email) {
  await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle' });
  await page.getByLabel(/^Email address/).fill(email);
  await page.getByLabel(/^Password/).fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
  await settle(page);
}

/**
 * Records one walkthrough step: `before` / `after` return database snapshots, `act(page)` does the
 * clicks and returns the screenshot files; calls and logs are captured around `act`.
 */
async function step(page, meta, { before, act, after }) {
  console.log(`  ${meta.id}: ${meta.title}`);
  const dbBefore = before ? await before() : null;
  const marks = logMarks();
  const recorder = recordCalls(page);
  const shots = await act(page);
  await page.waitForTimeout(700); // let the access log lines reach the files
  const calls = await recorder.stop();
  const logs = logsSince(marks);
  const dbAfter = after ? await after() : null;
  walkthrough.steps.push({ ...meta, shots, calls, logs, db_before: dbBefore, db_after: dbAfter });
}

/** The SOAP envelope Core sends (same client options and header), password hidden. */
function soapRequestExample(registrationNumber, registryType, businessName) {
  const script = `
    $user = getenv('REG_USER'); $password = getenv('REG_PASSWORD');
    $wsse = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd';
    $xml = '<wsse:Security xmlns:wsse="'.$wsse.'"><wsse:UsernameToken><wsse:Username>'.htmlspecialchars($user, ENT_XML1).'</wsse:Username>'
      .'<wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">'
      .htmlspecialchars($password, ENT_XML1).'</wsse:Password></wsse:UsernameToken></wsse:Security>';
    $client = new SoapClient(getenv('REG_WSDL'), ['soap_version' => SOAP_1_1, 'trace' => true, 'user_agent' => 'OpenDoor-Core/1.0']);
    $client->__setSoapHeaders([new SoapHeader($wsse, 'Security', new SoapVar($xml, XSD_ANYXML))]);
    try { $client->VerifyBusinessRegistration(['RegistrationNumber' => getenv('REG_NO'), 'RegistryType' => getenv('REG_TYPE'), 'BusinessName' => getenv('REG_NAME')]); } catch (SoapFault $f) {}
    echo $client->__getLastRequest(), "\\n=====\\n", $client->__getLastResponse();
  `;
  const output = execFileSync('php', ['-r', script], {
    env: {
      ...process.env,
      REG_USER: coreEnv.REGISTRY_SOAP_USER,
      REG_PASSWORD: coreEnv.REGISTRY_SOAP_PASSWORD,
      REG_WSDL: coreEnv.REGISTRY_WSDL_URL || 'http://127.0.0.1:8003/soap?wsdl',
      REG_NO: registrationNumber,
      REG_TYPE: registryType,
      REG_NAME: businessName,
    },
  }).toString('utf8');
  const [request, response] = output.split('\n=====\n');
  const hide = (text) =>
    text
      .replace(/(<wsse:Password[^>]*>)[\s\S]*?(<\/wsse:Password>)/, `$1${HIDDEN}$2`)
      .replace(/(<wsse:Username>)[\s\S]*?(<\/wsse:Username>)/, `$1${HIDDEN}$2`);
  return { request: prettyXml(hide(request)), response: prettyXml(response.trim()) };
}

function prettyXml(xml) {
  let depth = 0;
  return xml
    .replace(/>\s*</g, '>\n<')
    .split('\n')
    .map((line) => {
      if (/^<\//.test(line)) depth = Math.max(0, depth - 1);
      const out = `${'  '.repeat(depth)}${line}`;
      if (/^<[^!?/][^>]*[^/]>$/.test(line) && !/<\/[^>]+>$/.test(line)) depth++;
      return out;
    })
    .join('\n');
}

// ---------------------------------------------------------------- the demo story

rmSync(OUT, { recursive: true, force: true });
mkdirSync(SHOTS, { recursive: true });

const userId = async (email) => (await core.query('SELECT id FROM users WHERE email = ?', [email]))[0][0].id;
const candidateId = await userId('candidate@opendoor.test');
const profileId = (await core.query('SELECT id FROM candidate_profiles WHERE user_id = ?', [candidateId]))[0][0].id;
const dataEncoderId = (await core.query("SELECT id FROM job_postings WHERE title = 'Data Encoder' AND deleted_at IS NULL"))[0][0].id;
const employer2 = (await core.query("SELECT id, company_name, business_reg_no, registry_type FROM employers WHERE company_name = 'Kalinga Foods Inc.'"))[0][0];
const packingId = (await core.query("SELECT id FROM job_postings WHERE title = 'Packing Line Staff'"))[0][0].id;

const latestApplication = () =>
  query(core, 'SELECT id, job_posting_id, candidate_profile_id, status, reviewed_at, hired_at, hire_confirmed_by, created_at FROM applications WHERE candidate_profile_id = ? AND job_posting_id = ?', [profileId, dataEncoderId]);
const latestNotices = (n = 2) =>
  query(core, `SELECT notifiable_id AS user_id, type, JSON_UNQUOTE(JSON_EXTRACT(data, '$.message')) AS message, created_at FROM notifications ORDER BY created_at DESC LIMIT ${n}`);

try {
  // 1–4: the candidate
  const candidate = await newPage();
  await step(
    candidate,
    { id: 'login', title: 'Log in (candidate)', role: 'Candidate – candidate@opendoor.test' },
    {
      before: () => query(core, 'SELECT id, tokenable_id, name, last_used_at, created_at FROM personal_access_tokens WHERE tokenable_id = ? ORDER BY id DESC LIMIT 1', [candidateId]),
      act: async (page) => {
        await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle' });
        await page.getByLabel(/^Email address/).fill('candidate@opendoor.test');
        await page.getByLabel(/^Password/).fill(PASSWORD);
        const form = await screenshot(page, 'login-form');
        await page.getByRole('button', { name: 'Log in' }).click();
        await page.waitForURL(/\/candidate\//);
        await settle(page);
        return [form, await screenshot(page, 'login-dashboard')];
      },
      after: () => query(core, 'SELECT id, tokenable_id, name, last_used_at, created_at FROM personal_access_tokens WHERE tokenable_id = ? ORDER BY id DESC LIMIT 1', [candidateId]),
    },
  );

  await step(
    candidate,
    { id: 'search', title: 'Find jobs that match my needs', role: 'Candidate' },
    {
      before: () =>
        query(core, 'SELECT a.id, a.name FROM candidate_accommodation ca JOIN accommodations a ON a.id = ca.accommodation_id WHERE ca.candidate_profile_id = ? ORDER BY a.id', [profileId]),
      act: async (page) => {
        await page.goto(`${APP_URL}/candidate/jobs`, { waitUntil: 'networkidle' });
        await settle(page);
        const match = page.getByLabel('Matches my needs');
        if (!(await match.isChecked())) await match.check();
        await settle(page);
        return [await screenshot(page, 'search-match')];
      },
    },
  );

  await step(
    candidate,
    { id: 'snapshot', title: 'Open a job and its Workplace Accessibility Snapshot (mashup)', role: 'Candidate' },
    {
      before: () => query(cache, 'SELECT address_hash, query, lat, lon, `precision`, fetched_at FROM geocode_cache ORDER BY fetched_at DESC LIMIT 2'),
      act: async (page) => {
        await page.goto(`${APP_URL}/candidate/jobs/${dataEncoderId}`, { waitUntil: 'networkidle' });
        await settle(page);
        const details = await screenshot(page, 'job-details');
        await page.getByRole('button', { name: 'Show Workplace Accessibility Snapshot' }).click();
        await settle(page);
        await page.locator('.snapshot').first().scrollIntoViewIfNeeded();
        return [details, await screenshot(page, 'job-snapshot')];
      },
      after: async () => ({
        geocode: await query(cache, 'SELECT address_hash, query, lat, lon, `precision`, fetched_at FROM geocode_cache ORDER BY fetched_at DESC LIMIT 2'),
        overpass: await query(cache, 'SELECT `key`, fetched_at FROM overpass_cache ORDER BY fetched_at DESC LIMIT 2'),
        psgc: await query(cache, 'SELECT `key`, fetched_at FROM psgc_cache ORDER BY fetched_at DESC LIMIT 2'),
      }),
    },
  );

  await step(
    candidate,
    { id: 'apply', title: 'Apply for the job', role: 'Candidate' },
    {
      before: latestApplication,
      act: async (page) => {
        await page.goto(`${APP_URL}/candidate/jobs/${dataEncoderId}`, { waitUntil: 'networkidle' });
        await settle(page);
        await page.getByLabel(/^Cover note/).fill('I type 60 words per minute with a screen reader and I am careful with data. I can start next month.');
        await page.getByLabel(/^Interview accommodation request/).fill('Please hold the interview online with captions.');
        await page.getByRole('button', { name: 'Send application' }).scrollIntoViewIfNeeded();
        const form = await screenshot(page, 'apply-form');
        await page.getByRole('button', { name: 'Send application' }).click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);
        return [form, await screenshot(page, 'apply-done')];
      },
      after: async () => ({ application: await latestApplication(), notifications: await latestNotices(1) }),
    },
  );
  await candidate.context().close();

  // 5: the employer
  const applicationId = (await core.query('SELECT id FROM applications WHERE candidate_profile_id = ? AND job_posting_id = ?', [profileId, dataEncoderId]))[0][0].id;
  const employer = await newPage();
  await logIn(employer, 'employer@opendoor.test');
  await step(
    employer,
    { id: 'review', title: 'Open the application (marks it reviewed)', role: 'Employer – employer@opendoor.test' },
    {
      before: latestApplication,
      act: async (page) => {
        await page.goto(`${APP_URL}/employer/applications/${applicationId}`, { waitUntil: 'networkidle' });
        await settle(page);
        return [await screenshot(page, 'review-application')];
      },
      after: async () => ({ application: await latestApplication(), notifications: await latestNotices(1) }),
    },
  );
  await step(
    employer,
    { id: 'hire', title: 'Mark the applicant as hired', role: 'Employer' },
    {
      before: latestApplication,
      act: async (page) => {
        await page.getByRole('button', { name: 'Mark as hired' }).click();
        await page.locator('dialog[open]').waitFor();
        await page.waitForTimeout(200);
        const dialog = await screenshot(page, 'hire-confirm');
        await page.locator('dialog[open]').getByRole('button', { name: 'Mark as hired' }).click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);
        return [dialog, await screenshot(page, 'hire-done')];
      },
      after: async () => ({
        application: await latestApplication(),
        accommodations: await query(core, 'SELECT application_id, accommodation_id FROM application_accommodation WHERE application_id = ?', [applicationId]),
        notifications: await latestNotices(1),
      }),
    },
  );
  await employer.context().close();

  // 6–8: the admin
  const admin = await newPage();
  await logIn(admin, 'admin@opendoor.test');
  const registryRows = () =>
    query(core, 'SELECT id, employer_id, business_reg_no, registry_type, status, registered_name, name_match_score, checked_at FROM registry_checks WHERE employer_id = ? ORDER BY id DESC LIMIT 1', [employer2.id]);
  await step(
    admin,
    { id: 'registry', title: 'Check the employer with the business registry (SOAP)', role: 'Admin – admin@opendoor.test' },
    {
      before: registryRows,
      act: async (page) => {
        await page.goto(`${APP_URL}/admin/employers/${employer2.id}`, { waitUntil: 'networkidle' });
        await settle(page);
        const pageShot = await screenshot(page, 'registry-before');
        await page.getByRole('button', { name: 'Check with the business registry' }).click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);
        return [pageShot, await screenshot(page, 'registry-result')];
      },
      after: registryRows,
    },
  );
  walkthrough.soap = soapRequestExample(employer2.business_reg_no, employer2.registry_type, employer2.company_name);

  const employerRow = () => query(core, 'SELECT id, company_name, verified_at, verification_rejected_reason FROM employers WHERE id = ?', [employer2.id]);
  await step(
    admin,
    { id: 'verify', title: 'Approve the employer', role: 'Admin' },
    {
      before: employerRow,
      act: async (page) => {
        await page.getByRole('button', { name: 'Approve', exact: true }).click();
        const dialog = page.locator('dialog[open]');
        if (await dialog.isVisible().catch(() => false)) {
          await page.waitForTimeout(200);
          await dialog.getByRole('button', { name: /Approve/ }).click();
        }
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);
        return [await screenshot(page, 'verify-done')];
      },
      after: async () => ({ employer: await employerRow(), notifications: await latestNotices(1) }),
    },
  );

  const postingRow = () => query(core, 'SELECT id, title, status, is_approved, updated_at FROM job_postings WHERE id = ?', [packingId]);
  await step(
    admin,
    { id: 'approve', title: 'Approve a job posting', role: 'Admin' },
    {
      before: postingRow,
      act: async (page) => {
        await page.goto(`${APP_URL}/admin/job-postings`, { waitUntil: 'networkidle' });
        await settle(page);
        const queue = await screenshot(page, 'approve-queue');
        await page.getByRole('button', { name: 'Approve Packing Line Staff', exact: true }).click();
        const dialog = page.locator('dialog[open]');
        if (await dialog.isVisible().catch(() => false)) {
          await page.waitForTimeout(200);
          await dialog.getByRole('button', { name: /Approve/ }).click();
        }
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);
        return [queue, await screenshot(page, 'approve-done')];
      },
      after: async () => ({ posting: await postingRow(), notifications: await latestNotices(1) }),
    },
  );
  await admin.context().close();
} finally {
  await browser.close();
  await core.end();
  await cache.end();
}

writeFileSync(join(OUT, 'walkthrough.json'), JSON.stringify(walkthrough, null, 2));

// Sample output of the validation script for section 7 (read-only GETs).
try {
  const output = execFileSync(process.env.PYTHON ?? 'python', [join(REPO, 'tests', 'validate', 'validate_opendoor.py'), '--timeout', '5'], { encoding: 'utf8' });
  writeFileSync(join(OUT, 'validate.txt'), output);
} catch (error) {
  writeFileSync(join(OUT, 'validate.txt'), `${error.stdout ?? ''}`);
  console.warn('The validation script reported failures – see validate.txt');
}
console.log(`Saved ${walkthrough.steps.length} steps to ${OUT}`);
