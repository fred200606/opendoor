// Trust Score Guide (docs/guides/): drives the trust score story in the browser and saves a
// screenshot of each step plus the real dates and scores the guide quotes.
//
// Story (Decision 2026-10-23): candidate@ applies to employer@'s Junior Web Developer → employer@
// reports the hire → candidate@ confirms → the rating stays locked until day 30. Then the seeded
// candidate2@ (hired 45 days ago, form open) gets the reminder and gives employer2@ its 3rd
// response, which publishes employer2@'s score. No dates are faked.
//
// Run against a running local stack whose Core uses a FRESHLY SEEDED test database:
//   DEMO_PASSWORD=… node guides/capture-trust-score.mjs
// Defaults: APP_URL http://localhost:5173, API_URL http://127.0.0.1:8080/api, CORE_DB opendoor_core_test.
// The reminder step runs `php artisan feedback:remind` in services/core-api with DB_DATABASE=CORE_DB
// and MAIL_MAILER=log (no email leaves the machine).
// Output: tests/a11y/results/guides/trust-score/ (git-ignored) – screenshots + trust-score.json.

import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const OUT = join(HERE, '..', 'results', 'guides', 'trust-score');
const SHOTS = join(OUT, 'shots');

const APP_URL = (process.env.APP_URL ?? 'http://localhost:5173').replace(/\/+$/, '');
const API_URL = (process.env.API_URL ?? 'http://127.0.0.1:8080/api').replace(/\/+$/, '');
const PASSWORD = process.env.DEMO_PASSWORD;
const CORE_DB = process.env.CORE_DB ?? 'opendoor_core_test';
if (!PASSWORD) {
  console.error('Set DEMO_PASSWORD (the seeded demo accounts of the test database).');
  process.exit(2);
}

const VIEWPORT = { width: 1280, height: 860 };
const JOB_TITLE = 'Junior Web Developer';
const START_IN_DAYS = 7;
// What candidate2@ answers for employer2@'s Quality Control Assistant (anything else: delivered).
const RATINGS = { 'Adjustable workstation': 'Partly delivered' };

rmSync(OUT, { recursive: true, force: true });
mkdirSync(SHOTS, { recursive: true });

const facts = { captured_at: new Date().toISOString() };
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome' });

// ---------------------------------------------------------------- helpers

async function session(email) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1.5, locale: 'en-PH', timezoneId: 'Asia/Manila' });
  const page = await context.newPage();
  if (email) {
    await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle' });
    await page.getByLabel(/^Email address/).fill(email);
    await page.getByLabel(/^Password/).fill(PASSWORD);
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'));
    await settle(page);
  }
  return page;
}

async function settle(page) {
  await page.waitForLoadState('networkidle');
  await page
    .waitForFunction(() => ![...document.querySelectorAll('.loading')].some((element) => element.offsetParent !== null), null, { timeout: 30_000 })
    .catch(() => console.warn(`  still loading: ${page.url()}`));
  await page.evaluate(() => document.fonts.ready);
}

async function open(page, path) {
  await page.goto(`${APP_URL}${path}`, { waitUntil: 'networkidle' });
  await settle(page);
}

/** Screenshot of one element; returns the file name. */
async function shot(page, id, locator) {
  const file = `${id}.jpg`;
  await locator.scrollIntoViewIfNeeded();
  await locator.screenshot({ path: join(SHOTS, file), type: 'jpeg', quality: 80, animations: 'disabled' });
  console.log(`  ${file}`);
  return file;
}

/** Screenshot cropped to what `main` shows (no header, no empty space), at most `maxHeight` px tall. */
async function shotMain(page, id, maxHeight = 1300) {
  const box = await page.evaluate(() => {
    const edges = { left: Infinity, top: Infinity, right: 0, bottom: 0 };
    for (const element of document.querySelectorAll('main *')) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0 || getComputedStyle(element).visibility === 'hidden') continue;
      edges.left = Math.min(edges.left, rect.left + scrollX);
      edges.top = Math.min(edges.top, rect.top + scrollY);
      edges.right = Math.max(edges.right, rect.right + scrollX);
      edges.bottom = Math.max(edges.bottom, rect.bottom + scrollY);
    }
    return edges;
  });
  const pad = 16;
  const x = Math.max(0, box.left - pad);
  const y = Math.max(0, box.top - pad);
  const file = `${id}.jpg`;
  await page.screenshot({
    path: join(SHOTS, file),
    type: 'jpeg',
    quality: 80,
    animations: 'disabled',
    fullPage: true,
    clip: { x, y, width: box.right + pad - x, height: Math.min(box.bottom + pad - y, maxHeight) },
  });
  console.log(`  ${file}`);
  return file;
}

