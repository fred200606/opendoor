// Screenshots for the UI reference PDF (docs/ui-reference/): every screen of every role, the main
// dialogs and states, and close-ups of the shared components.
//
// Run against a running stack on a FRESHLY SEEDED database (the demo story below assumes it):
//   APP_URL=http://localhost:5173 API_URL=http://127.0.0.1:8080/api DEMO_PASSWORD=… node ui-reference/capture.mjs
// then `node ui-reference/build.mjs`. The first run adds a few demo actions (applications, a saved
// job, a report, a draft posting, a registry check); later runs reuse them.
// Output: tests/a11y/results/ui-reference/ (git-ignored) – JPEG slices + manifest.json.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const APP_URL = (process.env.APP_URL ?? 'http://localhost:5173').replace(/\/+$/, '');
const API_URL = (process.env.API_URL ?? 'http://127.0.0.1:8080/api').replace(/\/+$/, '');
const PASSWORD = process.env.DEMO_PASSWORD;
if (!PASSWORD) {
  console.error('Set DEMO_PASSWORD (the seeded demo accounts).');
  process.exit(2);
}

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'results', 'ui-reference');
const SHOTS = join(OUT, 'shots');
const DESKTOP = { width: 1200, height: 640 }; // short pages stay short (the footer sits at the window bottom)
const PHONE = { width: 390, height: 844 };
const SCALE = 1.5; // sharper text when the PDF is zoomed
const QUALITY = 74;
const SLICE = 1500; // max CSS px per image so a slice fits on an A4 page

// ---------------------------------------------------------------- API helpers

