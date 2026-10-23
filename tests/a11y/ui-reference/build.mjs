// Builds docs/ui-reference/OpenDoor-UI-Reference.pdf from content.mjs and the screenshots that
// capture.mjs saved in tests/a11y/results/ui-reference/ (HTML printed to PDF by Chrome).
//   node ui-reference/build.mjs

import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import * as C from './content.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'results', 'ui-reference');
const REPO = join(HERE, '..', '..', '..');
const PDF = join(REPO, 'docs', 'ui-reference', 'OpenDoor-UI-Reference.pdf');
const manifest = JSON.parse(readFileSync(join(OUT, 'manifest.json'), 'utf8'));
const MM_PER_PX = 180 / manifest.viewport.width; // desktop shots fill the 180 mm text width

const commit = execSync('git rev-parse --short HEAD', { cwd: REPO }).toString().trim();
const generated = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', dateStyle: 'long' }).format(new Date(manifest.generated_at));

// ------------------------------------------------------------------ helpers

const list = (items, className = '') => (items?.length ? `<ul class="${className}">${items.map((item) => `<li>${item}</li>`).join('')}</ul>` : '');
const tag = (text, kind) => `<span class="tag tag--${kind}">${text}</span>`;

function figures(shotId, caption) {
  const shot = manifest.shots[shotId];
  if (!shot) throw new Error(`No screenshot "${shotId}" – run capture.mjs first`);
  const total = shot.files.length;
  return shot.files
    .map((file, index) => {
      const part = total > 1 ? ` – part ${index + 1} of ${total}` : '';
      const text = `${caption ?? 'Screenshot'}${part} <span class="figure__path">${shot.path}</span>`;
      return `<figure class="shot"><img src="shots/${file}" alt=""><figcaption>${text}</figcaption></figure>`;
    })
    .join('');
}

function cropImage(id) {
  const crop = manifest.crops[id];
  if (!crop) return '';
  const width = Math.min(180, crop.width * MM_PER_PX).toFixed(1);
  return `<img class="crop" src="shots/${crop.file}" alt="" style="width:${width}mm">`;
}

// ------------------------------------------------------------------ numbering and contents

const screenSections = C.sections.map((section, index) => ({ ...section, number: index + 3 }));
const N = { planned: 9, foundations: 10, components: 11, gallery: 8 };

const toc = [
  ['about', '1', 'About this document'],
  ['overview', '2', 'Users, modules and what is new'],
  ...screenSections.flatMap((section) => [
    [section.id, String(section.number), section.title],
    ...section.screens.map((screen, index) => [screen.id, `${section.number}.${index + 1}`, screen.title, true]),
  ]),
  ['gallery', String(N.gallery), 'Dialogs, states and phone layout'],
  ['planned', String(N.planned), 'Email notifications'],
  ['foundations', String(N.foundations), 'Design foundations'],
  ['components', String(N.components), 'Shared components'],
  ['appendix-a', 'A', 'Route map'],
  ['appendix-b', 'B', 'Labels and statuses'],
  ['appendix-c', 'C', 'Notification texts'],
  ['appendix-d', 'D', 'Accessibility rules to keep'],
  ['appendix-e', 'E', 'Demo accounts'],
];

// ------------------------------------------------------------------ page parts

const cover = `
<section class="cover">
  <div class="cover__band"><span class="cover__brand">OpenDoor</span><span class="cover__kind">UI reference · backup copy</span></div>
  <h1 class="cover__title">${C.meta.title}</h1>
  <p class="cover__subtitle">${C.meta.subtitle}</p>
  <p class="cover__purpose">${C.meta.purpose}</p>
  <table class="cover__meta">
    <tr><th>Prepared</th><td>${generated}</td></tr>
    <tr><th>Built from</th><td>commit <code>${commit}</code> (branch <code>main</code>), local stack with the seeded demo data</td></tr>
    <tr><th>Contents</th><td>4 user roles · 13 modules · ${C.sections.reduce((sum, section) => sum + section.screens.length, 0)} screens · ${Object.keys(manifest.shots).length} screenshots · ${C.components.length} shared components</td></tr>
    <tr><th>Status</th><td>Backup reference for the team's UI work. The running application and <code>docs/openapi.yaml</code> stay the source of truth.</td></tr>
  </table>
  <p class="cover__project">SIA 1 and IPT final project · PWD job-matching platform</p>
</section>`;

