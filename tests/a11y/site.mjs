// Shared set-up for the accessibility scripts: settings, the demo logins and the main pages of
// every role against a running, seeded stack. See axe-pages.mjs (CI) and wcag-checks.mjs (audit).

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

export const APP_URL = (process.env.APP_URL ?? 'http://localhost:4173').replace(/\/+$/, '');
export const API_URL = (process.env.API_URL ?? 'http://localhost:8080/api').replace(/\/+$/, '');
export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const require = createRequire(import.meta.url);
export const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
export const axeVersion = JSON.parse(readFileSync(require.resolve('axe-core/package.json'), 'utf8')).version;

const DEMO_PASSWORD = process.env.DEMO_PASSWORD;
if (!DEMO_PASSWORD) {
  console.error('Set DEMO_PASSWORD (the seeded demo accounts).');
  process.exit(2);
}

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

/** Logs in the demo accounts and finds ids → { tokens, pages: [[role, path]], skipped: [label] }. */
export async function loadSite() {
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

  const all = [
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

  const usable = ([, path]) => path && !path.includes('undefined');
  return {
    tokens,
    pages: all.filter(usable),
    skipped: all.filter((page) => !usable(page)).map(([role]) => `${role ?? 'guest'} page (no data to open it)`),
  };
}

/**
 * A browser context signed in as `role` (null = guest). `display` presets the M13 settings
 * ({ textSize, contrast, motion }) the app reads before its first render.
 */
export async function contextFor(browser, tokens, role, { viewport, display } = {}) {
  const context = await browser.newContext(viewport ? { viewport } : {});
  await context.addInitScript(
    ({ token, display }) => {
      if (token) localStorage.setItem('opendoor.token', token);
      if (display) localStorage.setItem('opendoor.display', JSON.stringify(display));
    },
    { token: role ? tokens[role] : null, display: display ?? null },
  );
  return context;
}

/** Opens the page and waits until the app has rendered it (its h1) and the network is quiet. */
export async function open(context, path) {
  const page = await context.newPage();
  await page.goto(`${APP_URL}${path}`, { waitUntil: 'networkidle' });
  await page.locator('h1').first().waitFor();
  return page;
}

export async function runAxe(page) {
  await page.addScriptTag({ content: axeSource });
  const { violations } = await page.evaluate((tags) => window.axe.run(document, { runOnly: { type: 'tag', values: tags } }), WCAG_TAGS);
  return violations;
}