/** API call with the page's own token (read-only lookups for the facts the guide quotes). */
async function api(page, path) {
  return page.evaluate(
    async ({ url }) => {
      const response = await fetch(url, { headers: { Accept: 'application/json', Authorization: `Bearer ${localStorage.getItem('opendoor.token')}` } });
      return response.json();
    },
    { url: `${API_URL}${path}` },
  );
}

/** Waits for `locator`; on a timeout saves the page as failed-<name>.jpg before failing. */
async function expectVisible(page, locator, name) {
  try {
    await locator.waitFor({ timeout: 15_000 });
  } catch (error) {
    await page.screenshot({ path: join(OUT, `failed-${name}.jpg`), type: 'jpeg', fullPage: true });
    throw error;
  }
}

const section = (page, id) => page.locator(`section#${id}`);
const dialog = (page) => page.getByRole('dialog');
const manilaDate = (offsetDays = 0) => new Date(Date.now() + 8 * 3600_000 + offsetDays * 86400_000).toISOString().slice(0, 10);

// ---------------------------------------------------------------- 1. what job seekers see

console.log('1. Before applying');
const guest = await session(null);
await open(guest, '/jobs');
const card = guest.locator('article.job-card').filter({ has: guest.getByRole('link', { name: JOB_TITLE }) });
facts.card = await shot(guest, '01-job-card', card);
const jobHref = await card.getByRole('link', { name: JOB_TITLE }).first().getAttribute('href');
const jobId = Number(jobHref.split('/').pop());
await open(guest, `/jobs/${jobId}`);
facts.promises = await shot(guest, '02-job-accommodations', section(guest, 'accommodations'));
facts.employer_card = await shot(guest, '03-job-employer', section(guest, 'employer'));
await open(guest, '/trust-scores');
facts.explainer = await shotMain(guest, '04-how-trust-scores-work');
await guest.context().close();

// ---------------------------------------------------------------- 2. apply

console.log('2. Apply (candidate@)');
const candidate = await session('candidate@opendoor.test');
await open(candidate, `/candidate/jobs/${jobId}#apply`);
await section(candidate, 'apply').getByLabel(/^Cover note/).fill('I build accessible web pages with React and test them with a screen reader.');
facts.apply_form = await shot(candidate, '05-apply-form', section(candidate, 'apply'));
await section(candidate, 'apply').getByRole('button', { name: 'Send application' }).click();
await expectVisible(candidate, candidate.getByText('Application sent'), 'apply');
await settle(candidate);
facts.applied = await shot(candidate, '06-applied', candidate.locator('.job-actions-group'));
const mine = await api(candidate, '/applications');
const applicationId = mine.data.find((item) => item.job_posting?.id === jobId)?.id;
if (!applicationId) throw new Error('The new application was not found.');
facts.application_id = applicationId;

// ---------------------------------------------------------------- 3. employer reports the hire

console.log('3. Report hiring (employer@)');
const employer = await session('employer@opendoor.test');
await open(employer, `/employer/applications/${applicationId}`);
const hiring = employer.locator('section.hiring-card');
facts.employer_before = await shot(employer, '07-employer-application', hiring);
await hiring.getByRole('button', { name: 'Report hiring' }).click();
const startDate = manilaDate(START_IN_DAYS);
facts.start_date = startDate;
await dialog(employer).getByLabel(/^Start date/).fill(startDate);
facts.report_dialog = await shot(employer, '08-report-hiring-dialog', dialog(employer));
await dialog(employer).getByRole('button', { name: 'Send report' }).click();
await expectVisible(employer, hiring.getByText('Reported. We asked the applicant to confirm it.'), 'report');
facts.reported = await shot(employer, '09-reported-waiting', hiring);

// ---------------------------------------------------------------- 4. candidate confirms

console.log('4. Confirm (candidate@)');
await open(candidate, '/notifications');
facts.notice_report = await shot(candidate, '10-notice-hiring-report', candidate.locator('li.notification').first());
await open(candidate, `/candidate/applications/${applicationId}`);
const candidateHiring = candidate.locator('section.hiring-card');
facts.confirm_choice = await shot(candidate, '11-candidate-confirm-choice', candidateHiring);
await candidateHiring.getByRole('button', { name: 'Confirm' }).click();
facts.confirm_dialog = await shot(candidate, '12-confirm-dialog', dialog(candidate));
await dialog(candidate).getByRole('button', { name: 'Confirm' }).click();
await expectVisible(candidate, candidateHiring.getByText('The hire is confirmed.'), 'confirm');
await settle(candidate);
facts.hired_page = await shotMain(candidate, '13-candidate-hired');
const hired = await api(candidate, `/applications/${applicationId}`);
facts.hired_at = hired.hired_at;
facts.hire_start_date = hired.hire_start_date;
facts.feedback_opens_on = hired.feedback_opens_on;
facts.rating_prompt = await shot(candidate, '14-rating-date', candidate.locator('section[aria-labelledby="feedback-title"]'));
await open(candidate, `/candidate/applications/${applicationId}/feedback`);
facts.not_open = await shotMain(candidate, '15-feedback-not-open');

