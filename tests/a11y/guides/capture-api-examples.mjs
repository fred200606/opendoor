// Real request/response examples for the API & Integration Guide (docs/guides/), taken from a
// running local stack: successes, every common error, CORS, the rate limit, the gateway with a
// service down (a second gateway on a spare port, so the running one is not touched), SOAP
// messages and faults. Run after capture-walkthrough.mjs on the same freshly seeded test database
// (some examples need its state: the candidate has applied to and been hired for Data Encoder).
//   DEMO_PASSWORD=… node guides/capture-api-examples.mjs
// Output: tests/a11y/results/guides/api-examples.json (git-ignored). Secrets are hidden as in the
// walkthrough capture.

import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const OUT = join(HERE, '..', 'results', 'guides');
const GATEWAY = (process.env.GATEWAY_URL ?? 'http://127.0.0.1:8080').replace(/\/+$/, '');
const CORE = (process.env.CORE_URL ?? 'http://127.0.0.1:8001').replace(/\/+$/, '');
const APP_ORIGIN = process.env.APP_ORIGIN ?? 'http://localhost:5173';
const PASSWORD = process.env.DEMO_PASSWORD;
if (!PASSWORD) {
  console.error('Set DEMO_PASSWORD (the seeded demo accounts).');
  process.exit(2);
}
const HIDDEN = '•••••• (hidden)';
const SHOWN_HEADERS = ['content-type', 'x-request-id', 'retry-after', 'ratelimit-limit', 'ratelimit-remaining', 'ratelimit-reset', 'ratelimit-policy', 'access-control-allow-origin', 'access-control-allow-methods', 'access-control-allow-headers', 'x-data-source', 'vary'];

function readEnv(file) {
  const values = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}
const coreEnv = readEnv(join(REPO, 'services', 'core-api', '.env'));

function redact(value, key = '') {
  if (Array.isArray(value)) {
    const kept = value.slice(0, 2).map((item) => redact(item));
    if (value.length > 2) kept.push(`… ${value.length - 2} more`);
    return kept;
  }
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, redact(item, name)]));
  if (/password/i.test(key)) return HIDDEN;
  if (key === 'token' && typeof value === 'string') return `${value.split('|')[0]}|${HIDDEN}`;
  if (typeof value === 'string' && value.length > 160) return `${value.slice(0, 157)}…`;
  return value;
}

const pretty = (text) => {
  try {
    return JSON.stringify(redact(JSON.parse(text)), null, 2);
  } catch {
    return text;
  }
};

/** One HTTP exchange as the guide shows it. */
async function call(id, title, { base = GATEWAY, method = 'GET', path, token, body, headers = {}, shownHeaders = {} }) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await response.text();
  const requestHeaders = {
    ...(token ? { Authorization: `Bearer ${token.split('|')[0]}|${HIDDEN}` } : {}),
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...shownHeaders,
  };
  const example = {
    id,
    title,
    request: { method, url: `${base}${path}`, headers: requestHeaders, body: body === undefined ? null : typeof body === 'string' ? body : JSON.stringify(redact(body), null, 2) },
    response: {
      status: response.status,
      headers: Object.fromEntries(SHOWN_HEADERS.filter((name) => response.headers.has(name)).map((name) => [name, response.headers.get(name)])),
      body: text ? pretty(text) : null,
    },
  };
  examples[id] = example;
  console.log(`  ${id}: ${method} ${path} → ${response.status}`);
  return { status: response.status, json: text ? safeJson(text) : null };
}

const safeJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const examples = {};
const login = async (email) => {
  const response = await fetch(`${GATEWAY}/api/login`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  return (await response.json()).token;
};

// ---------------------------------------------------------------- successes

console.log('Successes');
await call('health', 'Gateway health', { path: '/api/health' });
await call('login', 'Log in', { method: 'POST', path: '/api/login', body: { email: 'candidate@opendoor.test', password: PASSWORD } });
const t = {
  candidate: await login('candidate@opendoor.test'),
  employer: await login('employer@opendoor.test'),
  admin: await login('admin@opendoor.test'),
};
await call('me', 'The signed-in user', { path: '/api/me', token: t.candidate });
await call('search', 'Search with "Matches my needs"', { path: '/api/job-postings?match=1&sort=best', token: t.candidate });
const postings = (await (await fetch(`${GATEWAY}/api/job-postings`)).json()).data;
const byTitle = (title) => postings.find((posting) => posting.title === title);
const support = byTitle('Customer Support Associate (Chat)');
await call('posting', 'Posting details', { path: `/api/job-postings/${support.id}`, token: t.candidate });
await call('apply', 'Apply', {
  method: 'POST',
  path: `/api/job-postings/${support.id}/applications`,
  token: t.candidate,
  body: { cover_note: 'I answer customer chats quickly and clearly.', interview_request: 'Online interview with captions, please.' },
});
await call('trust-score', 'Trust score of an employer', { path: `/api/employers/${support.employer.id}/trust-score` });
await call('snapshot', 'Workplace Accessibility Snapshot (mashup)', { path: `/api/insights/job-postings/${support.id}` });
await call('regions', 'PSGC regions (location picker)', { path: '/api/insights/locations/regions' });
await call('internal', 'Core internal summary (Insights → Core)', {
  base: CORE,
  path: `/internal/job-postings/${support.id}/summary`,
  headers: { 'X-Service-Key': coreEnv.SERVICE_KEY_INSIGHTS },
  shownHeaders: { 'X-Service-Key': HIDDEN },
});

// ---------------------------------------------------------------- errors

console.log('Errors');
const dataEncoder = byTitle('Data Encoder');
const hired = (await (await fetch(`${GATEWAY}/api/applications?status=hired`, { headers: { Accept: 'application/json', Authorization: `Bearer ${t.candidate}` } })).json()).data.find(
  (application) => application.job_posting?.id === dataEncoder.id,
);
await call('e401', '401 – no token', { path: '/api/me' });
await call('e403', '403 – wrong role', { path: '/api/admin/users', token: t.candidate });
await call('e404', '404 – unknown posting', { path: '/api/job-postings/999999' });
await call('e404-internal', '404 – /internal is never routed by the gateway', { path: `/internal/job-postings/${support.id}/summary` });
await call('e409', '409 – applied twice', { method: 'POST', path: `/api/job-postings/${dataEncoder.id}/applications`, token: t.candidate, body: {} });
await call('e422', '422 – validation', { method: 'POST', path: '/api/register', body: { role: 'candidate', email: 'not-an-email', password: 'short' } });
if (hired) {
  await call('e422-transition', '422 – status change not allowed', { method: 'PATCH', path: `/api/applications/${hired.id}/status`, token: t.employer, body: { status: 'reviewed' } });
  await call('e422-feedback', '422 – feedback before day 30', {
    method: 'POST',
    path: `/api/applications/${hired.id}/feedback`,
    token: t.candidate,
    body: { items: [{ accommodation_id: dataEncoder.accommodations[0].id, rating: 'delivered' }] },
  });
}
for (let attempt = 1; attempt <= 6; attempt++) {
  const id = attempt === 6 ? 'e429' : attempt === 1 ? 'e422-login' : `login-wrong-${attempt}`;
  const result = await call(id, attempt === 6 ? '429 – too many log-in attempts' : '422 – wrong password', {
    method: 'POST',
    path: '/api/login',
    body: { email: 'nobody@opendoor.test', password: 'wrong-password' },
  });
  if (attempt > 1 && attempt < 6) delete examples[id];
  if (result.status === 429) break;
}

// ---------------------------------------------------------------- CORS

console.log('CORS');
await call('cors-allowed', 'Preflight from the app’s origin', {
  method: 'OPTIONS',
  path: '/api/login',
  headers: { Origin: APP_ORIGIN, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' },
  shownHeaders: { Origin: APP_ORIGIN, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' },
});
await call('cors-other', 'Preflight from another site', {
  method: 'OPTIONS',
  path: '/api/login',
  headers: { Origin: 'https://example.com', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' },
  shownHeaders: { Origin: 'https://example.com', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' },
});

// ---------------------------------------------------------------- a service down

console.log('A service down (second gateway on port 8099 with Core and Insights pointing at closed ports)');
const spare = spawn(process.execPath, ['src/server.js'], {
  cwd: join(REPO, 'gateway'),
  env: { ...process.env, PORT: '8099', CORE_URL: 'http://127.0.0.1:9', INSIGHTS_URL: 'http://127.0.0.1:9', CORS_ALLOWED_ORIGIN: APP_ORIGIN, NODE_ENV: 'development' },
  stdio: 'ignore',
});
try {
  for (let i = 0; i < 50; i++) {
    try {
      await fetch('http://127.0.0.1:8099/api/health');
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  await call('down-health', 'Health with Core and Insights down', { base: 'http://127.0.0.1:8099', path: '/api/health' });
  await call('down-core', 'Core down – any /api request', { base: 'http://127.0.0.1:8099', path: '/api/job-postings' });
} finally {
  spare.kill();
}

// ---------------------------------------------------------------- SOAP

console.log('SOAP');
function soap(registrationNumber, registryType, businessName, { password = coreEnv.REGISTRY_SOAP_PASSWORD } = {}) {
  const script = `
    $wsse = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd';
    $xml = '<wsse:Security xmlns:wsse="'.$wsse.'"><wsse:UsernameToken><wsse:Username>'.htmlspecialchars(getenv('REG_USER'), ENT_XML1).'</wsse:Username>'
      .'<wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">'
      .htmlspecialchars(getenv('REG_PASSWORD'), ENT_XML1).'</wsse:Password></wsse:UsernameToken></wsse:Security>';
    $client = new SoapClient(getenv('REG_WSDL'), ['soap_version' => SOAP_1_1, 'trace' => true, 'user_agent' => 'OpenDoor-Core/1.0']);
    $client->__setSoapHeaders([new SoapHeader($wsse, 'Security', new SoapVar($xml, XSD_ANYXML))]);
    try { $client->VerifyBusinessRegistration(['RegistrationNumber' => getenv('REG_NO'), 'RegistryType' => getenv('REG_TYPE'), 'BusinessName' => getenv('REG_NAME')]); } catch (SoapFault $f) {}
    echo $client->__getLastRequest(), "\\n=====\\n", $client->__getLastResponse();
  `;
  const output = execFileSync('php', ['-r', script], {
    env: {
      ...process.env,
      REG_USER: coreEnv.REGISTRY_SOAP_USER,
      REG_PASSWORD: password,
      REG_WSDL: coreEnv.REGISTRY_WSDL_URL || 'http://127.0.0.1:8003/soap?wsdl',
      REG_NO: registrationNumber,
      REG_TYPE: registryType,
      REG_NAME: businessName,
    },
  }).toString('utf8');
  const [request, response] = output.split('\n=====\n');
  const hide = (text) =>
    text
      .replace(/(<wsse:Password[^>]*>)[\s\S]*?(<\/wsse:Password>)/, `$1${HIDDEN}$2`)
      .replace(/(<wsse:Username>)[\s\S]*?(<\/wsse:Username>)/, `$1${HIDDEN}$2`);
  return { request: prettyXml(hide(request)), response: prettyXml(response.trim()) };
}

function prettyXml(xml) {
  let depth = 0;
  return xml
    .replace(/>\s*</g, '>\n<')
    .split('\n')
    .map((line) => {
      if (/^<\//.test(line)) depth = Math.max(0, depth - 1);
      const out = `${'  '.repeat(depth)}${line}`;
      if (/^<[^!?/][^>]*[^/]>$/.test(line) && !/<\/[^>]+>$/.test(line)) depth++;
      return out;
    })
    .join('\n');
}

const soapExamples = {
  active: soap('CS201912345', 'SEC', 'Kalinga Foods Inc.'),
  expired: soap('1234567', 'DTI', 'Sari-Sari Digital Services'),
  notFound: soap('9999999', 'DTI', 'Unknown Trading'),
  validation: soap('AB', 'DTI', 'Too Short Number'),
  authentication: soap('CS201912345', 'SEC', 'Kalinga Foods Inc.', { password: 'a-wrong-password' }),
};
console.log(`  ${Object.keys(soapExamples).length} SOAP exchanges`);

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'api-examples.json'), JSON.stringify({ generated_at: new Date().toISOString(), http: examples, soap: soapExamples }, null, 2));
console.log(`Saved to ${join(OUT, 'api-examples.json')}`);
