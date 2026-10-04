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

// ---------------------------------------------------------------- 03 Employer & Postings

const postingBody = (overrides = {}) => ({
  title: 'Postman Data Encoder',
  description: 'Created by the Postman run. Encode records.',
  category_id: '{{postingCategoryId}}',
  address: '25 Scout Tobias St.',
  location_psgc: null,
  location_label: 'Quezon City, Metro Manila',
  employment_type: 'full_time',
  work_setup: 'onsite',
  interview_format: 'online',
  closes_at: '{{postingClosesAt}}',
  accommodations: [
    { id: '{{accA}}', note: 'Ramp at the main entrance' },
    { id: '{{accB}}', note: 'Ground floor' },
    { id: '{{accC}}', note: null },
  ],
  submit: true,
  ...overrides,
});

// Postman sends {{vars}} as strings; the API needs integers for ids.
const INT_IDS = `
const body = JSON.parse(pm.request.body.raw);
['category_id'].forEach((k) => { body[k] = Number(pm.variables.replaceIn(body[k])); });
body.accommodations = body.accommodations.map((a) => ({ ...a, id: Number(pm.variables.replaceIn(a.id)) }));
body.closes_at = pm.variables.replaceIn(body.closes_at);
pm.request.body.raw = JSON.stringify(body);`;

const postingShape = `
pm.test('matches the JobPosting shape', () => {
  const p = pm.response.json();
  pm.expect(p).to.include.keys('id', 'title', 'employer', 'category', 'location', 'status', 'closes_at', 'accommodations', 'match', 'trust_score');
  pm.expect(p.employer).to.have.keys('id', 'company_name', 'verified');
  pm.expect(p.trust_score).to.have.keys('published', 'score', 'based_on');
});`;