await open(employer, `/employer/applications/${applicationId}`);
facts.employer_hired = await shot(employer, '16-employer-hired', hiring);
await candidate.context().close();
await employer.context().close();

// ---------------------------------------------------------------- 5. day 30: employer2@ before

console.log('5. Before the 3rd response (employer2@)');
const employer2 = await session('employer2@opendoor.test');
await open(employer2, '/employer/trust-score');
facts.score_before_shot = await shotMain(employer2, '17-employer2-before');
const company2 = await api(employer2, '/employer/company');
facts.employer2_id = company2.id;
facts.score_before = await api(employer2, `/employers/${company2.id}/trust-score`);

// ---------------------------------------------------------------- 6. reminder + rating (candidate2@)

console.log('6. Reminder and rating (candidate2@)');
const remind = execFileSync('php', ['artisan', 'feedback:remind'], {
  cwd: join(REPO, 'services', 'core-api'),
  env: { ...process.env, DB_DATABASE: CORE_DB, MAIL_MAILER: 'log' },
  encoding: 'utf8',
});
facts.remind_output = remind.trim();
const candidate2 = await session('candidate2@opendoor.test');
await open(candidate2, '/notifications');
facts.notice_reminder = await shot(candidate2, '18-notice-reminder', candidate2.locator('li.notification').first());
const applications2 = await api(candidate2, '/applications');
const hire2 = applications2.data.find((item) => item.status === 'hired' && !item.feedback_submitted);
if (!hire2) throw new Error('candidate2@ has no hired, unrated application – is the test database freshly seeded?');
facts.hire2 = { id: hire2.id, title: hire2.job_posting?.title, company: hire2.job_posting?.employer?.company_name, hire_start_date: hire2.hire_start_date, feedback_opens_on: hire2.feedback_opens_on };
await open(candidate2, `/candidate/applications/${hire2.id}`);
facts.rating_open = await shot(candidate2, '19-rating-open', candidate2.locator('section[aria-labelledby="feedback-title"]'));
await candidate2.locator('section[aria-labelledby="feedback-title"]').getByRole('link', { name: 'Rate accommodations' }).click();
await expectVisible(candidate2, candidate2.getByRole('button', { name: 'Submit ratings' }), 'form');
await settle(candidate2);
facts.form_empty = await shotMain(candidate2, '20-feedback-form');

const groups = candidate2.locator('form fieldset');
const given = [];
for (let index = 0; index < (await groups.count()); index += 1) {
  const group = groups.nth(index);
  const name = (await group.locator('legend').innerText()).replace(/\s*\(required\)\s*$/i, '').replace(/\s*\*\s*$/, '').trim();
  const label = RATINGS[name] ?? 'Delivered';
  await group.getByLabel(label, { exact: true }).check();
  given.push({ name, rating: label });
}
if (given.length === 0) throw new Error('The feedback form showed no accommodations to rate.');
facts.ratings_given = given;
await candidate2.getByLabel(/^Comments/).fill('The workstation was adjusted after my second week.');
facts.form_filled = await shotMain(candidate2, '21-feedback-filled');
await candidate2.getByRole('button', { name: 'Submit ratings' }).click();
await expectVisible(candidate2, candidate2.getByText('Your ratings are saved.'), 'rating');
facts.thanks = await shotMain(candidate2, '22-feedback-thanks');
await open(candidate2, `/candidate/applications/${hire2.id}/feedback`);
facts.already = await shotMain(candidate2, '23-feedback-once');
await candidate2.context().close();

// ---------------------------------------------------------------- 7. published

console.log('7. Published (employer2@, admin@)');
await open(employer2, '/employer/trust-score');
facts.score_after_shot = await shotMain(employer2, '24-employer2-published');
facts.score_after = await api(employer2, `/employers/${company2.id}/trust-score`);
await open(employer2, '/employer/dashboard');
const trustCard = employer2.locator('section').filter({ has: employer2.getByRole('heading', { name: /trust score/i }) }).last();
facts.dashboard_card = await shot(employer2, '25-employer2-dashboard', trustCard);
await employer2.context().close();

const admin = await session('admin@opendoor.test');
await open(admin, '/admin/feedback');
facts.admin_feedback = await shotMain(admin, '26-admin-feedback', 1100);
await admin.context().close();

await browser.close();
writeFileSync(join(OUT, 'trust-score.json'), JSON.stringify(facts, null, 2));
console.log(`Done: ${OUT}`);
