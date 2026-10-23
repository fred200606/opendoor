// Screens for SIA documentation section 9.1 (docs/diagrams/screens/), captured from the running
// local stack whose Core uses a FRESHLY SEEDED test database (Decision 2026-10-23b):
//   DEMO_PASSWORD=… node sia-screens.mjs
// It changes data on the way, like a real demo: candidate@ applies to Junior Web Developer and
// employer@ reports the hire (so the application shows the hiring confirmation), and the admin
// runs a registry check for Kalinga Foods. Reseed before running it again.
// NEWMAN_REPORT=<htmlextra report> also saves its summary as newman-summary.png (section 7.2).
// Writes screens.json (file → pixel size) for docs/diagrams/build.js.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', '..', 'docs', 'diagrams', 'screens');
const APP_URL = (process.env.APP_URL ?? 'http://localhost:5173').replace(/\/+$/, '');
const API_URL = (process.env.API_URL ?? 'http://127.0.0.1:8080/api').replace(/\/+$/, '');
const PASSWORD = process.env.DEMO_PASSWORD;
if (!PASSWORD) {
  console.error('Set DEMO_PASSWORD (the seeded demo accounts of the test database).');
  process.exit(2);
}

mkdirSync(OUT, { recursive: true });
const sizes = {};
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome' });

