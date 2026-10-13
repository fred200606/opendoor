// WCAG 2.1 AA checks that axe-core cannot make on its own, on the same pages as axe-pages.mjs.
// For the audit (docs/accessibility/wcag-audit.md), not a CI gate: a few results need a human
// look (e.g. a focus style drawn with a border is reported as missing).
//
//   APP_URL=… API_URL=… DEMO_PASSWORD=… [PW_CHANNEL=chrome] node wcag-checks.mjs [results.json]
//
//   2.4.2 page titles · 3.1.1 page language · 1.3.1 one h1, no skipped heading levels ·
//   2.4.1 skip link reaches <main> · 2.4.3 no positive tabindex · 2.1.1 / 2.4.7 every tabbable
//   element is reached by Tab and shows a focus outline · 1.3.5 autocomplete on personal-data fields ·
//   1.4.10 reflow at 320 px · 1.4.4 text at 200 % · 1.4.12 text spacing · axe colour contrast in the
//   app's high-contrast mode at 150 % text · target size below 24×24 px (2.5.8, WCAG 2.2 – advisory)

import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { APP_URL, contextFor, loadSite, open, runAxe } from './site.mjs';

const DESKTOP = { width: 1280, height: 800 };
const NARROW = { width: 320, height: 640 };
const { tokens, pages, skipped } = await loadSite();
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });

// ------------------------------------------------------------------ in-page helpers (run in the browser)

const describe = (el) => {
  const id = el.id ? `#${el.id}` : '';
  const cls = typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/).join('.')}` : '';
  const text = (el.getAttribute('aria-label') || el.textContent || el.value || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  return `${el.tagName.toLowerCase()}${id}${cls}${text ? ` "${text}"` : ''}`;
};

const IN_PAGE = `
  window.__describe = ${describe.toString()};
  window.__clipped = () => [...document.querySelectorAll('body *')].filter((el) => {
    const cs = getComputedStyle(el);
    if (![cs.overflowX, cs.overflowY].some((o) => o === 'hidden' || o === 'clip')) return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1 || !el.textContent.trim()) return false;
    return el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
  }).map(window.__describe);
  // Only when the page itself scrolls sideways; content inside its own scroll box (wide tables) is fine.
  window.__overflowing = () => {
    const limit = document.documentElement.clientWidth + 1;
    if (document.documentElement.scrollWidth <= limit) return [];
    const scrollsInside = (el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        if (['auto', 'scroll'].includes(getComputedStyle(p).overflowX)) return true;
      }
      return false;
    };
    const wide = [...document.querySelectorAll('body *')].filter((el) => el.getBoundingClientRect().right > limit && !scrollsInside(el));
    return wide.filter((el) => !wide.some((other) => other !== el && el.contains(other))).slice(0, 5).map(window.__describe);
  };