const employerPostings = folder('03 Employer & Postings', 'M3 company + M4 postings: T02, T07, T08, approval workflow and visibility. Cleans up after itself.', [
  request('Pick a category for the posting', {
    path: '/categories',
    tests: `${status(200)}\npm.collectionVariables.set('postingCategoryId', pm.response.json().data[0].id);`,
  }),
  request('Pick three accommodation types', {
    path: '/accommodations',
    prerequest: `
const d = new Date(Date.now() + 30 * 86400000);
pm.collectionVariables.set('postingClosesAt', d.toISOString().slice(0, 10));`,
    tests: `
${status(200)}
const ids = pm.response.json().data.flatMap((g) => g.items.map((i) => i.id));
pm.test('at least three active types', () => pm.expect(ids.length).to.be.at.least(3));
['accA', 'accB', 'accC'].forEach((k, i) => pm.collectionVariables.set(k, ids[i]));`,
  }),
  request('Employer reads own company → registration data visible', {
    path: '/employer/company',
    auth: bearer('employerToken'),
    tests: `
${status(200)}
const c = pm.response.json();
pm.test('has registration fields and the verified badge', () => {
  pm.expect(c).to.include.keys('business_reg_no', 'registry_type', 'verified_at', 'verification_rejected_reason');
  pm.expect(c.registry_type).to.be.oneOf(['DTI', 'SEC']);
  pm.expect(c.verified).to.eql(true);
});
pm.collectionVariables.set('employerId', c.id);`,
  }),
  request('Candidate cannot edit a company → 403', {
    method: 'PUT',
    path: '/employer/company',
    auth: bearer('candidateToken'),
    body: { company_name: 'Not mine' },
    tests: `${status(403)}\n${envelope('FORBIDDEN')}`,
  }),
  request('Public employer page hides registration data', {
    path: '/employers/{{employerId}}',
    tests: `
${status(200)}
const e = pm.response.json();
pm.test('no private fields', () => { pm.expect(e).to.not.have.property('business_reg_no'); pm.expect(e).to.not.have.property('verification_rejected_reason'); });
pm.test('open postings are listed', () => pm.expect(e.open_postings).to.be.an('array'));
pm.test('trust score is published only from 3 responses', () => {
  if (e.trust_score.published) pm.expect(e.trust_score.based_on).to.be.at.least(3);
  else pm.expect(e.trust_score.score).to.eql(null);
});`,
  }),
  request('T02 Employer creates a posting with 3 accommodations and notes → 201', {
    method: 'POST',
    path: '/job-postings',
    auth: bearer('employerToken'),
    prerequest: INT_IDS,
    body: postingBody(),
    tests: `
${status(201)}
const p = pm.response.json();
pm.test('status is pending_approval', () => pm.expect(p.status).to.eql('pending_approval'));
pm.test('3 accommodations stored with notes', () => {
  pm.expect(p.accommodations).to.have.lengthOf(3);
  pm.expect(p.accommodations.map((a) => a.note)).to.include('Ramp at the main entrance');
});
${postingShape}
pm.collectionVariables.set('jobPostingId', p.id);`,
  }),
  request('Guests cannot see an unapproved posting → 404', {
    path: '/job-postings/{{jobPostingId}}',
    tests: `${status(404)}\n${envelope('NOT_FOUND')}`,
  }),
  request('T07 Unknown posting id → 404 with request_id', {
    path: '/job-postings/999999',
    tests: `${status(404)}\n${envelope('NOT_FOUND')}`,
  }),
  request('Log in the second demo employer → employer2Token', {
    method: 'POST',
    path: '/login',
    body: { email: '{{employer2Email}}', password: '{{demoPassword}}' },
    tests: authResponse('employer', 'employer2Token'),
  }),
  request("T08 Employer A updates Employer B's posting → 403", {
    method: 'PUT',
    path: '/job-postings/{{jobPostingId}}',
    auth: bearer('employer2Token'),
    prerequest: INT_IDS,
    body: postingBody({ title: 'Hijacked' }),
    tests: `${status(403)}\n${envelope('FORBIDDEN')}`,
  }),
  request('A submitted posting cannot go back to draft → 422 errors.submit', {
    method: 'PUT',
    path: '/job-postings/{{jobPostingId}}',
    auth: bearer('employerToken'),
    prerequest: INT_IDS,
    body: postingBody({ submit: false }),
    tests: fieldError('submit'),
  }),
  request('An unapproved posting cannot be opened → 422 errors.status', {
    method: 'PATCH',
    path: '/job-postings/{{jobPostingId}}/status',
    auth: bearer('employerToken'),
    body: { status: 'open' },
    tests: fieldError('status'),
  }),
  request('Admin queue lists the new posting', {
    path: '/admin/job-postings',
    auth: bearer('adminToken'),
    tests: `
${status(200)}
pm.test('pending posting is in the queue', () => pm.expect(pm.response.json().data.map((p) => p.id)).to.include(pm.collectionVariables.get('jobPostingId')));`,
  }),
  request('Admin rejects without a reason → 422 errors.reason', {
    method: 'PATCH',
    path: '/admin/job-postings/{{jobPostingId}}/approve',
    auth: bearer('adminToken'),
    body: { action: 'reject' },
    tests: fieldError('reason'),
  }),
  request('Admin rejects with a reason → draft', {
    method: 'PATCH',
    path: '/admin/job-postings/{{jobPostingId}}/approve',
    auth: bearer('adminToken'),
    body: { action: 'reject', reason: 'Please add the working hours.' },
    tests: `
${status(200)}
pm.test('back to draft with the reason', () => {
  pm.expect(pm.response.json().status).to.eql('draft');
  pm.expect(pm.response.json().rejection_reason).to.eql('Please add the working hours.');
});`,
  }),
  request('Owner sees the rejection reason', {
    path: '/job-postings/{{jobPostingId}}',
    auth: bearer('employerToken'),
    tests: `${status(200)}\npm.test('reason visible to the owner', () => pm.expect(pm.response.json().rejection_reason).to.eql('Please add the working hours.'));`,
  }),
  request('Owner resubmits → pending_approval, reason cleared', {
    method: 'PUT',
    path: '/job-postings/{{jobPostingId}}',
    auth: bearer('employerToken'),
    prerequest: INT_IDS,
    body: postingBody({ description: 'Created by the Postman run. Monday to Friday, 9:00 to 17:00.' }),
    tests: `
${status(200)}
pm.test('waiting for approval again', () => { pm.expect(pm.response.json().status).to.eql('pending_approval'); pm.expect(pm.response.json().rejection_reason).to.eql(null); });`,
  }),
  request('Admin approves → open', {
    method: 'PATCH',
    path: '/admin/job-postings/{{jobPostingId}}/approve',
    auth: bearer('adminToken'),
    body: { action: 'approve' },
    tests: `${status(200)}\npm.test('posting is open', () => pm.expect(pm.response.json().status).to.eql('open'));`,
  }),
  request('Guests now see the open posting (no rejection_reason)', {
    path: '/job-postings/{{jobPostingId}}',
    tests: `
${status(200)}
${postingShape}
pm.test('no private field for guests', () => pm.expect(pm.response.json()).to.not.have.property('rejection_reason'));`,
  }),
  request('Public employer page lists the posting', {
    path: '/employers/{{employerId}}',
    tests: `
${status(200)}
pm.test('posting is listed', () => pm.expect(pm.response.json().open_postings.map((p) => p.id)).to.include(pm.collectionVariables.get('jobPostingId')));`,
  }),
  request('Owner closes the posting', {
    method: 'PATCH',
    path: '/job-postings/{{jobPostingId}}/status',
    auth: bearer('employerToken'),
    body: { status: 'closed' },
    tests: `${status(200)}\npm.test('closed', () => pm.expect(pm.response.json().status).to.eql('closed'));`,
  }),
  request('Owner reopens the approved posting', {
    method: 'PATCH',
    path: '/job-postings/{{jobPostingId}}/status',
    auth: bearer('employerToken'),
    body: { status: 'open' },
    tests: `${status(200)}\npm.test('open again', () => pm.expect(pm.response.json().status).to.eql('open'));`,
  }),
  request('Employer lists own postings', {
    path: '/employer/job-postings',
    auth: bearer('employerToken'),
    tests: `
${status(200)}
const body = pm.response.json();
pm.test('paginated by 12', () => pm.expect(body.meta.per_page).to.eql(12));
pm.test('only own postings', () => body.data.forEach((p) => pm.expect(p.employer.id).to.eql(pm.collectionVariables.get('employerId'))));`,
  }),
  request('Owner deletes the posting → 204 (cleanup)', {
    method: 'DELETE',
    path: '/job-postings/{{jobPostingId}}',
    auth: bearer('employerToken'),
    tests: status(204),
  }),
  request('Deleted posting is gone → 404', {
    path: '/job-postings/{{jobPostingId}}',
    tests: `${status(404)}\n${envelope('NOT_FOUND')}`,
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
  variable: ['newCandidateEmail', 'newCandidateToken', 'newCandidateLoginToken', 'adminToken', 'employerToken', 'candidateToken', 'categoryName', 'categoryId', 'accommodationName', 'accommodationId', 'employer2Token', 'employerId', 'postingCategoryId', 'postingClosesAt', 'accA', 'accB', 'accC', 'jobPostingId'].map(
    (key) => ({ key, value: '' }),
  ),
  item: [auth, masterData, employerPostings],
};

const target = fileURLToPath(new URL('./OpenDoor.postman_collection.json', import.meta.url));
writeFileSync(target, JSON.stringify(collection, null, 2) + '\n');
console.log(`Wrote ${target}: ${collection.item.map((f) => `${f.name} (${f.item.length})`).join(', ')}`);