const contents = `
<section class="toc">
  <h1 class="toc__title">Contents</h1>
  <ol class="toc__list">
    ${toc
      .map(([id, number, title, sub]) => `<li class="${sub ? 'toc__sub' : 'toc__main'}"><a href="#${id}"><span class="toc__no">${number}</span>${title}</a></li>`)
      .join('')}
  </ol>
</section>`;

const about = `
<section class="chapter" id="about">
  <h1><span class="no">1</span>About this document</h1>
  <p class="lead">${C.meta.purpose}</p>
  <h2>How to read the screen pages</h2>
  ${list(C.howToRead)}
  <h2>System in one paragraph</h2>
  <p>OpenDoor matches persons with disabilities (PWDs) with employers by the <strong>workplace accommodations</strong> a job offers and the job seeker needs, and lets hired employees confirm 30 days later whether those accommodations were really provided (the employer's <strong>trust score</strong>). The React app talks only to the API gateway; behind it the Laravel Core Service holds the data, the Insights Service builds the Workplace Accessibility Snapshot from public map and place data, and a SOAP business registry checks employer registrations.</p>
</section>`;

const overview = `
<section class="chapter" id="overview">
  <h1><span class="no">2</span>Users, modules and what is new</h1>
  <h2>User roles</h2>
  <div class="roles">
    ${C.roles
      .map(
        (role) => `<div class="role"><h3>${role.name}</h3><p class="role__label">${role.label}</p><p>${role.does}</p><p class="role__nav"><strong>Navigation:</strong> ${role.nav}</p></div>`,
      )
      .join('')}
  </div>
  <h2>Modules and features</h2>
  <table class="grid modules">
    <thead><tr><th>#</th><th>Module</th><th>Features</th><th>Users</th><th>Screens</th></tr></thead>
    <tbody>${C.modules.map((row) => `<tr>${row.map((cell, index) => `<${index === 0 ? 'th' : 'td'}>${cell}</${index === 0 ? 'th' : 'td'}>`).join('')}</tr>`).join('')}</tbody>
  </table>
  <h2>What is new since the first screen list</h2>
  <table class="grid">
    <thead><tr><th>Date (2026)</th><th>Feature</th><th>What changed for the UI</th></tr></thead>
    <tbody>${C.whatsNew.map(([date, feature, text]) => `<tr><td class="nowrap">${date}</td><td>${feature}</td><td>${text}</td></tr>`).join('')}</tbody>
  </table>
  <h2>Business rules that shape the screens</h2>
  ${list(C.rules)}
</section>`;

function screenPage(section, screen, index) {
  const number = `${section.number}.${index + 1}`;
  const meta = [
    ['Route', `<code>${screen.route}</code>`],
    ['Who', screen.who],
    ['Purpose', screen.purpose],
  ];
  const blocks = [
    ['On the screen', screen.parts],
    ['Actions', screen.actions],
    ['Messages and states', screen.states],
  ].filter(([, items]) => items?.length);

  return `
  <section class="screen" id="${screen.id}">
    <h2><span class="no">${number}</span>${screen.title}${screen.isNew ? ` ${tag('New', 'new')}` : ''}</h2>
    <table class="meta">${meta.map(([label, value]) => `<tr><th>${label}</th><td>${value}</td></tr>`).join('')}</table>
    ${blocks.map(([title, items]) => `<p class="label">${title}</p>${list(items)}`).join('')}
    ${screen.api?.length ? `<p class="label">API</p>${list(screen.api.map((call) => `<code>${call}</code>`), 'api')}` : ''}
    ${screen.shots.map(([id, caption]) => figures(id, caption)).join('')}
  </section>`;
}

const screens = screenSections
  .map(
    (section) => `
<section class="chapter" id="${section.id}">
  <h1><span class="no">${section.number}</span>${section.title}</h1>
  <p class="lead">${section.intro}</p>
  ${section.screens.map((screen, index) => screenPage(section, screen, index)).join('')}
</section>`,
  )
  .join('');

