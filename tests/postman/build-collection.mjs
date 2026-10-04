// Generates OpenDoor.postman_collection.json (Postman v2.1) from the compact definitions below.
// Add requests here, then run:  node tests/postman/build-collection.mjs
// Folder order and naming follow references/testing-devops.md; test-plan IDs (T01–T16) are in names.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------- shared test snippets

/** Runs after every request in the collection. */
const COLLECTION_TESTS = `
pm.test('has an X-Request-ID header', () => pm.expect(pm.response.headers.get('X-Request-ID')).to.match(/^[0-9a-f-]{36}$/i));
if (!pm.info.requestName.includes('[slow]')) {
  pm.test('responds within 1000 ms', () => pm.expect(pm.response.responseTime).to.be.below(1000));
}
`;

const status = (code) => `pm.test('status ${code}', () => pm.response.to.have.status(${code}));`;

/** Error envelope with the given code and a request_id that matches the header. */
const envelope = (code) => `
const body = pm.response.json();
pm.test('error.code is ${code}', () => pm.expect(body.error.code).to.eql('${code}'));
pm.test('error.request_id matches the header', () => pm.expect(body.error.request_id).to.eql(pm.response.headers.get('X-Request-ID')));
`;

/** 422 with Laravel field errors for `field`. */
const fieldError = (field) => `
${status(422)}
${envelope('VALIDATION_FAILED')}
pm.test('errors.${field} is present', () => pm.expect(body.errors).to.have.property('${field}'));
`;

const userSchema = `{
  type: 'object',
  required: ['id', 'name', 'email', 'role', 'is_active'],
  properties: {
    id: { type: 'integer' }, name: { type: 'string' }, email: { type: 'string' },
    role: { enum: ['candidate', 'employer', 'admin'] }, is_active: { type: 'boolean' }
  },
  additionalProperties: false
}`;

const authResponse = (role, tokenVar) => `
${status(200)}
const body = pm.response.json();
pm.test('returns a token and the user', () => {
  pm.expect(body.token).to.be.a('string').and.not.empty;
  pm.expect(body.user).to.be.jsonSchema(${userSchema});
});
pm.test('role is ${role}', () => pm.expect(body.user.role).to.eql('${role}'));
pm.collectionVariables.set('${tokenVar}', body.token);
`;

// ---------------------------------------------------------------- request builder

const bearer = (tokenVar) => ({ type: 'bearer', bearer: [{ key: 'token', value: `{{${tokenVar}}}`, type: 'string' }] });
const NO_AUTH = { type: 'noauth' };

