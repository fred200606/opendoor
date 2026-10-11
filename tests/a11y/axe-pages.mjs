// Accessibility check of the built frontend (SIA doc 8.4): opens the main pages of every role in
// Chromium against a running, seeded stack and runs axe-core with the WCAG 2.0/2.1 A and AA rules.
// Exits 1 when any page has a violation.
//
//   APP_URL=http://localhost:4173 API_URL=http://localhost:8080/api DEMO_PASSWORD=… node axe-pages.mjs
//
// The app's origin must be allowed by the gateway (CORS_ALLOWED_ORIGIN). PW_CHANNEL=chrome uses
// the installed Chrome instead of Playwright's Chromium (local runs).

import { chromium } from 'playwright';
import { axeVersion, contextFor, loadSite, open, runAxe, WCAG_TAGS } from './site.mjs';

const { tokens, pages, skipped } = await loadSite();
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
const contexts = {};

let failed = 0;
for (const [role, path] of pages) {
  contexts[role] ??= await contextFor(browser, tokens, role);
  const page = await open(contexts[role], path);
  const violations = await runAxe(page);
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

skipped.forEach((s) => console.log(`  skip  ${s}`));
console.log(`\n${pages.length} pages checked, ${failed} with violations (axe-core ${axeVersion}, ${WCAG_TAGS.join(', ')}).`);
process.exit(failed > 0 ? 1 : 0);