const gallery = `
<section class="chapter" id="gallery">
  <h1><span class="no">${N.gallery}</span>Dialogs, states and phone layout</h1>
  <p class="lead">Patterns the new UI must keep. Most of them already appear on the screen pages; here they are side by side.</p>
  ${C.gallery
    .map(
      (item, index) => `<div class="pattern"><h2><span class="no">${N.gallery}.${index + 1}</span>${item.title}</h2><p>${item.text}</p>${item.shots.map((id) => figures(id)).join('')}</div>`,
    )
    .join('')}
  <div class="pattern">
    <h2><span class="no">${N.gallery}.${C.gallery.length + 1}</span>${C.phones.title}</h2>
    <p>${C.phones.text}</p>
    <div class="phones">${C.phones.shots
      .map(([id, caption]) => `<figure class="phone"><img src="shots/${manifest.shots[id].files[0]}" alt=""><figcaption>${caption}</figcaption></figure>`)
      .join('')}</div>
  </div>
</section>`;

const planned = `
<section class="chapter" id="planned">
  <h1><span class="no">${N.planned}</span>Email notifications ${tag('New', 'new')}</h1>
  <p class="lead">${C.planned.intro}</p>
  <table class="meta wide">${C.planned.items.map(([title, text]) => `<tr><th>${title}</th><td>${text}</td></tr>`).join('')}</table>
</section>`;

const foundations = `
<section class="chapter" id="foundations">
  <h1><span class="no">${N.foundations}</span>Design foundations</h1>
  <p class="lead">Current values from <code>frontend/src/styles/tokens.css</code>. Contrast ratios are against white. A new visual design may change them, but must keep the contrast levels.</p>
  <h2>Colour tokens</h2>
  <table class="grid tokens">
    <thead><tr><th></th><th>Token</th><th>Value</th><th>Use</th></tr></thead>
    <tbody>${C.tokens.map(([name, value, use]) => `<tr><td><span class="swatch" style="background:${value}"></span></td><td><code>${name}</code></td><td><code>${value}</code></td><td>${use}</td></tr>`).join('')}</tbody>
  </table>
  <h2>Type, layout and behaviour</h2>
  <table class="meta wide">${C.foundations.map(([title, text]) => `<tr><th>${title}</th><td>${text}</td></tr>`).join('')}</table>
</section>`;

const components = `
<section class="chapter" id="components">
  <h1><span class="no">${N.components}</span>Shared components</h1>
  <p class="lead">Building blocks in <code>frontend/src/components</code>, reused across the screens. The pictures are cut from the screenshots at their real size.</p>
  ${C.components
    .map(
      (component) => `
    <div class="component">
      <h2>${component.name}</h2>
      <p>${component.purpose}</p>
      ${component.notes ? `<p class="note">${component.notes}</p>` : ''}
      ${component.crop ? cropImage(component.crop) : ''}
    </div>`,
    )
    .join('')}
</section>`;

