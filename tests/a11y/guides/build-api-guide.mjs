// Builds docs/guides/OpenDoor-API-and-Integration-Guide.pdf from api-guide-content.mjs, the
// endpoint contract docs/openapi.yaml and the real exchanges that capture-api-examples.mjs saved in
// tests/a11y/results/guides/api-examples.json (HTML printed to PDF by Chrome).
//   node guides/build-api-guide.mjs
// The YAML parser is borrowed from the gateway's dev dependencies (js-yaml, installed with eslint).

import { execSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as C from './api-guide-content.mjs';
import { architectureDiagram, esc, list, pre, printPdf, trimLines } from './guide-common.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const OUT = join(HERE, '..', 'results', 'guides');
const PDF = join(REPO, 'docs', 'guides', 'OpenDoor-API-and-Integration-Guide.pdf');

const yaml = createRequire(join(REPO, 'gateway', 'package.json'))('js-yaml');
const spec = yaml.load(readFileSync(join(REPO, 'docs', 'openapi.yaml'), 'utf8'));
const examples = JSON.parse(readFileSync(join(OUT, 'api-examples.json'), 'utf8'));
const commit = execSync('git rev-parse --short HEAD', { cwd: REPO }).toString().trim();
const dateOf = (iso) => new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', dateStyle: 'long' }).format(new Date(iso));
const generated = dateOf(new Date().toISOString());
const captured = dateOf(examples.generated_at);

// ------------------------------------------------------------------ OpenAPI → endpoint tables

const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

function resolve(node) {
  let current = node;
  const seen = new Set();
  while (current?.$ref && !seen.has(current.$ref)) {
    seen.add(current.$ref);
    current = current.$ref.replace(/^#\//, '').split('/').reduce((object, key) => object?.[key], spec);
  }
  return current;
}

const refName = (node) => node?.$ref?.split('/').pop();

/** Short description of a schema: a component name, or the field names (required ones marked *). */
function shape(schema, depth = 0) {
  if (!schema) return '';
  const name = refName(schema);
  const resolved = resolve(schema);
  if (name && depth > 0) return `<code>${name}</code>`;
  if (name && !/Input$/.test(name)) return `<code>${name}</code>`;
  if (resolved.allOf) return resolved.allOf.map((part) => shape(part, depth + 1)).filter(Boolean).join(' + ');
  if (resolved.oneOf) return resolved.oneOf.map((part) => shape(part, depth + 1)).join(' or ');
  if (resolved.type === 'array') return `[${shape(resolved.items, depth + 1)}]`;
  if (resolved.properties) {
    const required = new Set(resolved.required ?? []);
    const fields = Object.keys(resolved.properties).map((field) => `${field}${required.has(field) ? '*' : ''}`);
    const shown = fields.length > 9 ? [...fields.slice(0, 9), `+${fields.length - 9}`] : fields;
    return `{${shown.join(', ')}}`;
  }
  if (resolved.type === 'object') return 'object';
  return resolved.type ? `${resolved.type}` : '';
}

function requestOf(operation) {
  const body = resolve(operation.requestBody);
  if (!body?.content) return '–';
  const [mediaType, media] = Object.entries(body.content)[0];
  const fields = shape(media.schema);
  return mediaType === 'application/json' ? fields : `${fields} <span class="note">(${mediaType})</span>`;
}

function successOf(operation) {
  const [status, response] = Object.entries(operation.responses ?? {}).find(([code]) => /^2/.test(code)) ?? [];
  if (!status) return '–';
  const resolved = resolve(response);
  const media = resolved?.content && Object.values(resolved.content)[0];
  return `<b>${status}</b> ${media ? shape(media.schema) : status === '204' ? 'no body' : esc(resolved?.description ?? '')}`;
}

const errorsOf = (operation) =>
  Object.keys(operation.responses ?? {})
    .filter((code) => !/^2/.test(code))
    .join(', ') || '–';

function whoOf(method, path, operation) {
  const key = `${method.toUpperCase()} ${path}`;
  if (C.who[key]) return C.who[key];
  if (path.startsWith('/internal')) return 'Service key';
  if (path.startsWith('/admin')) return 'Admin';
  if (path.startsWith('/candidate')) return 'Candidate';
  if (path.startsWith('/employer/')) return 'Employer';
  const security = operation.security ?? spec.security;
  if (Array.isArray(security) && (security.length === 0 || security.some((item) => Object.keys(item).length === 0))) return 'Public';
  return 'Signed in';
}

const byTag = new Map(spec.tags.map((tag) => [tag.name, []]));
for (const [path, item] of Object.entries(spec.paths)) {
  for (const method of METHODS) {
    const operation = item[method];
    if (!operation) continue;
    const tag = operation.tags?.[0] ?? 'Other';
    if (!byTag.has(tag)) byTag.set(tag, []);
    byTag.get(tag).push({ method, path, operation });
  }
}
const operationCount = [...byTag.values()].reduce((sum, operations) => sum + operations.length, 0);

const endpointTables = [...byTag.entries()]
  .filter(([, operations]) => operations.length)
  .map(
    ([tag, operations]) => `<div class="endpoints"><h3>${esc(tag)}</h3>
    <table class="grid small endpoints__table">
      <colgroup><col style="width:29%"><col style="width:12%"><col style="width:19%"><col style="width:20%"><col style="width:12%"><col style="width:8%"></colgroup>
      <thead><tr><th>Method and path</th><th>Who</th><th>What</th><th>Request</th><th>Success</th><th>Errors</th></tr></thead>
      <tbody>${operations
        .map(({ method, path, operation }) => {
          const fullPath = path.startsWith('/internal') ? path : `/api${path}`;
          return `<tr><td class="ep"><span class="verb verb--${method}">${method.toUpperCase()}</span> <code>${esc(fullPath)}</code></td><td>${whoOf(method, path, operation)}</td><td>${esc(operation.summary ?? '')}</td><td>${requestOf(operation)}</td><td>${successOf(operation)}</td><td>${errorsOf(operation)}</td></tr>`;
        })
        .join('')}</tbody>
    </table></div>`,
  )
  .join('');

// ------------------------------------------------------------------ examples

function exchange(id, { maxLines = 26 } = {}) {
  const example = examples.http[id];
  if (!example) return `<p class="note">(example "${id}" was not captured)</p>`;
  const { request, response } = example;
  const requestText = [`${request.method} ${request.url}`, ...Object.entries(request.headers).map(([name, value]) => `${name}: ${value}`)].join('\n') + (request.body ? `\n\n${request.body}` : '');
  const responseText = [`HTTP ${response.status}`, ...Object.entries(response.headers).map(([name, value]) => `${name}: ${value}`)].join('\n') + (response.body ? `\n\n${trimLines(response.body, maxLines)}` : '');
  return `<div class="exchange"><div><div class="exchange__label">Request</div>${pre(requestText, 'code')}</div><div><div class="exchange__label">Response</div>${pre(responseText, 'code')}</div></div>`;
}

// ------------------------------------------------------------------ sequence diagrams

function sequence(flow) {
  const lanes = C.participants.filter(([id]) => flow.some(([from, to]) => from === id || to === id));
  const width = 720;
  const laneX = new Map(lanes.map(([id], index) => [id, 60 + index * ((width - 120) / Math.max(1, lanes.length - 1))]));
  const top = 46;
  const row = 27;
  const height = top + flow.length * row + 18;
  const parts = [];
  for (const [id, label] of lanes) {
    const x = laneX.get(id);
    parts.push(`<rect x="${x - 56}" y="4" width="112" height="28" rx="5" fill="${id === 'G' ? '#6a4c9c' : '#f3effa'}" stroke="#6a4c9c"/>`);
    parts.push(`<text x="${x}" y="22" text-anchor="middle" font-weight="700" font-size="${label.length > 16 ? 8.6 : 10.5}" fill="${id === 'G' ? '#fff' : '#1f2328'}">${esc(label)}</text>`);
    parts.push(`<line x1="${x}" y1="32" x2="${x}" y2="${height - 4}" stroke="#b7c0c9" stroke-dasharray="3 3"/>`);
  }
  flow.forEach(([from, to, label, kind], index) => {
    const y = top + index * row + 10;
    const x1 = laneX.get(from);
    const x2 = laneX.get(to);
    if (kind === 'self' || from === to) {
      const noteWidth = label.length * 5.2 + 14;
      const noteX = x1 + 6 + noteWidth > width - 4 ? x1 - 6 - noteWidth : x1 + 6;
      parts.push(`<rect x="${noteX}" y="${y - 12}" width="${noteWidth}" height="17" rx="3" fill="#fff8e6" stroke="#9a6700"/>`);
      parts.push(`<text x="${noteX + 7}" y="${y}" font-size="9.2">${esc(label)}</text>`);
      return;
    }
    const reply = kind === 'reply';
    parts.push(`<line x1="${x1}" y1="${y + 4}" x2="${x2 + (x2 > x1 ? -3 : 3)}" y2="${y + 4}" stroke="${reply ? '#57606a' : '#47306f'}" stroke-width="1.3" ${reply ? 'stroke-dasharray="5 3"' : ''} marker-end="url(#${reply ? 'seq-reply' : 'seq-arrow'})"/>`);
    // Labels start just right of the left end of the arrow; a long one may run past the next lane.
    const textX = Math.min(Math.min(x1, x2) + 6, width - 4 - label.length * 5);
    parts.push(`<text x="${textX}" y="${y}" font-size="9.2" fill="${reply ? '#57606a' : '#1f2328'}">${esc(label)}</text>`);
  });
  return `<svg class="sequence" viewBox="0 0 ${width} ${height}" role="img" aria-label="Sequence diagram">
    <defs>
      <marker id="seq-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#47306f"/></marker>
      <marker id="seq-reply" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10" fill="none" stroke="#57606a" stroke-width="1.5"/></marker>
    </defs>
    <g font-family="Segoe UI, Arial, sans-serif" fill="#1f2328">${parts.join('')}</g>
  </svg>`;
}

// ------------------------------------------------------------------ sections

const toc = [
  ['about', '1', 'About this guide'],
  ['architecture', '2', 'Architecture and request path'],
  ['basics', '3', 'API basics: format, authentication, CORS, limits'],
  ['reference', '4', `Endpoint reference (${operationCount} operations)`],
  ['errors', '5', 'Errors: envelope, codes and real examples'],
  ['soap', '6', 'Legacy integration: the SOAP Business Registry'],
  ['mashup', '7', 'The mashup: Workplace Accessibility Snapshot'],
  ['scenario', '8', 'End-to-end scenario through every component'],
  ...C.scenario.map((phase, index) => [`phase-${phase.id}`, `8.${index + 1}`, phase.title, true]),
  ['security', '9', 'Security summary'],
  ['questions', '10', 'Questions we expect, with answers'],
];

const cover = `<section class="cover">
  <div class="cover__band"><span class="cover__brand">OpenDoor</span><span class="cover__kind">API &amp; Integration Guide</span></div>
  <h1 class="cover__title">API &amp; Integration Guide</h1>
  <div class="cover__subtitle">${C.meta.subtitle}</div>
  <p class="cover__purpose">${C.meta.purpose}</p>
  <table class="cover__meta">
    <tr><th>Live system</th><td><a href="${C.production.app}">${C.production.app}</a></td></tr>
    <tr><th>API gateway</th><td><code>${C.production.gateway}/api</code></td></tr>
    <tr><th>Contract</th><td><code>docs/openapi.yaml</code> (OpenAPI 3.1) and the WSDL at <code>/soap?wsdl</code></td></tr>
    <tr><th>Examples</th><td>Captured ${captured} from the local stack</td></tr>
    <tr><th>Version</th><td>${generated} · commit <code>${commit}</code></td></tr>
  </table>
  <div class="cover__project">${C.meta.project}</div>
</section>`;

const contents = `<section class="toc"><h1>Contents</h1><ul class="toc__list">${toc
  .map(([id, no, title, sub]) => `<li class="${sub ? 'toc__sub' : 'toc__main'}"><a href="#${id}"><span class="toc__no">${no}</span>${title}</a></li>`)
  .join('')}</ul></section>`;

const about = `<section class="chapter" id="about">
  <h1><span class="no">1</span>About this guide</h1>
  <p class="lead">How OpenDoor’s parts talk to each other and to the outside world, for anyone who has to explain or extend the integration.</p>
  ${list([
    '<b>Companion:</b> the <i>Run &amp; Demo Guide</i> shows how to start the system and follows nine clicks from the screen to the database. This guide is the reference behind it.',
    '<b>Examples are real:</b> every request and response in sections 3–7 was sent to the running system (local stack, freshly seeded database). Long lists are shortened to 2 items.',
    '<b>Secrets</b> (passwords, tokens, the service key, the SOAP credentials) are shown as <code>•••••• (hidden)</code>.',
  ])}
</section>`;

const architecture = `<section class="chapter" id="architecture">
  <h1><span class="no">2</span>Architecture and request path</h1>
  ${architectureDiagram}
  <table class="grid">
    <thead><tr><th>Link</th><th>Style</th><th>Security</th></tr></thead>
    <tbody>
      <tr><td>Browser → Gateway</td><td>REST/JSON over HTTPS</td><td>CORS (app origin only), rate limit, bearer token passed through</td></tr>
      <tr><td>Gateway → Core, Insights</td><td>HTTP proxy, path unchanged, <code>X-Request-ID</code> and <code>X-Forwarded-For</code> added</td><td>Private network; the services are not public</td></tr>
      <tr><td>Insights → Core</td><td>REST/JSON <code>GET /internal/job-postings/{id}/summary</code></td><td><code>X-Service-Key</code> (constant-time compare)</td></tr>
      <tr><td>Core → Business Registry</td><td>SOAP 1.1 / XML, WSDL, document/literal</td><td>WS-Security UsernameToken</td></tr>
      <tr><td>Insights → PSGC, Nominatim, Overpass</td><td>REST/JSON over HTTPS (Overpass QL query)</td><td>Public APIs; User-Agent with contact email for Nominatim</td></tr>
      <tr><td>Core, Insights → MySQL</td><td>SQL (Eloquent / mysql2)</td><td>One database user per service: <code>opendoor_core</code>, <code>insights_cache</code></td></tr>
    </tbody>
  </table>
  <h2>Gateway routing</h2>
  <table class="grid"><thead><tr><th>Incoming path</th><th>Goes to</th><th>Timeout</th></tr></thead>
    <tbody>${C.routing.map(([path, target, timeout]) => `<tr><td>${path}</td><td>${target}</td><td>${timeout}</td></tr>`).join('')}</tbody></table>
  <p>The gateway does not read bodies or check tokens – it forwards them so uploads stream through and Core stays the single place that decides who may do what. When a service is down or slow, the gateway itself answers with the error envelope (503 / 502 / 504, section 5).</p>
</section>`;

const basics = `<section class="chapter" id="basics">
  <h1><span class="no">3</span>API basics: format, authentication, CORS, limits</h1>
  <table class="grid"><tbody>${C.basics.map(([name, text]) => `<tr><th>${name}</th><td>${text}</td></tr>`).join('')}</tbody></table>
  <h2>Log in and use the token</h2>
  ${exchange('login')}
  ${exchange('me', { maxLines: 18 })}
  <h2>Gateway health</h2>
  ${exchange('health')}
  <h2>CORS preflight</h2>
  <p>From the app’s origin the gateway allows the call; from any other site it answers without <code>Access-Control-Allow-Origin</code>, so the browser blocks the real request.</p>
  ${exchange('cors-allowed')}
  ${exchange('cors-other')}
</section>`;

const reference = `<section class="chapter" id="reference">
  <h1><span class="no">4</span>Endpoint reference</h1>
  <p class="lead">Generated from <code>docs/openapi.yaml</code>: ${operationCount} operations in ${[...byTag.values()].filter((operations) => operations.length).length} groups (M1–M13 are the SIA modules).</p>
  ${list([
    '<b>Who:</b> Public = no token; Signed in = any role; Candidate / Employer / Admin = that role only (403 otherwise); owner = only for their own data (Laravel Policy).',
    '<b>Request / Success:</b> JSON fields (<code>*</code> = required) or a schema name from <code>openapi.yaml</code> (<code>components/schemas</code>). Lists are <code>{data, meta}</code>, 12 per page.',
    '<b>Errors:</b> the HTTP statuses the operation documents; every one uses the envelope of section 5. 401 applies to every non-public operation and 429 to all.',
  ])}
  ${endpointTables}
</section>`;

const errors = `<section class="chapter" id="errors">
  <h1><span class="no">5</span>Errors: envelope, codes and real examples</h1>
  <p class="lead">Every error from every service – and from the gateway when a service cannot answer – has the same shape, so the app shows one kind of message and support can trace it by <code>request_id</code>.</p>
  ${pre('{\n  "error": {\n    "code": "ALREADY_APPLIED",\n    "message": "You have already applied to this posting.",\n    "request_id": "54045e98-7d4c-4f03-a21d-60841b55c7b6"\n  }\n}', 'code')}
  <p>422 validation errors keep Laravel’s <code>message</code> and <code>errors</code> (messages per field, shown next to the form fields) and add the envelope’s <code>code</code> and <code>request_id</code>.</p>
  <table class="grid"><thead><tr><th>HTTP</th><th>Code</th><th>When</th><th>Raised by</th></tr></thead>
    <tbody>${C.errorCodes.map(([status, code, when, by]) => `<tr><td>${status}</td><td><code>${code}</code></td><td>${when}</td><td>${by}</td></tr>`).join('')}</tbody></table>
  <h2>Real examples</h2>
  ${C.errorExamples.map(([id, why]) => `<div class="example"><h3>${esc(examples.http[id]?.title ?? id)}</h3><p>${why}</p>${exchange(id, { maxLines: 22 })}</div>`).join('')}
  <div class="example"><h3>Health with Core and Insights down</h3><p>The gateway keeps answering and reports which service is down.</p>${exchange('down-health')}</div>
</section>`;

const soapXml = (key, title, note) =>
  examples.soap[key] ? `<div class="example"><h3>${title}</h3>${note ? `<p>${note}</p>` : ''}${key === 'active' ? pre(examples.soap[key].request, 'code xml') : ''}${pre(examples.soap[key].response, 'code xml')}</div>` : '';

const soapSection = `<section class="chapter" id="soap">
  <h1><span class="no">6</span>Legacy integration: the SOAP Business Registry</h1>
  <table class="grid"><tbody>${C.soapFacts.map(([name, text]) => `<tr><th>${name}</th><td>${text}</td></tr>`).join('')}</tbody></table>
  <h2>As the admin sees it (REST)</h2>
  <p><code>PATCH /api/admin/employers/{id}/verify</code> with <code>{"action":"check"}</code> answers <code>{"registry": {"status", "registered_name", "name_match", "checked_at"}, "verified_at"}</code>; <code>approve</code> / <code>reject</code> (with <code>reason</code>) decide. The Run &amp; Demo Guide, steps 6.7–6.8, shows the screens, logs and database rows.</p>
  <h2>The SOAP messages (Core ↔ registry)</h2>
  ${soapXml('active', 'Request and response – an active SEC registration', 'Core’s request with the WS-Security header (user name and password hidden), then the registry’s answer.')}
  ${soapXml('expired', 'Response – an expired DTI registration')}
  ${soapXml('notFound', 'Response – an unknown number')}
  ${soapXml('validation', 'Fault – invalid input', 'Core turns this into 422 <code>REGISTRY_INVALID_REQUEST</code> with the registry’s reason.')}
  ${soapXml('authentication', 'Fault – wrong credentials', 'Core turns this into 502 <code>REGISTRY_AUTH_FAILED</code> and logs a hint to check <code>REGISTRY_SOAP_USER</code> / <code>REGISTRY_SOAP_PASSWORD</code>.')}
</section>`;

const mashup = `<section class="chapter" id="mashup">
  <h1><span class="no">7</span>The mashup: Workplace Accessibility Snapshot</h1>
  <p class="lead"><code>GET /api/insights/job-postings/{id}</code> (public) combines four sources into one answer: what the employer promises, what hired employees report, and what is really around the workplace.</p>
  <table class="grid small wrap"><thead><tr><th>Source</th><th>Gives</th><th>Call</th><th>Limits</th><th>Cache</th><th>When it fails</th></tr></thead>
    <tbody>${C.mashupSources.map((cells) => `<tr>${cells.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table>
  ${list([
    '<b>Order:</b> Core first (required) → PSGC → Nominatim → Overpass. The whole snapshot has a <b>12 s budget</b> (the gateway allows 15 s): a source still running at the deadline counts as <code>unavailable</code>, but its request goes on and fills the cache for the next visitor.',
    '<b>Cache:</b> Insights’ own MySQL database <code>insights_cache</code> (tables <code>geocode_cache</code>, <code>overpass_cache</code>, <code>psgc_cache</code>). Two visitors asking for the same place at once share one request. Posting data from Core is never cached.',
    '<b>Output:</b> <code>location</code>, <code>employer_claims</code> (accommodations by group), <code>community_verification</code> (trust score, null until published), <code>nearby_accessible</code> (nearest 3 per category within 500 m: transit stops, toilets, parking, other), <code>sources</code>, <code>disclaimer</code>, <code>generated_at</code>.',
  ])}
  <h2>The <code>sources</code> flags</h2>
  <table class="grid"><thead><tr><th>Value</th><th>Meaning</th></tr></thead><tbody>${C.sourceFlags.map(([flag, meaning]) => `<tr><td><code>${flag}</code></td><td>${meaning}</td></tr>`).join('')}</tbody></table>
  <h2>A real snapshot</h2>
  ${exchange('snapshot', { maxLines: 60 })}
  <h2>Insights → Core: the internal summary</h2>
  <p>The service-to-service call behind the snapshot. Called directly on Core (the gateway never routes <code>/internal</code>; without the key Core answers 401).</p>
  ${exchange('internal', { maxLines: 40 })}
  <h2>Location lists (PSGC)</h2>
  <p><code>GET /api/insights/locations/{regions|provinces|cities}?parent=&lt;10-digit code&gt;</code> feeds the location pickers. <code>X-Data-Source</code> says where the list came from: <code>cached</code>, <code>ok</code>, <code>stale</code> or <code>fallback</code> (lists bundled with the service).</p>
  ${exchange('regions', { maxLines: 20 })}
</section>`;

const lanes = C.participants.map(([, label]) => label).join(' · ');
const scenario = `<section class="chapter" id="scenario">
  <h1><span class="no">8</span>End-to-end scenario through every component</h1>
  <p class="lead">One employer and one candidate from registration to a published trust score. Each phase shows the calls in order; solid arrows are requests, dashed arrows answers.</p>
  <p class="note">Participants: ${lanes} (External APIs = PSGC, Nominatim, Overpass).</p>
  ${C.scenario
    .map(
      (phase, index) => `<div class="phase" id="phase-${phase.id}"><h2><span class="no">8.${index + 1}</span>${phase.title}</h2><p>${phase.text}</p>${sequence(phase.flow)}</div>`,
    )
    .join('')}
</section>`;

const securitySection = `<section class="chapter" id="security">
  <h1><span class="no">9</span>Security summary</h1>
  <table class="grid"><tbody>${C.security.map(([area, text]) => `<tr><th>${area}</th><td>${text}</td></tr>`).join('')}</tbody></table>
</section>`;

const questions = `<section class="chapter" id="questions">
  <h1><span class="no">10</span>Questions we expect, with answers</h1>
  ${C.questions.map(([question, answer], index) => `<div class="qa"><p class="qa__q"><span class="qa__no">Q${index + 1}</span>${question}</p><p class="qa__a">${answer}</p></div>`).join('')}
</section>`;

const extraCss = `
h3 { font-size: 10.5pt; margin: 4mm 0 1.5mm; color: #47306f; break-after: avoid; }
.endpoints { margin-bottom: 2mm; }
.endpoints__table { table-layout: fixed; }
table.endpoints__table td, table.endpoints__table th { word-break: normal; overflow-wrap: break-word; }
table.endpoints__table td.ep code { overflow-wrap: anywhere; word-break: break-all; }
.endpoints__table code { font-size: 7.4pt; background: none; padding: 0; }
.verb { display: inline-block; min-width: 10mm; font-weight: 700; font-size: 6.8pt; letter-spacing: 0.02em; }
.verb--get { color: #1a7f37; } .verb--post { color: #0969da; } .verb--put { color: #9a6700; } .verb--patch { color: #8250df; } .verb--delete { color: #cf222e; }
.exchange { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; margin-bottom: 2.5mm; }
.exchange pre { font-size: 7pt; height: auto; }
.exchange__label { font-size: 8pt; font-weight: 700; color: #57606a; margin-bottom: 0.8mm; text-transform: uppercase; letter-spacing: 0.04em; }
.example { break-inside: avoid; }
.phase { break-inside: avoid; margin-bottom: 4mm; }
svg.sequence { width: 100%; height: auto; border: 0.5pt solid #d0d7de; border-radius: 1.5mm; padding: 1mm; }
.qa { break-inside: avoid; margin-bottom: 3mm; }
h1 .no { min-width: 12mm; }
table.grid.wrap td, table.grid.wrap th { word-break: normal; overflow-wrap: break-word; }
.qa__q { font-weight: 700; margin-bottom: 1mm; }
.qa__no { display: inline-block; min-width: 9mm; color: #6a4c9c; }
.qa__a { margin-left: 9mm; }
`;

const body = `${cover}${contents}${about}${architecture}${basics}${reference}${errors}${soapSection}${mashup}${scenario}${securitySection}${questions}`;
await printPdf({ title: C.meta.title, body, htmlFile: join(OUT, 'api-guide.html'), pdf: PDF, footer: `${C.meta.title} · ${generated} · ${commit}`, extraCss });
console.log(`PDF: ${PDF} (${(statSync(PDF).size / 1024 / 1024).toFixed(1)} MB)`);
