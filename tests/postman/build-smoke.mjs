// Production smoke collection: the requests of OpenDoor.postman_collection.json that change no data.
//   node tests/postman/build-smoke.mjs   → tests/postman/OpenDoor.smoke.postman_collection.json
// Kept: GET requests, the demo logins, and requests the API must refuse (→ 401/403/404/422 in the
// name), which write nothing. Dropped: everything that creates, changes or deletes data, T13/T16
// (need a broken Overpass / Core's private address), any request that needs a value only a
// dropped request would set (e.g. the id or token of something created in the run), and reads
// that check what a dropped write did (AFTER_WRITE). Logins add API tokens; no business data changes.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const collection = JSON.parse(readFileSync(join(here, 'OpenDoor.postman_collection.json'), 'utf8'));
const environment = JSON.parse(readFileSync(join(here, 'production.postman_environment.json'), 'utf8'));

const REFUSED = /→ (401|403|404|422)\b/;
const EXCLUDED = [/^T13 /, /^T16 /, /Log out/, /Revoked token/, /^Forgot password/];
// Reads whose assertions describe the result of a write the smoke run does not make.
const AFTER_WRITE = [
  /^M12 Saved jobs list (shows it|is empty again)/,
  /^M12 Job details say it is saved/,
  /^T10 /,
  /now say "submitted"/,
  /shows the published score/,
  /^T14 The check is stored/,
  /shows the Verified badge/,
  /^The employer sees the reason/,
  /^Suspended employer/,
];

const scripts = (item) => (item.event ?? []).flatMap((e) => e.script?.exec ?? []).join('\n');
const urlOf = (item) => (typeof item.request.url === 'string' ? item.request.url : item.request.url.raw);
const textOf = (item) =>
  [
    urlOf(item),
    item.request.body?.raw ?? '',
    ...(item.request.header ?? []).map((h) => h.value),
    JSON.stringify(item.request.body?.formdata ?? []),
    JSON.stringify(item.request.auth ?? {}), // bearer tokens live here
  ].join('\n');

function uses(item) {
  const names = new Set();
  for (const [, name] of textOf(item).matchAll(/{{([^}$]+)}}/g)) names.add(name);
  for (const [, name] of scripts(item).matchAll(/(?:collectionVariables|variables)\.get\(['"]([^'"]+)['"]\)/g)) names.add(name);
  return names;
}
const sets = (item) => [...scripts(item).matchAll(/collectionVariables\.set\('([^']+)'/g)].map(([, name]) => name);

function readOnly(item) {
  const { method } = item.request;
  if ([...EXCLUDED, ...AFTER_WRITE].some((pattern) => pattern.test(item.name))) return false;
  if (method === 'GET') return true;
  if (method === 'POST' && /\/login$/.test(urlOf(item).split('?')[0])) return true;
  return REFUSED.test(item.name);
}

const known = new Set([...environment.values.map((v) => v.key), ...(collection.variable ?? []).filter((v) => v.value !== '' && v.value != null).map((v) => v.key)]);
const kept = [];
const dropped = [];
const folders = collection.item.map((folder) => {
  const items = folder.item.filter((item) => {
    const missing = [...uses(item)].filter((name) => !known.has(name));
    if (readOnly(item) && missing.length === 0) {
      sets(item).forEach((name) => known.add(name));
      kept.push(`${folder.name} · ${item.name}`);
      return true;
    }
    dropped.push(item.name);
    return false;
  });
  return { ...folder, item: items };
});

const smoke = {
  ...collection,
  info: { ...collection.info, name: `${collection.info.name} – production smoke (read-only)`, _postman_id: undefined },
  item: folders.filter((folder) => folder.item.length > 0),
};
writeFileSync(join(here, 'OpenDoor.smoke.postman_collection.json'), `${JSON.stringify(smoke, null, 2)}\n`);
console.log(`Wrote OpenDoor.smoke.postman_collection.json: ${kept.length} of ${kept.length + dropped.length} requests`);
for (const folder of smoke.item) console.log(`  ${folder.name} (${folder.item.length})`);