const appendices = `
<section class="chapter" id="appendix-a">
  <h1><span class="no">A</span>Route map</h1>
  <p class="lead">Signed-in users who open a page of another role are sent to their own dashboard; guests who open a protected page are sent to Log in and come back after logging in.</p>
  <table class="grid small compact">
    <thead><tr><th>Route</th><th>Screen</th><th>Who</th></tr></thead>
    <tbody>${C.routes.map(([route, screen, who]) => `<tr><td><code>${route}</code></td><td>${screen}</td><td>${who}</td></tr>`).join('')}</tbody>
  </table>
</section>
<section class="chapter" id="appendix-b">
  <h1><span class="no">B</span>Labels and statuses</h1>
  <p class="lead">API values and the words the user sees. Badge = icon and colour of the status badge.</p>
  <div class="vocab">
  ${C.vocabulary
    .map(
      ([title, rows]) => `<table class="grid small"><caption>${title}</caption><thead><tr><th>API value</th><th>Shown as</th>${rows.some((row) => row[2]) ? '<th>Badge</th>' : ''}</tr></thead><tbody>${rows
        .map(([value, label, badge]) => `<tr><td><code>${value}</code></td><td>${label}</td>${rows.some((row) => row[2]) ? `<td>${badge}</td>` : ''}</tr>`)
        .join('')}</tbody></table>`,
    )
    .join('')}
  </div>
</section>
<section class="chapter" id="appendix-c">
  <h1><span class="no">C</span>Notification texts</h1>
  <p class="lead">Each notice has a message and a link; the emails repeat the same text (section ${N.planned}).</p>
  <table class="grid">
    <thead><tr><th>To</th><th>When</th><th>Message</th><th>Opens</th></tr></thead>
    <tbody>${C.notices.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>
</section>
<section class="chapter" id="appendix-d">
  <h1><span class="no">D</span>Accessibility rules to keep</h1>
  <p class="lead">OpenDoor targets WCAG 2.1 AA (latest axe run October 23, 2026: 0 violations on 33 pages of every role; Lighthouse 100 on the public pages, October 11). Any new UI must keep these behaviours.</p>
  ${list(C.accessibilityRules)}
</section>
<section class="chapter" id="appendix-e">
  <h1><span class="no">E</span>Demo accounts</h1>
  <p class="lead">Seeded by <code>php artisan migrate:fresh --seed</code>. All use the password in <code>DEMO_PASSWORD</code> (Core <code>.env</code>, not written here).</p>
  <table class="grid">
    <thead><tr><th>Email</th><th>Name</th><th>Shown in the screenshots as</th></tr></thead>
    <tbody>${C.demoAccounts.map(([email, name, note]) => `<tr><td><code>${email}</code></td><td>${name}</td><td>${note}</td></tr>`).join('')}</tbody>
  </table>
  <h2>Rebuilding this document</h2>
  ${list([
    'Start the stack on a freshly seeded Core database (a copy such as <code>opendoor_core_test</code> keeps the main local data untouched).',
    'In <code>tests/a11y</code>: <code>node ui-reference/capture.mjs</code> (needs <code>DEMO_PASSWORD</code>; adds a few demo actions, then takes the screenshots), then <code>node ui-reference/build.mjs</code>.',
    'Screen texts live in <code>tests/a11y/ui-reference/content.mjs</code>.',
  ])}
</section>`;

// ------------------------------------------------------------------ styles

