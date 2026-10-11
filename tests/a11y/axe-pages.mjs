// Accessibility check of the built frontend (SIA doc 8.4): opens the main pages of every role in
// Chromium against a running, seeded stack and runs axe-core with the WCAG 2.0/2.1 A and AA rules.
// Exits 1 when any page has a violation.
//
//   APP_URL=http://localhost:4173 API_URL=http://localhost:8080/api DEMO_PASSWORD=… node axe-pages.mjs
//
// The app's origin must be allowed by the gateway (CORS_ALLOWED_ORIGIN). PW_CHANNEL=chrome uses
// the installed Chrome instead of Playwright's Chromium (local runs).

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const APP_URL = (process.env.APP_URL ?? 'http://localhost:4173').replace(/\/+$/, '');
const API_URL = (process.env.API_URL ?? 'http://localhost:8080/api').replace(/\/+$/, '');
const DEMO_PASSWORD = process.env.DEMO_PASSWORD;
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

if (!DEMO_PASSWORD) {
  console.error('Set DEMO_PASSWORD (the seeded demo accounts).');
  process.exit(2);
}

const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

// ------------------------------------------------------------------ API helpers

async function api(path, { token, method = 'GET', body } = {}) {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    // Logins are limited to 5/min per account; the Newman run just before may have used them up.
    if (response.status === 429 && attempt < 3) {
      const seconds = Number(response.headers.get('retry-after')) || 30;
      console.log(`  ${method} ${path}: 429, retrying in ${seconds} s`);
      await new Promise((resolve) => setTimeout(resolve, (seconds + 1) * 1000));
      continue;
    }
    if (!response.ok) throw new Error(`${method} ${path} → ${response.status}`);
    return response.status === 204 ? null : response.json();
  }
}

const login = async (email) => (await api('/login', { method: 'POST', body: { email, password: DEMO_PASSWORD } })).token;
const first = (page) => page.data?.[0];

// ------------------------------------------------------------------ pages per role

const tokens = {
  candidate: await login('candidate@opendoor.test'),
  candidate2: await login('candidate2@opendoor.test'),
  employer: await login('employer@opendoor.test'),
  admin: await login('admin@opendoor.test'),
};

const posting = first(await api('/job-postings'));
const ownPosting = first(await api('/employer/job-postings', { token: tokens.employer }));
const candidateApplication = first(await api('/applications', { token: tokens.candidate }));
const hire = first(await api('/applications?status=hired', { token: tokens.candidate2 }));
const employerApplication = first(await api('/applications', { token: tokens.employer }));
const adminEmployer = first(await api('/admin/employers?status=verified', { token: tokens.admin }));

/** [role, path] – a page whose id could not be found is skipped (reported at the end). */
const pages = [
  [null, '/'],
  [null, '/jobs'],
  [null, posting && `/jobs/${posting.id}`],
  [null, posting && `/employers/${posting.employer?.id}`],
  [null, '/login'],
  [null, '/register'],
  [null, '/no-such-page'],
  ['candidate', '/candidate/dashboard'],
  ['candidate', '/candidate/profile'],
  ['candidate', '/candidate/jobs'],
  ['candidate', posting && `/candidate/jobs/${posting.id}`],
  ['candidate', '/candidate/applications'],
  ['candidate', candidateApplication && `/candidate/applications/${candidateApplication.id}`],
  ['candidate', '/candidate/saved-jobs'],
  ['candidate', '/notifications'],
  ['candidate', '/account'],
  ['candidate2', hire && `/candidate/applications/${hire.id}`],
  ['candidate2', hire && `/candidate/applications/${hire.id}/feedback`],
  ['employer', '/employer/dashboard'],
  ['employer', '/employer/company'],
  ['employer', '/employer/jobs'],
  ['employer', '/employer/jobs/new'],
  ['employer', ownPosting && `/employer/jobs/${ownPosting.id}/edit`],
  ['employer', ownPosting && `/employer/jobs/${ownPosting.id}/applicants`],
  ['employer', employerApplication && `/employer/applications/${employerApplication.id}`],
  ['employer', '/employer/trust-score'],
  ['admin', '/admin/dashboard'],
  ['admin', '/admin/employers'],
  ['admin', adminEmployer && `/admin/employers/${adminEmployer.id}`],
  ['admin', '/admin/job-postings'],
  ['admin', '/admin/users'],
  ['admin', '/admin/reports'],
  ['admin', '/admin/feedback'],
  ['admin', '/admin/master-data'],
];

// ------------------------------------------------------------------ run axe

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
const contexts = {};
async function contextFor(role) {
  if (!contexts[role]) {
    const context = await browser.newContext();
    if (role) {
      await context.addInitScript((token) => localStorage.setItem('opendoor.token', token), tokens[role]);
    }
    contexts[role] = context;
  }
  return contexts[role];
}

let failed = 0;
const skipped = [];
for (const [role, path] of pages) {
  if (!path || path.includes('undefined')) {
    skipped.push(`${role ?? 'guest'} page (no data to open it)`);
    continue;
  }
  const page = await (await contextFor(role)).newPage();
  await page.goto(`${APP_URL}${path}`, { waitUntil: 'networkidle' });
  await page.locator('h1').first().waitFor();
  await page.addScriptTag({ content: axeSource });
  const { violations } = await page.evaluate(
    (tags) => window.axe.run(document, { runOnly: { type: 'tag', values: tags } }),
    WCAG_TAGS,
  );
  const label = `${(role ?? 'guest').padEnd(10)} ${path}`;
  if (violations.length === 0) {
    console.log(`  ok    ${label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}`);
    for (const v of violations) {
      console.log(`        ${v.impact}: ${v.id} – ${v.help} (${v.nodes.length}×) ${v.helpUrl}`);
      for (const node of v.nodes.slice(0, 3)) console.log(`          ${node.target.join(' ')}`);
    }
  }
  await page.close();
}
await browser.close();

const checked = pages.length - skipped.length;
skipped.forEach((s) => console.log(`  skip  ${s}`));
console.log(`\n${checked} pages checked, ${failed} with violations (axe-core ${JSON.parse(readFileSync(createRequire(import.meta.url).resolve('axe-core/package.json'), 'utf8')).version}, ${WCAG_TAGS.join(', ')}).`);
process.exit(failed > 0 ? 1 : 0);
