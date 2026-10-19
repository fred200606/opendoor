// Shared look of the guide PDFs in docs/guides/ (Run & Demo Guide, API & Integration Guide):
// styles, small HTML helpers, the architecture diagram and printing HTML to PDF with Chrome.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

export const esc = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const list = (items) => (items?.length ? `<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>` : '');
export const pre = (text, className = '') => `<pre class="${className}">${esc(text)}</pre>`;

export function trimLines(text, max) {
  const lines = text.split('\n');
  return lines.length <= max ? text : `${lines.slice(0, max).join('\n')}\n… (${lines.length - max} more lines)`;
}

export const architectureDiagram = `<svg class="diagram" viewBox="0 0 720 250" role="img" aria-label="Request path: browser to gateway to Core, Insights and the SOAP registry">
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

export const css = `
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

/** Writes the page to `htmlFile` and prints it to `pdf` (A4, outline, page numbers in the footer). */
export async function printPdf({ title, body, htmlFile, pdf, footer, extraCss = '' }) {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${title}</title><style>${css}${extraCss}</style></head>
<body>${body}</body></html>`;
  mkdirSync(dirname(htmlFile), { recursive: true });
  writeFileSync(htmlFile, html);
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome' });
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(htmlFile).href, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    mkdirSync(dirname(pdf), { recursive: true });
    await page.pdf({
      path: pdf,
      format: 'A4',
      preferCSSPageSize: true,
      printBackground: true,
      outline: true,
      tagged: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="width:100%;font:7.5pt 'Segoe UI',Arial,sans-serif;color:#57606a;padding:0 15mm;display:flex;justify-content:space-between"><span>${footer}</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
    });
  } finally {
    await browser.close();
  }
}