const css = `
@page { size: A4; margin: 15mm 15mm 17mm; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: 'Segoe UI', system-ui, Roboto, Arial, sans-serif; font-size: 9.6pt; line-height: 1.45; color: #1f2328; }
code { font-family: Consolas, 'Cascadia Mono', monospace; font-size: 0.92em; background: #f6f8fa; border-radius: 3px; padding: 0 0.2em; }
a { color: #6a4c9c; text-decoration: none; }
h1, h2, h3 { line-height: 1.25; break-after: avoid; }
h1 { font-size: 19pt; color: #47306f; margin: 0 0 4mm; padding-bottom: 2mm; border-bottom: 1.5pt solid #6a4c9c; }
h2 { font-size: 13pt; margin: 6mm 0 2.5mm; color: #1f2328; }
h3 { font-size: 10.5pt; margin: 3.5mm 0 1mm; color: #47306f; }
.label { font-size: 9pt; font-weight: 700; margin: 3.5mm 0 1mm; color: #47306f; text-transform: uppercase; letter-spacing: 0.04em; break-after: avoid; }
p { margin: 0 0 2.5mm; }
ul { margin: 0 0 2mm; padding-left: 5mm; }
li { margin: 0 0 0.8mm; }
.no { display: inline-block; min-width: 9mm; color: #6a4c9c; font-weight: 700; }
.lead { font-size: 10.5pt; color: #3a4048; }
.note { color: #57606a; font-size: 9pt; }
.nowrap { white-space: nowrap; }
.tag { display: inline-block; font-size: 7.5pt; font-weight: 700; letter-spacing: 0.03em; text-transform: uppercase; border-radius: 3mm; padding: 0.2mm 2mm; vertical-align: middle; border: 0.6pt solid; }
.tag--new { color: #116329; background: #effaf3; }
.tag--planned { color: #7a4100; background: #fff8e6; }

.chapter { break-before: page; }
.screen + .screen { break-before: page; }
.screen h2 { font-size: 14pt; margin-top: 2mm; padding: 2mm 3mm; background: #f6f8fa; border-left: 2.5pt solid #6a4c9c; }
.chapter > .screen:first-of-type h2 { margin-top: 5mm; }

table { border-collapse: collapse; width: 100%; }
table.meta th, table.meta td { text-align: left; vertical-align: top; padding: 1.2mm 2.5mm; border-bottom: 0.5pt solid #d0d7de; }
table.meta th { width: 24mm; color: #57606a; font-weight: 600; }
table.meta.wide th { width: 45mm; color: #1f2328; }
table.grid { margin: 0 0 4mm; font-size: 8.8pt; }
table.grid th, table.grid td { text-align: left; vertical-align: top; padding: 1.2mm 2mm; border: 0.5pt solid #d0d7de; }
table.grid thead th { background: #f6f8fa; font-weight: 600; }
table.grid tr { break-inside: avoid; }
table.grid caption { text-align: left; font-weight: 700; padding: 0 0 1mm; color: #47306f; }
table.modules tbody th { color: #6a4c9c; white-space: nowrap; }
table.small { font-size: 8.4pt; margin-bottom: 0; }
table.grid.compact th, table.grid.compact td { padding: 0.7mm 2mm; }
.vocab { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm 6mm; align-items: start; }
.vocab table { break-inside: avoid; }
.api { list-style: none; padding: 0; }
.api code { font-size: 8.3pt; }

figure.shot { margin: 4mm 0 0; break-inside: avoid; }
figure.shot img { display: block; width: 100%; max-height: 236mm; object-fit: contain; object-position: left top; border: 0.6pt solid #b7c0c9; }
figcaption { font-size: 8pt; color: #57606a; margin-top: 1.2mm; }
.figure__path { font-family: Consolas, monospace; margin-left: 2mm; color: #8a939c; }
.pattern { break-inside: avoid; margin-bottom: 4mm; }
.pattern + .pattern { break-before: page; }
.phones { display: flex; gap: 5mm; align-items: flex-start; }
figure.phone { margin: 0; flex: 1; }
figure.phone img { width: 100%; border: 0.6pt solid #b7c0c9; }

.roles { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
.role { border: 0.6pt solid #d0d7de; border-radius: 2mm; padding: 3mm 4mm; break-inside: avoid; }
.role h3 { text-transform: none; letter-spacing: 0; font-size: 11.5pt; margin: 0 0 0.5mm; color: #6a4c9c; }
.role__label { color: #57606a; font-size: 8.8pt; }
.role__nav { font-size: 8.6pt; margin: 0; }

.tokens td { vertical-align: middle; }
.swatch { display: inline-block; width: 9mm; height: 5mm; border-radius: 1mm; border: 0.5pt solid #8a939c; }
.component { break-inside: avoid; padding: 2mm 0 3mm; border-bottom: 0.5pt solid #d0d7de; }
.component h2 { margin: 2mm 0 1.5mm; font-size: 11.5pt; color: #6a4c9c; }
img.crop { display: block; max-width: 100%; margin-top: 2mm; border: 0.6pt dashed #8a939c; }

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
.toc__list { list-style: none; padding: 0; columns: 2; column-gap: 10mm; }
.toc__list li { break-inside: avoid; margin: 0; }
.toc__main { font-weight: 600; margin-top: 2.2mm !important; }
.toc__sub { padding-left: 9mm; font-size: 9pt; }
.toc__list a { color: #1f2328; }
.toc__no { display: inline-block; min-width: 9mm; color: #6a4c9c; }
`;

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${C.meta.title}</title><style>${css}</style></head>
<body>${cover}${contents}${about}${overview}${screens}${gallery}${planned}${foundations}${components}${appendices}</body></html>`;

writeFileSync(join(OUT, 'index.html'), html);

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome' });
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(join(OUT, 'index.html')).href, { waitUntil: 'load' });
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
console.log(`PDF: ${PDF} (${(statSync(PDF).size / 1024 / 1024).toFixed(1)} MB)`);