function request(name, { method = 'GET', path, auth = NO_AUTH, body, tests, prerequest, description }) {
  const item = {
    name,
    request: {
      method,
      auth,
      header: [{ key: 'Accept', value: 'application/json' }],
      url: { raw: `{{baseUrl}}${path}`, host: ['{{baseUrl}}'], path: path.replace(/^\//, '').split('?')[0].split('/') },
      description,
    },
    event: [],
  };
  const query = path.split('?')[1];
  if (query) {
    item.request.url.query = query.split('&').map((pair) => {
      const [key, value = ''] = pair.split('=');
      return { key, value };
    });
  }
  if (body !== undefined) {
    item.request.header.push({ key: 'Content-Type', value: 'application/json' });
    item.request.body = { mode: 'raw', raw: JSON.stringify(body, null, 2), options: { raw: { language: 'json' } } };
  }
  if (prerequest) item.event.push({ listen: 'prerequest', script: { type: 'text/javascript', exec: prerequest.trim().split('\n') } });
  if (tests) item.event.push({ listen: 'test', script: { type: 'text/javascript', exec: tests.trim().split('\n') } });
  return item;
}

const folder = (name, description, item) => ({ name, description, item });

// ---------------------------------------------------------------- 01 Auth

const auth = folder('01 Auth', 'M1: register, login, me, password, logout. Demo passwords come from --env-var demoPassword.', [
  request('Gateway health', {
    path: '/health',
    tests: `
${status(200)}
const body = pm.response.json();
pm.test('core is up', () => pm.expect(body.services.core).to.eql('up'));
pm.test('status is ok or degraded', () => pm.expect(body.status).to.be.oneOf(['ok', 'degraded']));`,
  }),
  request('T01 Register candidate with consent → 201', {
    method: 'POST',
    path: '/register',
    prerequest: `pm.collectionVariables.set('newCandidateEmail', 'pm-candidate-' + Date.now() + '@opendoor.test');`,
    body: {
      name: 'Postman Candidate',
      email: '{{newCandidateEmail}}',
      password: 'postman-pass-123',
      password_confirmation: 'postman-pass-123',
      role: 'candidate',
      consent: true,
    },
    tests: `
${status(201)}
const body = pm.response.json();
pm.test('returns a token and a candidate user', () => {
  pm.expect(body.token).to.be.a('string').and.not.empty;
  pm.expect(body.user).to.be.jsonSchema(${userSchema});
  pm.expect(body.user.role).to.eql('candidate');
  pm.expect(body.user.email).to.eql(pm.collectionVariables.get('newCandidateEmail'));
});
pm.collectionVariables.set('newCandidateToken', body.token);`,
  }),
  request('T01 Log in as the new candidate → 200 with role', {
    method: 'POST',
    path: '/login',
    body: { email: '{{newCandidateEmail}}', password: 'postman-pass-123' },
    tests: authResponse('candidate', 'newCandidateLoginToken'),
  }),
  request('Register the same email again → 422 errors.email', {
    method: 'POST',
    path: '/register',
    body: { name: 'Again', email: '{{newCandidateEmail}}', password: 'postman-pass-123', password_confirmation: 'postman-pass-123', role: 'candidate', consent: true },
    tests: fieldError('email'),
  }),
  request('Register as admin → 422 errors.role', {
    method: 'POST',
    path: '/register',
    body: { name: 'Mallory', email: 'pm-admin-attempt@opendoor.test', password: 'postman-pass-123', password_confirmation: 'postman-pass-123', role: 'admin', consent: true },
    tests: fieldError('role'),
  }),
  request('Register without consent → 422 errors.consent', {
    method: 'POST',
    path: '/register',
    body: { name: 'No Consent', email: 'pm-no-consent@opendoor.test', password: 'postman-pass-123', password_confirmation: 'postman-pass-123', role: 'employer', consent: false },
    tests: fieldError('consent'),
  }),
  request('Log in demo admin → adminToken', {
    method: 'POST',
    path: '/login',
    body: { email: '{{adminEmail}}', password: '{{demoPassword}}' },
    tests: authResponse('admin', 'adminToken'),
  }),
  request('Log in demo employer → employerToken', {
    method: 'POST',
    path: '/login',
    body: { email: '{{employerEmail}}', password: '{{demoPassword}}' },
    tests: authResponse('employer', 'employerToken'),
  }),
  request('Log in demo candidate → candidateToken', {
    method: 'POST',
    path: '/login',
    body: { email: '{{candidateEmail}}', password: '{{demoPassword}}' },
    tests: authResponse('candidate', 'candidateToken'),
  }),
  request('Log in with a wrong password → 422 errors.email', {
    method: 'POST',
    path: '/login',
    body: { email: '{{newCandidateEmail}}', password: 'not-the-password' },
    tests: `
${fieldError('email')}
pm.test('no token is returned', () => pm.expect(body).to.not.have.property('token'));`,
  }),
  request('GET /me as candidate → 200, no password', {
    path: '/me',
    auth: bearer('candidateToken'),
    tests: `
${status(200)}
pm.test('matches the User schema exactly', () => pm.expect(pm.response.json()).to.be.jsonSchema(${userSchema}));
pm.test('role is candidate', () => pm.expect(pm.response.json().role).to.eql('candidate'));`,
  }),
  request('GET /me without a token → 401 UNAUTHENTICATED', {
    path: '/me',
    tests: `${status(401)}\n${envelope('UNAUTHENTICATED')}`,
  }),
  request('Change password with a wrong current password → 422', {
    method: 'PUT',
    path: '/me/password',
    auth: bearer('newCandidateToken'),
    body: { current_password: 'wrong-password', password: 'another-pass-123', password_confirmation: 'another-pass-123' },
    tests: fieldError('current_password'),
  }),
  request('Log out the new candidate → 204', {
    method: 'POST',
    path: '/logout',
    auth: bearer('newCandidateToken'),
    tests: status(204),
  }),
  request('Revoked token is rejected → 401', {
    path: '/me',
    auth: bearer('newCandidateToken'),
    tests: `${status(401)}\n${envelope('UNAUTHENTICATED')}`,
  }),
]);

// ---------------------------------------------------------------- 02 Master Data

const masterData = folder('02 Master Data', 'M11: public lists and admin CRUD (delete only if unused; accommodations are retired when in use).', [
  request('GET /categories → sorted list', {
    path: '/categories',
    tests: `
${status(200)}
const names = pm.response.json().data.map((c) => c.name);
pm.test('at least the 11 seeded categories', () => pm.expect(names.length).to.be.at.least(11));
pm.test('sorted by name', () => pm.expect(names).to.eql([...names].sort((a, b) => a.localeCompare(b))));`,
  }),
  request('GET /accommodations → grouped, active only', {
    path: '/accommodations',
    tests: `
${status(200)}
const groups = pm.response.json().data;
const order = ['physical_access', 'communication', 'work_arrangement', 'assistive_technology', 'support'];
pm.test('groups follow the RA 7277 order', () => {
  const seen = groups.map((g) => g.group);
  pm.expect(seen).to.eql(order.filter((g) => seen.includes(g)));
});
pm.test('each group has a label and items', () => groups.forEach((g) => { pm.expect(g.label).to.be.a('string'); pm.expect(g.items).to.be.an('array').that.is.not.empty; }));
pm.test('no retired accommodations', () => groups.forEach((g) => g.items.forEach((i) => pm.expect(i.is_retired).to.eql(false))));`,
  }),
  request('Admin creates a category → 201', {
    method: 'POST',
    path: '/admin/categories',
    auth: bearer('adminToken'),
    prerequest: `pm.collectionVariables.set('categoryName', 'Postman Category ' + Date.now());`,
    body: { name: '{{categoryName}}' },
    tests: `
${status(201)}
const body = pm.response.json();
pm.test('returns id and name', () => { pm.expect(body.id).to.be.a('number'); pm.expect(body.name).to.eql(pm.collectionVariables.get('categoryName')); });
pm.collectionVariables.set('categoryId', body.id);`,
  }),
  request('Duplicate category name → 422 errors.name', {
    method: 'POST',
    path: '/admin/categories',
    auth: bearer('adminToken'),
    body: { name: '{{categoryName}}' },
    tests: fieldError('name'),
  }),
  request('Admin renames the category → 200', {
    method: 'PUT',
    path: '/admin/categories/{{categoryId}}',
    auth: bearer('adminToken'),
    body: { name: '{{categoryName}} renamed' },
    tests: `
${status(200)}
pm.test('name changed', () => pm.expect(pm.response.json().name).to.eql(pm.collectionVariables.get('categoryName') + ' renamed'));`,
  }),
  request('Candidate cannot create categories → 403 FORBIDDEN', {
    method: 'POST',
    path: '/admin/categories',
    auth: bearer('candidateToken'),
    body: { name: 'Not allowed' },
    tests: `${status(403)}\n${envelope('FORBIDDEN')}`,
  }),
  request('Guest cannot create categories → 401 UNAUTHENTICATED', {
    method: 'POST',
    path: '/admin/categories',
    body: { name: 'Not allowed' },
    tests: `${status(401)}\n${envelope('UNAUTHENTICATED')}`,
  }),
  request('Admin deletes the unused category → 204', {
    method: 'DELETE',
    path: '/admin/categories/{{categoryId}}',
    auth: bearer('adminToken'),
    tests: status(204),
  }),
  request('Deleted category is gone → 404 NOT_FOUND', {
    method: 'PUT',
    path: '/admin/categories/{{categoryId}}',
    auth: bearer('adminToken'),
    body: { name: 'Ghost' },
    tests: `${status(404)}\n${envelope('NOT_FOUND')}`,
  }),
  request('Admin creates an accommodation type → 201', {
    method: 'POST',
    path: '/admin/accommodations',
    auth: bearer('adminToken'),
    prerequest: `pm.collectionVariables.set('accommodationName', 'Postman quiet room ' + Date.now());`,
    body: { name: '{{accommodationName}}', group: 'physical_access', description: 'Created by the Postman run.' },
    tests: `
${status(201)}
const body = pm.response.json();
pm.test('stored as active in the right group', () => { pm.expect(body.group).to.eql('physical_access'); pm.expect(body.is_retired).to.eql(false); });
pm.collectionVariables.set('accommodationId', body.id);`,
  }),
  request('Unknown accommodation group → 422 errors.group', {
    method: 'POST',
    path: '/admin/accommodations',
    auth: bearer('adminToken'),
    body: { name: 'Bad group', group: 'disability_type' },
    tests: fieldError('group'),
  }),
  request('Admin list includes the new type', {
    path: '/admin/accommodations',
    auth: bearer('adminToken'),
    tests: `
${status(200)}
pm.test('new accommodation is listed', () => pm.expect(pm.response.json().data.map((a) => a.id)).to.include(pm.collectionVariables.get('accommodationId')));`,
  }),
  request('Employer cannot see the admin list → 403 FORBIDDEN', {
    path: '/admin/accommodations',
    auth: bearer('employerToken'),
    tests: `${status(403)}\n${envelope('FORBIDDEN')}`,
  }),
  request('Admin deletes the unused accommodation → 204', {
    method: 'DELETE',
    path: '/admin/accommodations/{{accommodationId}}',
    auth: bearer('adminToken'),
    tests: status(204),
  }),
]);

// ---------------------------------------------------------------- collection

const collection = {
  info: {
    name: 'OpenDoor API',
    description:
      'OpenDoor API through the gateway. Run folders in order. Passwords are never stored here: pass --env-var demoPassword=… (see tests/postman/README.md). Generated by build-collection.mjs.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  event: [{ listen: 'test', script: { type: 'text/javascript', exec: COLLECTION_TESTS.trim().split('\n') } }],
  variable: ['newCandidateEmail', 'newCandidateToken', 'newCandidateLoginToken', 'adminToken', 'employerToken', 'candidateToken', 'categoryName', 'categoryId', 'accommodationName', 'accommodationId'].map(
    (key) => ({ key, value: '' }),
  ),
  item: [auth, masterData],
};

const target = fileURLToPath(new URL('./OpenDoor.postman_collection.json', import.meta.url));
writeFileSync(target, JSON.stringify(collection, null, 2) + '\n');
console.log(`Wrote ${target}: ${collection.item.map((f) => `${f.name} (${f.item.length})`).join(', ')}`);