`;

async function prepare(page) {
  await page.addScriptTag({ content: IN_PAGE });
}

// ------------------------------------------------------------------ checks

async function documentChecks(page) {
  return page.evaluate(() => {
    const levels = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((h) => Number(h.tagName[1]));
    const skippedLevels = levels.filter((level, i) => i > 0 && level > levels[i - 1] + 1);
    const personal = [...document.querySelectorAll('input')].filter((input) =>
      ['email', 'password', 'tel'].includes(input.type) || /(^|_)(name|email|phone|mobile)$/i.test(input.name || input.id),
    );
    const tabbable = 'a[href], button, input:not([type=hidden]), select, textarea, [tabindex]';
    const targets = [...document.querySelectorAll(tabbable)].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    // 2.5.8: under 24×24 px fails only if a 24 px box centred on it overlaps another target;
    // links inside running text are exempt.
    const small = targets.filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.width >= 24 && r.height >= 24) return false;
      if (el.tagName === 'A' && el.closest('p, li') && el.closest('p, li').textContent.trim() !== el.textContent.trim()) return false;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const box = { left: cx - 12, right: cx + 12, top: cy - 12, bottom: cy + 12 };
      return targets.some((other) => {
        if (other === el || other.contains(el) || el.contains(other)) return false;
        const o = other.getBoundingClientRect();
        return o.left < box.right && o.right > box.left && o.top < box.bottom && o.bottom > box.top;
      });
    });
    return {
      title: document.title,
      lang: document.documentElement.lang,
      h1: levels.filter((level) => level === 1).length,
      skippedLevels: skippedLevels.length,
      positiveTabindex: [...document.querySelectorAll('[tabindex]')].filter((el) => el.tabIndex > 0).map(window.__describe),
      autocompleteMissing: personal.filter((input) => !input.getAttribute('autocomplete')).map(window.__describe),
      smallTargets: small.map((el) => `${window.__describe(el)} ${Math.round(el.getBoundingClientRect().width)}×${Math.round(el.getBoundingClientRect().height)}`),
    };
  });
}

async function keyboardChecks(page, path) {
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Tab');
  const firstStop = await page.evaluate(() => ({ text: document.activeElement?.textContent?.trim() ?? '', href: document.activeElement?.getAttribute('href') }));
  let skipLinkWorks = false;
  if (/skip/i.test(firstStop.text)) {
    await page.keyboard.press('Enter');
    skipLinkWorks = await page.evaluate(() => Boolean(document.activeElement?.closest('main')));
  }

  // Walk the whole tab order from the top of a fresh load. Not reload(): the skip link added #main
  // to the URL, and a load with a fragment starts sequential focus navigation at that target.
  await page.goto(`${APP_URL}${path}`, { waitUntil: 'networkidle' });
  await page.locator('h1').first().waitFor({ timeout: 60_000 });
  await prepare(page);
  // Every tabbable element gets a key (one per radio group: Tab stops on its checked radio).
  const expected = await page.evaluate(() => {
    const keys = new Map();
    [...document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, [tabindex]')]
      .filter((el) => {
        if (el.disabled || el.tabIndex < 0 || el.closest('[inert], [hidden]')) return false;
        // Inside a closed <details> only the summary is tabbable.
        const details = el.closest('details:not([open])');
        if (details && !el.closest('summary')) return false;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return !(r.width === 0 && r.height === 0) && cs.visibility !== 'hidden' && cs.display !== 'none';
      })
      .forEach((el, i) => {
        const key = el.type === 'radio' ? `radio:${el.name}` : `el:${i}`;
        el.dataset.a11yKey = key;
        if (!keys.has(key)) keys.set(key, window.__describe(el));
      });
    return Object.fromEntries(keys);
  });
  const visited = [];
  const noOutline = [];
  for (let i = 0; i < Object.keys(expected).length + 15; i++) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const outlined = (node) => {
        const cs = getComputedStyle(node);
        return cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
      };
      const cs = getComputedStyle(el);
      const shadow = cs.boxShadow && cs.boxShadow !== 'none';
      // A link stretched over a tile may draw the ring on the tile (:has(:focus-visible)); only an
      // outline counts there, since cards may have a shadow all the time.
      const ancestors = [el.parentElement, el.parentElement?.parentElement, el.parentElement?.parentElement?.parentElement];
      const indicated = outlined(el) || shadow || ancestors.some((node) => node && node !== document.body && outlined(node));
      return { key: el.dataset.a11yKey ?? window.__describe(el), name: window.__describe(el), indicated };
    });
    // Tab moves through the segments of a date input (month, day, year) on the same element.
    if (stop && stop.key === visited.at(-1)) continue;
    if (!stop || visited.includes(stop.key)) break;
    visited.push(stop.key);
    if (!stop.indicated) noOutline.push(stop.name);
  }
  return {
    skipLink: /skip/i.test(firstStop.text) ? (skipLinkWorks ? 'ok' : 'does not reach main') : 'missing',
    tabStops: visited.length,
    notReached: Object.entries(expected).filter(([key]) => !visited.includes(key)).map(([, name]) => name),
    noFocusIndicator: noOutline,
  };
}

const TEXT_SPACING = `* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }
p { margin-bottom: 2em !important; }`;

const results = [];
for (const [role, path] of pages) {
  const label = `${(role ?? 'guest').padEnd(10)} ${path}`;
  try {
    results.push(await check(role, path, label));
  } catch (error) {
    const message = error.message.split(/\r?\n/)[0];
    console.log(`  ERROR ${label} – ${message}`);
    results.push({ role: role ?? 'guest', path, error: message, problems: ['error'], smallTargets: [] });
  }
}
await browser.close();

async function check(role, path, label) {
  const result = { role: role ?? 'guest', path };

  // Desktop: document, keyboard, then text spacing on the same load.
  let context = await contextFor(browser, tokens, role, { viewport: DESKTOP });
  let page = await open(context, path);
  await prepare(page);
  Object.assign(result, await documentChecks(page));
  Object.assign(result, await keyboardChecks(page, path));
  await page.addStyleTag({ content: TEXT_SPACING });
  result.textSpacingClipped = await page.evaluate(() => window.__clipped());
  await context.close();

  // 1.4.4: text at 200 % (root font size) on the desktop width.
  context = await contextFor(browser, tokens, role, { viewport: DESKTOP });
  page = await open(context, path);
  await prepare(page);
  await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
  result.text200 = await page.evaluate(() => ({ overflow: window.__overflowing(), clipped: window.__clipped() }));
  await context.close();

  // 1.4.10: reflow at 320 CSS px.
  context = await contextFor(browser, tokens, role, { viewport: NARROW });
  page = await open(context, path);
  await prepare(page);
  result.reflow320 = await page.evaluate(() => window.__overflowing());
  await context.close();

  // The app's own high-contrast mode at 150 % text: axe colour contrast and the rest of the rules.
  context = await contextFor(browser, tokens, role, { viewport: DESKTOP, display: { textSize: '150', contrast: 'high', motion: 'reduce' } });
  page = await open(context, path);
  result.highContrastAxe = (await runAxe(page)).map((v) => `${v.id} (${v.nodes.length}×)`);
  await context.close();

  const problems = [
    result.lang ? null : 'no lang',
    result.h1 === 1 ? null : `${result.h1} h1`,
    result.skippedLevels ? `${result.skippedLevels} skipped heading level(s)` : null,
    result.skipLink === 'ok' ? null : `skip link ${result.skipLink}`,
    result.positiveTabindex.length ? `positive tabindex ${result.positiveTabindex.length}` : null,
    result.notReached.length ? `${result.notReached.length} not reached by Tab` : null,
    result.noFocusIndicator.length ? `${result.noFocusIndicator.length} without focus outline` : null,
    result.autocompleteMissing.length ? `${result.autocompleteMissing.length} without autocomplete` : null,
    result.textSpacingClipped.length ? `text spacing clips ${result.textSpacingClipped.length}` : null,
    result.text200.overflow.length || result.text200.clipped.length ? '200 % text overflows/clips' : null,
    result.reflow320.length ? `320 px overflow (${result.reflow320.length})` : null,
    result.highContrastAxe.length ? `high contrast: ${result.highContrastAxe.join(', ')}` : null,
  ].filter(Boolean);
  result.problems = problems;
  console.log(`  ${problems.length ? 'CHECK' : 'ok   '} ${label}  title "${result.title}"${problems.length ? ` – ${problems.join('; ')}` : ''}`);
  return result;
}

// 2.4.2: titles must tell apart the pages one user can open (their portal + the public pages).
// The same public page inside a portal (/jobs/3 → /candidate/jobs/3) may share its title.
const loaded = results.filter((r) => !r.error);
const publicPath = (path) => path.replace(/^\/candidate(?=\/jobs(\/\d+)?$)/, '');
const samePage = (a, b) => publicPath(a.path) === publicPath(b.path);
const shared = [];
for (const role of new Set(loaded.map((r) => r.role).filter((role) => role !== 'guest'))) {
  const visible = loaded.filter((r) => r.role === role || r.role === 'guest');
  visible.forEach((a, i) =>
    visible.slice(i + 1).forEach((b) => {
      if (a.title === b.title && !samePage(a, b) && (a.role === role || b.role === role)) shared.push(`${role}: "${a.title}" on ${a.path} and ${b.path}`);
    }),
  );
}
console.log(`\nPage titles: ${new Set(loaded.map((r) => r.title)).size} distinct for ${loaded.length} pages; ${shared.length ? `shared within one role: ${shared.join('; ')}` : 'none shared within one role'}`);
const smallTargets = results.reduce((n, r) => n + r.smallTargets.length, 0);
console.log(`Targets under 24×24 px without 2.5.8 spacing (advisory): ${smallTargets}`);
skipped.forEach((s) => console.log(`  skip  ${s}`));

const out = process.argv[2];
if (out) writeFileSync(out, JSON.stringify(results, null, 2));
process.exit(0);