async function session(email) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1.25, locale: 'en-PH', timezoneId: 'Asia/Manila' });
  const page = await context.newPage();
  if (email) {
    await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle' });
    await page.getByLabel(/^Email address/).fill(email);
    await page.getByLabel(/^Password/).fill(PASSWORD);
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'));
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

/** Saves `clip` (CSS px) of the full page; records the image's pixel size. */
async function save(page, name, clip) {
  const file = `${name}.jpg`;
  await page.screenshot({ path: join(OUT, file), type: 'jpeg', quality: 82, fullPage: true, animations: 'disabled', clip });
  sizes[file] = [Math.round(clip.width * 1.25), Math.round(clip.height * 1.25)];
  console.log(`  ${file} ${sizes[file].join('×')}`);
}

/** What `main` shows (no header, no empty space), at most `maxHeight` CSS px tall. */
async function shotMain(page, name, maxHeight = 1200) {
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
  const x = Math.max(0, box.left - 16);
  const y = Math.max(0, box.top - 16);
  await save(page, name, { x, y, width: box.right + 16 - x, height: Math.min(box.bottom + 16 - y, maxHeight) });
}

/** One element with a margin. */
async function shotOf(page, name, locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  const scroll = await page.evaluate(() => [scrollX, scrollY]);
  await save(page, name, { x: Math.max(0, box.x + scroll[0] - 12), y: Math.max(0, box.y + scroll[1] - 12), width: box.width + 24, height: box.height + 24 });
}

async function api(page, path) {
  return page.evaluate(
    async (url) => (await fetch(url, { headers: { Accept: 'application/json', Authorization: `Bearer ${localStorage.getItem('opendoor.token')}` } })).json(),
    `${API_URL}${path}`,
  );
}

const manilaDate = (days) => new Date(Date.now() + 8 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);

// ---------------------------------------------------------------- guest
console.log('guest');
const guest = await session(null);
await open(guest, '/jobs');
await shotMain(guest, 'guest-jobs', 1150);
await guest.context().close();

// ---------------------------------------------------------------- candidate
console.log('candidate@');
const candidate = await session('candidate@opendoor.test');
await open(candidate, '/candidate/profile?tab=about');
await shotMain(candidate, 'cand-profile-about', 1250);
await open(candidate, '/candidate/profile?tab=needs');
await shotMain(candidate, 'cand-profile-needs', 900);
await open(candidate, '/candidate/jobs');
await candidate.getByRole('button', { name: /Why this match\?/ }).first().click();
await shotMain(candidate, 'cand-jobs', 1250);
await open(candidate, '/candidate/jobs/1');
await shotMain(candidate, 'cand-job', 1150);
const snapshot = candidate.locator('section[aria-labelledby="snapshot-title"]');
await snapshot.getByRole('button').first().click();
await candidate.waitForFunction(() => !document.querySelector('section[aria-labelledby="snapshot-title"] .loading'), null, { timeout: 30_000 }).catch(() => {});
await candidate.waitForTimeout(500);
await shotOf(candidate, 'cand-snapshot', snapshot);

const jobs = await api(candidate, '/job-postings?q=Junior%20Web%20Developer');
const jobId = jobs.data.find((job) => job.title === 'Junior Web Developer').id;
await open(candidate, `/candidate/jobs/${jobId}#apply`);
await candidate.locator('section#apply').getByLabel(/^Cover note/).fill('I build accessible web pages with React and test them with a screen reader.');
await candidate.locator('section#apply').getByRole('button', { name: 'Send application' }).click();
await candidate.getByText('Application sent').waitFor();
const applicationId = (await api(candidate, '/applications')).data.find((item) => item.job_posting?.id === jobId).id;

// ---------------------------------------------------------------- employer
console.log('employer@');
const employer = await session('employer@opendoor.test');
await open(employer, `/employer/applications/${applicationId}`); // opening marks it Under review
await employer.locator('section.hiring-card').getByRole('button', { name: 'Report hiring' }).click();
await employer.getByRole('dialog').getByLabel(/^Start date/).fill(manilaDate(7));
await employer.getByRole('dialog').getByRole('button', { name: 'Send report' }).click();
await employer.getByText('Reported. We asked the applicant to confirm it.').waitFor();
await settle(employer);
await shotMain(employer, 'emp-application', 1250);
await open(employer, '/employer/dashboard');
await shotMain(employer, 'emp-dashboard', 1500);
await open(employer, '/employer/jobs/1/edit');
for (let step = 1; step < 4; step += 1) {
  await employer.getByRole('button', { name: 'Next' }).click();
  await settle(employer);
}
await shotMain(employer, 'emp-posting-salary', 1250);
await employer.getByRole('button', { name: 'Next' }).click();
await settle(employer);
await shotMain(employer, 'emp-posting-accommodations', 1250);
await open(employer, '/employer/trust-score');
await shotMain(employer, 'emp-trust', 900);
await employer.context().close();

// ---------------------------------------------------------------- candidate: the report to answer
await open(candidate, `/candidate/applications/${applicationId}`);
await shotMain(candidate, 'cand-application', 1300);
await candidate.context().close();

// ---------------------------------------------------------------- candidate2: rating form (hire 45 days ago)
console.log('candidate2@');
const candidate2 = await session('candidate2@opendoor.test');
const hire = (await api(candidate2, '/applications')).data.find((item) => item.status === 'hired');
await open(candidate2, `/candidate/applications/${hire.id}/feedback`);
await candidate2.getByRole('button', { name: 'Submit ratings' }).waitFor();
await shotMain(candidate2, 'cand2-feedback', 1100);
await candidate2.context().close();

// ---------------------------------------------------------------- admin
console.log('admin@');
const admin = await session('admin@opendoor.test');
const employers = await api(admin, '/admin/employers?q=Kalinga');
await open(admin, `/admin/employers/${employers.data[0].id}`);
await admin.getByRole('button', { name: /^Check with the business registry/ }).click();
await admin.getByText(/KALINGA FOODS, INC\./).first().waitFor({ timeout: 20_000 });
await settle(admin);
await shotMain(admin, 'admin-employer', 1250);
await open(admin, '/admin/dashboard');
await shotMain(admin, 'admin-dashboard', 1700);
await admin.context().close();

// ---------------------------------------------------------------- Newman report summary (7.2)
if (process.env.NEWMAN_REPORT) {
  const page = await (await browser.newContext({ viewport: { width: 1350, height: 675 } })).newPage();
  await page.goto(pathToFileURL(process.env.NEWMAN_REPORT).href, { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: join(OUT, 'newman-summary.png') });
  sizes['newman-summary.png'] = [1350, 675];
  console.log('  newman-summary.png');
}

await browser.close();
writeFileSync(join(OUT, 'screens.json'), `${JSON.stringify(sizes, null, 2)}\n`);
console.log('Done');