async function api(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`${method} ${path} → ${response.status} ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}

const login = async (email) => (await api('/login', { method: 'POST', body: { email, password: PASSWORD } })).token;

/** Adds the demo actions the screens need (idempotent) and returns the ids to open. */
async function stage(t) {
  const open = (await api('/job-postings')).data;
  const byTitle = (title) => open.find((job) => job.title === title);
  const dataEncoder = byTitle('Data Encoder');
  const support = byTitle('Customer Support Associate (Chat)');
  const webDev = byTitle('Junior Web Developer');

  let mine = (await api('/applications', { token: t.candidate })).data;
  if (mine.length === 0) {
    await api(`/job-postings/${webDev.id}/applications`, {
      token: t.candidate,
      method: 'POST',
      body: {
        cover_note: 'I have built two small websites for local shops using HTML, CSS and React. I work well with a screen reader and keyboard only.',
        interview_request: 'Please send the interview questions in writing as well, and allow extra time for the coding task.',
      },
    });
    await api(`/job-postings/${support.id}/applications`, {
      token: t.candidate,
      method: 'POST',
      body: { cover_note: 'I enjoy helping customers in writing and I type quickly and accurately.' },
    });
    mine = (await api('/applications', { token: t.candidate })).data;
  }
  const webDevApplication = mine.find((application) => application.job_posting?.id === webDev.id);
  // An employer opening a pending application marks it reviewed (and notifies the candidate).
  if (webDevApplication.status === 'pending') await api(`/applications/${webDevApplication.id}`, { token: t.employer });

  for (const job of [dataEncoder, support]) await api(`/candidate/saved-jobs/${job.id}`, { token: t.candidate, method: 'POST' });

  if ((await api('/admin/reports?status=open', { token: t.admin })).data.length === 0) {
    await api(`/job-postings/${webDev.id}/reports`, {
      token: t.candidate,
      method: 'POST',
      body: { reason: 'The posting offers remote work, but the description asks for daily office attendance in Quezon City.' },
    });
  }

  const own = (await api('/employer/job-postings', { token: t.employer })).data;
  let draft = own.find((posting) => posting.status === 'draft');
  if (!draft) {
    draft = await api('/job-postings', {
      token: t.employer,
      method: 'POST',
      body: {
        title: 'Accounting Clerk',
        description: 'Prepare invoices, record payments and reconcile accounts. Monday to Friday, 8:00 to 17:00.',
        category_id: dataEncoder.category?.id,
        address: '5th Floor, Bayanihan Tower, Scout Tobias St.',
        location_psgc: '1381300000',
        location_label: 'Quezon City, National Capital Region (NCR)',
        employment_type: 'full_time',
        work_setup: 'onsite',
        interview_format: 'onsite',
        closes_at: new Date(Date.now() + 45 * 864e5).toISOString().slice(0, 10),
        accommodations: (dataEncoder.accommodations ?? []).slice(0, 2).map((item) => ({ id: item.id, note: null })),
        submit: false,
      },
    });
  }

  const pendingEmployers = (await api('/admin/employers?status=pending', { token: t.admin })).data;
  const toVerify = pendingEmployers[0];
  if (toVerify && !toVerify.latest_registry_check) {
    await api(`/admin/employers/${toVerify.id}/verify`, { token: t.admin, method: 'PATCH', body: { action: 'check' } });
  }

  const hires = (await api('/applications?status=hired', { token: t.candidate2 })).data;
  const unratedHire = hires.find((application) => !application.feedback_submitted) ?? hires[0];
  const employerId = dataEncoder.employer.id;

  return { dataEncoder, support, webDev, webDevApplication, draft, toVerify, unratedHire, employerId };
}

// ---------------------------------------------------------------- browser helpers

let browser;
const manifest = { generated_at: new Date().toISOString(), viewport: DESKTOP, scale: SCALE, shots: {}, crops: {} };

async function contextFor(token, { viewport = DESKTOP, scale = SCALE, display } = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: scale, locale: 'en-PH', timezoneId: 'Asia/Manila' });
  await context.addInitScript(
    ({ token, display }) => {
      if (token) localStorage.setItem('opendoor.token', token);
      if (display) localStorage.setItem('opendoor.display', JSON.stringify(display));
    },
    { token, display: display ?? null },
  );
  return context;
}

async function settle(page) {
  await page.locator('main h1').first().waitFor();
  await page.waitForLoadState('networkidle');
  // The snapshot and other sections load on their own; wait until no "Loading…" status is left.
  await page
    .waitForFunction(() => ![...document.querySelectorAll('.loading')].some((element) => element.offsetParent !== null), null, { timeout: 30_000 })
    .catch(() => console.warn(`  still loading: ${page.url()}`));
  await page.evaluate(() => document.fonts.ready);
}

/** Full-page screenshot cut into slices of at most SLICE px (one PDF page each). */
async function fullPage(page, id) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const width = page.viewportSize().width;
  const count = Math.max(1, Math.ceil(height / SLICE));
  const step = Math.ceil(height / count);
  const files = [];
  for (let index = 0; index < count; index++) {
    const y = index * step;
    const file = `${id}${count > 1 ? `-${index + 1}` : ''}.jpg`;
    await page.screenshot({
      path: join(SHOTS, file),
      type: 'jpeg',
      quality: QUALITY,
      fullPage: true,
      clip: { x: 0, y, width, height: Math.min(step, height - y) },
    });
    files.push(file);
  }
  return { files, width, height };
}

async function viewportShot(page, id) {
  const file = `${id}.jpg`;
  await page.screenshot({ path: join(SHOTS, file), type: 'jpeg', quality: QUALITY });
  return { files: [file], width: page.viewportSize().width, height: page.viewportSize().height };
}

/**
 * Opens `path` for `token` and records shot `id`. `before(page)` may change the page first
 * (open a dialog, submit an empty form); `mode` is 'full' (default) or 'viewport'.
 */
async function shot(id, token, path, { before, mode = 'full', crops = [], ...contextOptions } = {}) {
  const context = await contextFor(token, contextOptions);
  const page = await context.newPage();
  try {
    await page.goto(`${APP_URL}${path}`, { waitUntil: 'networkidle' });
    await settle(page);
    for (const [cropId, selector] of crops) await crop(page, cropId, selector);
    if (before) await before(page);
    manifest.shots[id] = { path, ...(mode === 'viewport' ? await viewportShot(page, id) : await fullPage(page, id)) };
    console.log(`  ${id}: ${path} (${manifest.shots[id].files.length} image${manifest.shots[id].files.length > 1 ? 's' : ''})`);
  } finally {
    await context.close();
  }
}

async function crop(page, id, selector) {
  const element = page.locator(selector).first();
  await element.scrollIntoViewIfNeeded();
  const file = `crop-${id}.jpg`;
  await element.screenshot({ path: join(SHOTS, file), type: 'jpeg', quality: 82 });
  const box = await element.boundingBox();
  manifest.crops[id] = { file, width: Math.round(box.width), height: Math.round(box.height) };
}

/** Clicks a button and waits for the modal dialog. */
const openDialog = (name) => async (page) => {
  await page.getByRole('button', { name }).first().click();
  await page.locator('dialog[open]').waitFor();
  await page.waitForTimeout(150);
};

// ---------------------------------------------------------------- run

rmSync(OUT, { recursive: true, force: true });
mkdirSync(SHOTS, { recursive: true });

const t = {
  candidate: await login('candidate@opendoor.test'),
  candidate2: await login('candidate2@opendoor.test'),
  employer: await login('employer@opendoor.test'),
  employer2: await login('employer2@opendoor.test'),
  admin: await login('admin@opendoor.test'),
};
console.log('Staging demo data…');
const ids = await stage(t);

browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome' });
try {
  console.log('Public screens');
  await shot('guest-home', null, '/');
  await shot('guest-jobs', null, '/jobs', { crops: [['job-card', '.job-card']] });
  await shot('guest-job', null, `/jobs/${ids.dataEncoder.id}`, { crops: [['snapshot', '.snapshot']] });
  await shot('guest-employer', null, `/employers/${ids.employerId}`, { crops: [['trust-card', '.trust-card']] });
  await shot('guest-login', null, '/login');
  await shot('guest-login-errors', null, '/login', {
    mode: 'viewport',
    before: async (page) => {
      await page.getByRole('button', { name: 'Log in' }).click();
      await page.locator('.error-summary').waitFor();
      await crop(page, 'error-summary', '.error-summary');
    },
  });
  await shot('guest-register', null, '/register');
  await shot('guest-register-errors', null, '/register', {
    before: async (page) => {
      await page.getByRole('button', { name: 'Create account' }).click();
      await page.locator('.error-summary').waitFor();
    },
  });
  await shot('guest-404', null, '/no-such-page');

  console.log('Job seeker screens');
  await shot('cand-dashboard', t.candidate, '/candidate/dashboard', { crops: [['stat-cards', '.stats'], ['header', '.site-header']] });
  await shot('cand-profile', t.candidate, '/candidate/profile', { crops: [['accommodation-group', '.accommodation-picker__group']] });
  await shot('cand-jobs', t.candidate, '/candidate/jobs');
  await shot('cand-job', t.candidate, `/candidate/jobs/${ids.dataEncoder.id}`);
  await shot('cand-job-partial', t.candidate, `/candidate/jobs/${ids.webDev.id}`, { mode: 'viewport', crops: [['match-badge', '.match']] });
  await shot('cand-job-report', t.candidate, `/candidate/jobs/${ids.dataEncoder.id}`, { mode: 'viewport', before: openDialog('Report this job') });
  await shot('cand-applications', t.candidate, '/candidate/applications', { crops: [['status-table', '.table-wrap']] });
  await shot('cand-application', t.candidate, `/candidate/applications/${ids.webDevApplication.id}`);
  await shot('cand-application-withdraw', t.candidate, `/candidate/applications/${ids.webDevApplication.id}`, {
    mode: 'viewport',
    before: openDialog('Withdraw application'),
  });
  await shot('cand-saved', t.candidate, '/candidate/saved-jobs');
  await shot('cand-notifications', t.candidate, '/notifications');
  await shot('cand-account', t.candidate, '/account');
  await shot('cand2-dashboard', t.candidate2, '/candidate/dashboard');
  await shot('cand2-application', t.candidate2, `/candidate/applications/${ids.unratedHire.id}`);
  await shot('cand2-feedback', t.candidate2, `/candidate/applications/${ids.unratedHire.id}/feedback`);
  await shot('cand2-saved-empty', t.candidate2, '/candidate/saved-jobs', { mode: 'viewport' });

  console.log('Employer screens');
  await shot('emp-dashboard', t.employer, '/employer/dashboard');
  await shot('emp-company', t.employer, '/employer/company', { crops: [['alert-success', '.alert--success']] });
  await shot('emp-postings', t.employer, '/employer/jobs');
  await shot('emp-postings-delete', t.employer, '/employer/jobs', {
    mode: 'viewport',
    before: async (page) => {
      await page.getByRole('button', { name: `Delete ${ids.draft.title}` }).click();
      await page.locator('dialog[open]').waitFor();
      await crop(page, 'confirm-dialog', 'dialog[open]');
    },
  });
  await shot('emp-posting-new', t.employer, '/employer/jobs/new', { crops: [['location-picker', '#location_psgc']] });
  await shot('emp-posting-edit', t.employer, `/employer/jobs/${ids.dataEncoder.id}/edit`);
  await shot('emp-applicants', t.employer, `/employer/jobs/${ids.webDev.id}/applicants`);
  await shot('emp-application', t.employer, `/employer/applications/${ids.webDevApplication.id}`);
  await shot('emp-trust', t.employer, '/employer/trust-score');
  await shot('emp-notifications', t.employer, '/notifications');
  await shot('emp2-dashboard', t.employer2, '/employer/dashboard');
  await shot('emp2-company', t.employer2, '/employer/company', { mode: 'viewport', crops: [['alert-info', '.alert--info']] });

  console.log('Administrator screens');
  await shot('admin-dashboard', t.admin, '/admin/dashboard');
  await shot('admin-employers', t.admin, '/admin/employers');
  await shot('admin-employer', t.admin, `/admin/employers/${ids.toVerify.id}`);
  await shot('admin-postings', t.admin, '/admin/job-postings');
  await shot('admin-postings-reject', t.admin, '/admin/job-postings', { mode: 'viewport', before: openDialog(/^Do not approve/) });
  await shot('admin-users', t.admin, '/admin/users');
  await shot('admin-reports', t.admin, '/admin/reports');
  await shot('admin-feedback', t.admin, '/admin/feedback');
  await shot('admin-master', t.admin, '/admin/master-data');

  console.log('States and display settings');
  await shot('state-voice-notice', null, '/jobs', { mode: 'viewport', before: openDialog(/^Speak/) });
  await shot('state-phone-jobs', null, '/jobs', { mode: 'viewport', viewport: PHONE, scale: 2 });
  await shot('state-phone-job', null, `/jobs/${ids.dataEncoder.id}`, { mode: 'viewport', viewport: PHONE, scale: 2 });
  await shot('state-phone-menu', t.candidate, '/candidate/dashboard', { mode: 'viewport', viewport: PHONE, scale: 2 });
  await shot('state-high-contrast', null, '/jobs', { mode: 'viewport', display: { textSize: '150', contrast: 'high', motion: 'reduce' } });
} finally {
  await browser.close();
}

writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`Done: ${Object.keys(manifest.shots).length} screens, ${Object.keys(manifest.crops).length} close-ups → ${OUT}`);
