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

/**
 * `url` replaces `{{baseUrl}}${path}` (e.g. a link returned by the API). `files` sends multipart
 * form data: { field: 'tests/postman/fixtures/…' } – paths are relative to the repo root (Newman's cwd).
 * `raw` sends a JSON body as written, e.g. '{{payload}}' set by the pre-request script.
 */
function request(name, { method = 'GET', path = '', url, auth = NO_AUTH, body, raw, files, tests, prerequest, description }) {
  const item = {
    name,
    request: {
      method,
      auth,
      header: [{ key: 'Accept', value: 'application/json' }],
      url: url ?? { raw: `{{baseUrl}}${path}`, host: ['{{baseUrl}}'], path: path.replace(/^\//, '').split('?')[0].split('/') },
      description,
    },
    event: [],
  };
  if (files) {
    item.request.body = { mode: 'formdata', formdata: Object.entries(files).map(([key, src]) => ({ key, type: 'file', src })) };
  }
  const query = url ? undefined : path.split('?')[1];
  if (query) {
    item.request.url.query = query.split('&').map((pair) => {
      const [key, value = ''] = pair.split('=');
      return { key, value };
    });
  }
  if (body !== undefined || raw !== undefined) {
    item.request.header.push({ key: 'Content-Type', value: 'application/json' });
    item.request.body = { mode: 'raw', raw: raw ?? JSON.stringify(body, null, 2), options: { raw: { language: 'json' } } };
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

// ---------------------------------------------------------------- 04 Candidate & Search

// Needs PUT: Postman sends {{vars}} as strings; the API needs integers.
const INT_NEEDS = `
const body = JSON.parse(pm.request.body.raw);
body.accommodation_ids = body.accommodation_ids.map((id) => Number(pm.variables.replaceIn(String(id))));
pm.request.body.raw = JSON.stringify(body);`;

/** Every posting in the list is open and has the JobPosting shape; meta has the paging fields. */
const searchList = (matchMode) => `
${status(200)}
const body = pm.response.json();
pm.test('meta: 12 per page, match_mode ${matchMode}', () => {
  pm.expect(body.meta).to.include.keys('current_page', 'last_page', 'total', 'match_mode');
  pm.expect(body.meta.per_page).to.eql(12);
  pm.expect(body.meta.match_mode).to.eql(${matchMode});
});
pm.test('only open postings', () => body.data.forEach((p) => pm.expect(p.status).to.eql('open')));
pm.test('postings have the JobPosting shape', () => body.data.forEach((p) => pm.expect(p).to.include.keys('id', 'title', 'employer', 'category', 'accommodations', 'match', 'trust_score')));`;

/** match.met never increases down the list (full matches first). */
const rankedByNeeds = `
pm.test('every posting has match {met,total,missing}', () => body.data.forEach((p) => pm.expect(p.match).to.have.keys('met', 'total', 'missing')));
pm.test('ranked by needs met', () => {
  const met = body.data.map((p) => p.match.met);
  pm.expect(met).to.eql([...met].sort((a, b) => b - a));
});
pm.test('missing = total - met', () => body.data.forEach((p) => pm.expect(p.match.missing).to.have.lengthOf(p.match.total - p.match.met)));`;

const candidateSearch = folder(
  '04 Candidate & Search',
  'M2 profile, needs and résumé (throwaway candidate from 01, demo data untouched) + M5 search and "Matches my needs" (T03–T05). Uploads tests/postman/fixtures/*.pdf – run Newman from the repo root.',
  [
    request('New candidate gets an empty profile (not 404)', {
      path: '/candidate/profile',
      auth: bearer('newCandidateLoginToken'),
      tests: `
${status(200)}
const p = pm.response.json();
pm.test('empty profile', () => {
  pm.expect(p.headline).to.eql(null);
  pm.expect(p.accommodations).to.eql([]);
  pm.expect(p.resume_url).to.eql(null);
  pm.expect(p.show_disability).to.eql(false);
});`,
    }),
    request('Candidate saves the profile', {
      method: 'PUT',
      path: '/candidate/profile',
      auth: bearer('newCandidateLoginToken'),
      body: { headline: '  Data encoder  ', skills: ['Excel', ' Typing ', 'Excel', ''], experience: '', location_psgc: null, location_label: null, disability_type: null, show_disability: true },
      tests: `
${status(200)}
const p = pm.response.json();
pm.test('trimmed and de-duplicated', () => { pm.expect(p.headline).to.eql('Data encoder'); pm.expect(p.skills).to.eql(['Excel', 'Typing']); pm.expect(p.experience).to.eql(null); });
pm.test('show_disability is off without a disability type', () => pm.expect(p.show_disability).to.eql(false));`,
    }),
    request('Invalid location code → 422 errors.location_psgc', {
      method: 'PUT',
      path: '/candidate/profile',
      auth: bearer('newCandidateLoginToken'),
      body: { location_psgc: 'Quezon City' },
      tests: fieldError('location_psgc'),
    }),
    request('Employer cannot read a candidate profile → 403', {
      path: '/candidate/profile',
      auth: bearer('employerToken'),
      tests: `${status(403)}\n${envelope('FORBIDDEN')}`,
    }),
    request('Pick two accommodation types as needs', {
      path: '/accommodations',
      tests: `
${status(200)}
const ids = pm.response.json().data.flatMap((g) => g.items.map((i) => i.id));
pm.collectionVariables.set('needA', ids[0]);
pm.collectionVariables.set('needB', ids[1]);`,
    }),
    request('Unknown accommodation as a need → 422', {
      method: 'PUT',
      path: '/candidate/accommodations',
      auth: bearer('newCandidateLoginToken'),
      body: { accommodation_ids: [999999] },
      tests: fieldError('accommodation_ids.0'),
    }),
    request('Candidate saves two needs', {
      method: 'PUT',
      path: '/candidate/accommodations',
      auth: bearer('newCandidateLoginToken'),
      prerequest: INT_NEEDS,
      body: { accommodation_ids: ['{{needA}}', '{{needB}}'] },
      tests: `
${status(200)}
pm.test('both needs saved', () => pm.expect(pm.response.json().data.map((a) => a.id)).to.have.members([Number(pm.collectionVariables.get('needA')), Number(pm.collectionVariables.get('needB'))]));`,
    }),
    request('Résumé that is not a PDF → 422 errors.resume', {
      method: 'POST',
      path: '/candidate/resume',
      auth: bearer('newCandidateLoginToken'),
      files: { resume: 'tests/postman/fixtures/not-a-pdf.pdf' },
      tests: fieldError('resume'),
    }),
    request('Candidate uploads a PDF résumé → signed gateway link', {
      method: 'POST',
      path: '/candidate/resume',
      auth: bearer('newCandidateLoginToken'),
      files: { resume: 'tests/postman/fixtures/cv.pdf' },
      tests: `
${status(200)}
const url = pm.response.json().resume_url;
pm.test('link goes through the gateway and is signed', () => {
  pm.expect(url.startsWith(pm.environment.get('baseUrl') + '/resumes/')).to.eql(true);
  pm.expect(url).to.match(/[?&]expires=\\d+/).and.to.match(/[?&]signature=[0-9a-f]{64}/);
});
pm.collectionVariables.set('resumeUrl', url);`,
    }),
    request('Signed résumé link opens without a token → PDF', {
      url: '{{resumeUrl}}',
      tests: `
${status(200)}
pm.test('inline PDF, not cached', () => {
  pm.expect(pm.response.headers.get('Content-Type')).to.eql('application/pdf');
  pm.expect(pm.response.headers.get('Content-Disposition')).to.match(/^inline;/);
  pm.expect(pm.response.headers.get('Cache-Control')).to.include('no-store');
});`,
    }),
    request('Tampered résumé link → 403', {
      url: '{{resumeUrl}}0',
      tests: `${status(403)}\n${envelope('FORBIDDEN')}`,
    }),
    request('T03 Guest searches open postings', {
      path: '/job-postings',
      tests: `
${searchList(false)}
pm.test('no match for guests', () => body.data.forEach((p) => pm.expect(p.match).to.eql(null)));
pm.test('at least one open posting (demo seed)', () => pm.expect(body.data.length).to.be.above(0));
const first = body.data[0];
pm.collectionVariables.set('searchPostingId', first.id);
pm.collectionVariables.set('searchCategoryId', first.category.id);
pm.collectionVariables.set('filterAccA', first.accommodations[0].id);
pm.collectionVariables.set('filterAccB', first.accommodations[1].id);`,
    }),
    request('Guest asks for match=1 → ignored (match_mode false)', {
      path: '/job-postings?match=1',
      tests: searchList(false),
    }),
    request('T04 Demo candidate "Matches my needs" → ranked by needs met', {
      path: '/job-postings?match=1',
      auth: bearer('candidateToken'),
      tests: `${searchList(true)}\n${rankedByNeeds}`,
    }),
    request('Matches my needs + closing soon → still ranked by needs first', {
      path: '/job-postings?match=1&sort=closing',
      auth: bearer('candidateToken'),
      tests: `
${searchList(true)}
${rankedByNeeds}
pm.test('closing date ascending within the same number of needs met', () => {
  for (let i = 1; i < body.data.length; i++) {
    const [a, b] = [body.data[i - 1], body.data[i]];
    if (a.match.met === b.match.met) pm.expect(a.closes_at <= b.closes_at).to.eql(true);
  }
});`,
    }),
    request('New candidate with two needs → match total 2', {
      path: '/job-postings?match=1',
      auth: bearer('newCandidateLoginToken'),
      tests: `
${searchList(true)}
pm.test('total = 2 needs', () => body.data.forEach((p) => pm.expect(p.match.total).to.eql(2)));`,
    }),
    request('T05 Job details show the match and the missing needs by name', {
      path: '/job-postings/{{searchPostingId}}',
      auth: bearer('candidateToken'),
      tests: `
${status(200)}
const m = pm.response.json().match;
pm.test('match with named missing needs', () => {
  pm.expect(m).to.have.keys('met', 'total', 'missing');
  m.missing.forEach((need) => pm.expect(need).to.have.keys('id', 'name'));
});`,
    }),
    request('Keyword search is case-insensitive', {
      path: '/job-postings?q=ENCODER',
      tests: `
${searchList(false)}
pm.test('every result mentions the keyword', () => body.data.forEach((p) => pm.expect([p.title, p.description, p.employer.company_name].join(' ').toLowerCase()).to.include('encoder')));`,
    }),
    request('Category filter', {
      path: '/job-postings?category={{searchCategoryId}}',
      tests: `
${searchList(false)}
pm.test('only that category', () => body.data.forEach((p) => pm.expect(p.category.id).to.eql(Number(pm.collectionVariables.get('searchCategoryId')))));`,
    }),
    request('Accommodation filter → postings offer every selected type', {
      path: '/job-postings?accommodations[]={{filterAccA}}&accommodations[]={{filterAccB}}',
      tests: `
${searchList(false)}
pm.test('includes the posting they came from', () => pm.expect(body.data.map((p) => p.id)).to.include(Number(pm.collectionVariables.get('searchPostingId'))));
pm.test('each posting offers both', () => body.data.forEach((p) => pm.expect(p.accommodations.map((a) => a.id)).to.include.members([Number(pm.collectionVariables.get('filterAccA')), Number(pm.collectionVariables.get('filterAccB'))])));`,
    }),
    request('Invalid sort → 422 errors.sort', {
      path: '/job-postings?sort=cheapest',
      tests: fieldError('sort'),
    }),
  ],
);

// ---------------------------------------------------------------- 05 Applications

const applicationShape = `
pm.test('matches the Application shape', () => {
  const a = pm.response.json();
  pm.expect(a).to.include.keys('id', 'job_posting_id', 'job_posting', 'status', 'cover_note', 'interview_request', 'hired_at', 'hire_confirmed_by', 'feedback_opens_on', 'created_at');
});`;

const applications = folder(
  '05 Applications',
  'M6: apply, duplicate, closed posting, the status workflow (T06 refused transition) and who may see an application. Uses its own posting (approved, then soft-deleted) and the throwaway candidate from 01/04.',
  [
    request('Employer submits a posting for this run', {
      method: 'POST',
      path: '/job-postings',
      auth: bearer('employerToken'),
      prerequest: INT_IDS,
      body: postingBody({ title: 'Postman Applications Test', description: 'Created by the Postman run for folder 05. Deleted at the end.' }),
      tests: `${status(201)}\npm.collectionVariables.set('appPostingId', pm.response.json().id);`,
    }),
    request('Admin approves it → open', {
      method: 'PATCH',
      path: '/admin/job-postings/{{appPostingId}}/approve',
      auth: bearer('adminToken'),
      body: { action: 'approve' },
      tests: `${status(200)}\npm.test('open', () => pm.expect(pm.response.json().status).to.eql('open'));`,
    }),
    request('Employer cannot apply → 403', {
      method: 'POST',
      path: '/job-postings/{{appPostingId}}/applications',
      auth: bearer('employerToken'),
      body: {},
      tests: `${status(403)}\n${envelope('FORBIDDEN')}`,
    }),
    request('Candidate applies with an interview accommodation request → 201', {
      method: 'POST',
      path: '/job-postings/{{appPostingId}}/applications',
      auth: bearer('newCandidateLoginToken'),
      body: { cover_note: 'Applied by the Postman run.', interview_request: 'Captions during the online interview, please.' },
      tests: `
${status(201)}
${applicationShape}
const a = pm.response.json();
pm.test('pending, not hired, no candidate block for the candidate', () => {
  pm.expect(a.status).to.eql('pending');
  pm.expect(a.hired_at).to.eql(null);
  pm.expect(a).to.not.have.property('candidate');
});
pm.collectionVariables.set('applicationId', a.id);`,
    }),
    request('Applying again → 409 ALREADY_APPLIED', {
      method: 'POST',
      path: '/job-postings/{{appPostingId}}/applications',
      auth: bearer('newCandidateLoginToken'),
      body: {},
      tests: `${status(409)}\n${envelope('ALREADY_APPLIED')}`,
    }),
    request('Job details show the earlier application to the candidate', {
      path: '/job-postings/{{appPostingId}}',
      auth: bearer('newCandidateLoginToken'),
      tests: `
${status(200)}
pm.test('my_application is the pending application', () => {
  const m = pm.response.json().my_application;
  pm.expect(m.id).to.eql(pm.collectionVariables.get('applicationId'));
  pm.expect(m.status).to.eql('pending');
});`,
    }),
    request('Candidate cannot mark own application reviewed → 422 INVALID_STATUS_TRANSITION', {
      method: 'PATCH',
      path: '/applications/{{applicationId}}/status',
      auth: bearer('newCandidateLoginToken'),
      body: { status: 'reviewed' },
      tests: `${status(422)}\n${envelope('INVALID_STATUS_TRANSITION')}`,
    }),
    request('T06 Employer hires without reviewing → 422 INVALID_STATUS_TRANSITION', {
      method: 'PATCH',
      path: '/applications/{{applicationId}}/status',
      auth: bearer('employerToken'),
      body: { status: 'hired' },
      tests: `${status(422)}\n${envelope('INVALID_STATUS_TRANSITION')}`,
      description: 'pending → hired skips the review step. (Opening the application as the employer moves it to reviewed.)',
    }),
    request('Another employer cannot open the application → 403', {
      path: '/applications/{{applicationId}}',
      auth: bearer('employer2Token'),
      tests: `${status(403)}\n${envelope('FORBIDDEN')}`,
    }),
    request('Admins have no access to applications → 403', {
      path: '/applications',
      auth: bearer('adminToken'),
      tests: `${status(403)}\n${envelope('FORBIDDEN')}`,
    }),
    request('Employer opens the application → reviewed, with the candidate details', {
      path: '/applications/{{applicationId}}',
      auth: bearer('employerToken'),
      tests: `
${status(200)}
${applicationShape}
const a = pm.response.json();
pm.test('opening marks it reviewed', () => pm.expect(a.status).to.eql('reviewed'));
pm.test('candidate needs and a signed résumé link are shared with this employer', () => {
  pm.expect(a.candidate).to.include.keys('name', 'headline', 'skills', 'experience', 'accommodations', 'disability_type', 'resume_url');
  pm.expect(a.candidate.accommodations).to.have.lengthOf(2);
  pm.expect(a.candidate.resume_url).to.match(/\\/resumes\\/\\d+\\?expires=/);
});
pm.test('disability type is hidden (not shared by the candidate)', () => pm.expect(a.candidate.disability_type).to.eql(null));`,
    }),
    request('Employer lists applicants for the posting', {
      path: '/applications?job_posting_id={{appPostingId}}',
      auth: bearer('employerToken'),
      tests: `
${status(200)}
const body = pm.response.json();
pm.test('one applicant, reviewed', () => { pm.expect(body.meta.total).to.eql(1); pm.expect(body.data[0].status).to.eql('reviewed'); });`,
    }),
    request('Employer hires → hired_at and feedback date', {
      method: 'PATCH',
      path: '/applications/{{applicationId}}/status',
      auth: bearer('employerToken'),
      body: { status: 'hired' },
      tests: `
${status(200)}
const a = pm.response.json();
pm.test('hired by the employer', () => { pm.expect(a.status).to.eql('hired'); pm.expect(a.hire_confirmed_by).to.eql('employer'); pm.expect(a.hired_at).to.be.a('string'); });
pm.test('feedback opens 30 days after the hire (Manila)', () => {
  const opens = new Date(a.feedback_opens_on + 'T00:00:00+08:00');
  const hiredManila = new Date(new Date(a.hired_at).getTime() + 8 * 3600000).toISOString().slice(0, 10);
  pm.expect((opens - new Date(hiredManila + 'T00:00:00+08:00')) / 86400000).to.eql(30);
});`,
    }),
    request('Hired is final → reject is refused (422)', {
      method: 'PATCH',
      path: '/applications/{{applicationId}}/status',
      auth: bearer('employerToken'),
      body: { status: 'rejected' },
      tests: `${status(422)}\n${envelope('INVALID_STATUS_TRANSITION')}`,
    }),
    request('Candidate sees the hire in My applications', {
      path: '/applications?status=hired',
      auth: bearer('newCandidateLoginToken'),
      tests: `
${status(200)}
pm.test('the hired application is listed', () => pm.expect(pm.response.json().data.map((a) => a.id)).to.include(pm.collectionVariables.get('applicationId')));`,
    }),
    request('Owner closes the posting', {
      method: 'PATCH',
      path: '/job-postings/{{appPostingId}}/status',
      auth: bearer('employerToken'),
      body: { status: 'closed' },
      tests: status(200),
    }),
    request('Applying to a closed posting → 422 POSTING_CLOSED', {
      method: 'POST',
      path: '/job-postings/{{appPostingId}}/applications',
      auth: bearer('candidateToken'),
      body: {},
      tests: `${status(422)}\n${envelope('POSTING_CLOSED')}`,
    }),
    request('Owner deletes the posting → 204 (cleanup; the application stays)', {
      method: 'DELETE',
      path: '/job-postings/{{appPostingId}}',
      auth: bearer('employerToken'),
      tests: status(204),
    }),
    request('The application survives the deleted posting', {
      path: '/applications/{{applicationId}}',
      auth: bearer('newCandidateLoginToken'),
      tests: `${status(200)}\npm.test('still hired', () => pm.expect(pm.response.json().status).to.eql('hired'));`,
    }),
  ],
);

// ---------------------------------------------------------------- 06 Feedback & Trust Score

/** True when an earlier run already rated candidate2's hire (409 instead of 201 / 422 validation). */
const FEEDBACK_GIVEN = `const given = pm.collectionVariables.get('feedbackGiven') === 'true';`;

/** T10 body from the stored form: captioned meetings partly delivered, the rest delivered (score 78). */
const FEEDBACK_BODY = `
const items = JSON.parse(pm.collectionVariables.get('feedbackItems') || '[]');
const rating = (name) => (name === 'Written or captioned meetings' ? 'partial' : 'delivered');
pm.collectionVariables.set('feedbackPayload', JSON.stringify({
  items: items.map((i) => ({ accommodation_id: i.accommodation_id, rating: rating(i.name) })),
  comments: 'Rated by the Postman run.',
}));`;

const trustScoreShape = `
pm.test('matches the TrustScore shape', () => {
  const t = pm.response.json();
  pm.expect(t).to.have.all.keys('published', 'score', 'based_on', 'breakdown');
  t.breakdown.forEach((row) => pm.expect(row).to.have.all.keys('accommodation_id', 'name', 'delivered', 'partial', 'not_delivered', 'of'));
});`;

const feedback = folder(
  '06 Feedback & Trust Score',
  'M7: the feedback window, once-only rule, who may rate, and the trust score threshold. T10 uses the seeded hire of candidate2@ at employer2@ (2 earlier responses, window open), so the run gives the 3rd response: 201 on a fresh seed, 409 FEEDBACK_EXISTS on later runs (the score checks still apply). T11 uses the fresh hire from folder 05.',
  [
    request('Log in the second demo candidate → candidate2Token', {
      method: 'POST',
      path: '/login',
      body: { email: '{{candidate2Email}}', password: '{{demoPassword}}' },
      tests: authResponse('candidate', 'candidate2Token'),
    }),
    request('Candidate finds the hire whose feedback window is open', {
      path: '/applications?status=hired',
      auth: bearer('candidate2Token'),
      tests: `
${status(200)}
const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
const hire = pm.response.json().data.find((a) => a.feedback_opens_on && a.feedback_opens_on <= today);
pm.test('a hired application with an open window exists (DemoFeedbackSeeder)', () => pm.expect(hire).to.be.an('object'));
pm.test('feedback_submitted is shown to the candidate', () => pm.expect(hire.feedback_submitted).to.be.a('boolean'));
pm.collectionVariables.set('feedbackApplicationId', hire.id);
pm.collectionVariables.set('feedbackEmployerId', hire.job_posting.employer.id);
pm.collectionVariables.set('feedbackGiven', String(hire.feedback_submitted));`,
    }),
    request('Trust score before the run: hidden below 3 responses', {
      path: '/employers/{{feedbackEmployerId}}/trust-score',
      tests: `
${status(200)}
${trustScoreShape}
${FEEDBACK_GIVEN}
const t = pm.response.json();
pm.test(given ? 'already published by an earlier run' : 'not published: 2 responses, no score, no breakdown', () => {
  if (given) pm.expect(t.published).to.eql(true);
  else pm.expect(t).to.eql({ published: false, score: null, based_on: 2, breakdown: [] });
});`,
    }),
    request('Feedback form lists the accommodations at hire', {
      path: '/applications/{{feedbackApplicationId}}/feedback-form',
      auth: bearer('candidate2Token'),
      tests: `
${status(200)}
${FEEDBACK_GIVEN}
const f = pm.response.json();
pm.test('open, with the seeded posting\\'s 3 accommodations', () => {
  pm.expect(f.is_open).to.eql(true);
  pm.expect(f.submitted).to.eql(given);
  pm.expect(f.items.map((i) => i.name)).to.have.members(['Adjustable workstation', 'Elevator or ground-floor workspace', 'Written or captioned meetings']);
});
pm.collectionVariables.set('feedbackItems', JSON.stringify(f.items));`,
    }),
    request('The employer cannot open the form → 403', {
      path: '/applications/{{feedbackApplicationId}}/feedback-form',
      auth: bearer('employer2Token'),
      tests: `${status(403)}\n${envelope('FORBIDDEN')}`,
    }),
    request('Another candidate cannot rate the hire → 403', {
      method: 'POST',
      path: '/applications/{{feedbackApplicationId}}/feedback',
      auth: bearer('candidateToken'),
      body: { items: [] },
      tests: `${status(403)}\n${envelope('FORBIDDEN')}`,
    }),
    request('Guest cannot rate → 401', {
      method: 'POST',
      path: '/applications/{{feedbackApplicationId}}/feedback',
      body: { items: [] },
      tests: `${status(401)}\n${envelope('UNAUTHENTICATED')}`,
    }),
    request('Leaving an accommodation unrated → 422 errors.items', {
      method: 'POST',
      path: '/applications/{{feedbackApplicationId}}/feedback',
      auth: bearer('candidate2Token'),
      raw: '{{feedbackPartialPayload}}',
      prerequest: `
const first = JSON.parse(pm.collectionVariables.get('feedbackItems'))[0];
pm.collectionVariables.set('feedbackPartialPayload', JSON.stringify({ items: [{ accommodation_id: first.accommodation_id, rating: 'delivered' }] }));`,
      tests: `
${FEEDBACK_GIVEN}
const body = pm.response.json();
if (given) {
  pm.test('earlier run: 409 FEEDBACK_EXISTS comes first', () => { pm.response.to.have.status(409); pm.expect(body.error.code).to.eql('FEEDBACK_EXISTS'); });
} else {
  ${status(422)}
  pm.test('VALIDATION_FAILED with errors.items', () => { pm.expect(body.error.code).to.eql('VALIDATION_FAILED'); pm.expect(body.errors).to.have.property('items'); });
}`,
    }),
    request('T10 Hired candidate rates after 30 days → 201 (3rd response)', {
      method: 'POST',
      path: '/applications/{{feedbackApplicationId}}/feedback',
      auth: bearer('candidate2Token'),
      raw: '{{feedbackPayload}}',
      prerequest: FEEDBACK_BODY,
      tests: `
${FEEDBACK_GIVEN}
const body = pm.response.json();
if (given) {
  pm.test('earlier run: 409 FEEDBACK_EXISTS', () => { pm.response.to.have.status(409); pm.expect(body.error.code).to.eql('FEEDBACK_EXISTS'); });
} else {
  ${status(201)}
  pm.test('saved with every item rated', () => {
    pm.expect(body.application_id).to.eql(pm.collectionVariables.get('feedbackApplicationId'));
    pm.expect(body.items_rated).to.eql(3);
  });
}`,
    }),
    request('T10 Trust score published from 3 responses with the right value', {
      path: '/employers/{{feedbackEmployerId}}/trust-score',
      tests: `
${status(200)}
${trustScoreShape}
const t = pm.response.json();
pm.test('published, based on 3, score 78', () => {
  // Seeded (1 + 0 + 1) + (1 + 0.5 + 1) + this run (1 + 1 + 0.5) = 7 of 9 items = 77.8 → 78.
  pm.expect(t.published).to.eql(true);
  pm.expect(t.based_on).to.eql(3);
  pm.expect(t.score).to.eql(78);
});
pm.test('breakdown: 3 ratings per accommodation', () => {
  pm.expect(t.breakdown).to.have.lengthOf(3);
  t.breakdown.forEach((row) => pm.expect(row.delivered + row.partial + row.not_delivered).to.eql(row.of).and.eql(3));
});`,
    }),
    request('Rating again → 409 FEEDBACK_EXISTS', {
      method: 'POST',
      path: '/applications/{{feedbackApplicationId}}/feedback',
      auth: bearer('candidate2Token'),
      raw: '{{feedbackPayload}}',
      prerequest: FEEDBACK_BODY,
      tests: `${status(409)}\n${envelope('FEEDBACK_EXISTS')}`,
    }),
    request('Form and application now say "submitted"', {
      path: '/applications/{{feedbackApplicationId}}/feedback-form',
      auth: bearer('candidate2Token'),
      tests: `${status(200)}\npm.test('submitted', () => pm.expect(pm.response.json().submitted).to.eql(true));`,
    }),
    request('Public employer page shows the published score', {
      path: '/employers/{{feedbackEmployerId}}',
      tests: `
${status(200)}
pm.test('trust_score summary without breakdown', () => pm.expect(pm.response.json().trust_score).to.eql({ published: true, score: 78, based_on: 3 }));`,
    }),
    request('T11 Feedback before 30 days after hire → 422 FEEDBACK_NOT_OPEN', {
      method: 'POST',
      path: '/applications/{{applicationId}}/feedback',
      auth: bearer('newCandidateLoginToken'),
      body: { items: [{ accommodation_id: 1, rating: 'delivered' }] },
      tests: `${status(422)}\n${envelope('FEEDBACK_NOT_OPEN')}`,
      description: 'The application was hired today in folder 05; the form opens on calendar day 30 (Asia/Manila).',
    }),
    request('The fresh hire\'s form is not open yet and shows the date', {
      path: '/applications/{{applicationId}}/feedback-form',
      auth: bearer('newCandidateLoginToken'),
      tests: `
${status(200)}
const f = pm.response.json();
pm.test('closed until opens_on, 30 days ahead', () => {
  pm.expect(f.is_open).to.eql(false);
  pm.expect(f.submitted).to.eql(false);
  const days = (new Date(f.opens_on + 'T00:00:00+08:00') - Date.now()) / 86400000;
  pm.expect(days).to.be.within(29, 30);
});`,
    }),
    request('Unknown employer trust score → 404', {
      path: '/employers/999999/trust-score',
      tests: `${status(404)}\n${envelope('NOT_FOUND')}`,
    }),
  ],
);

// ---------------------------------------------------------------- collection

const collection = {
  info: {
    name: 'OpenDoor API',
    description:
      'OpenDoor API through the gateway. Run folders in order. Passwords are never stored here: pass --env-var demoPassword=… (see tests/postman/README.md). Generated by build-collection.mjs.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  event: [{ listen: 'test', script: { type: 'text/javascript', exec: COLLECTION_TESTS.trim().split('\n') } }],
  variable: ['newCandidateEmail', 'newCandidateToken', 'newCandidateLoginToken', 'adminToken', 'employerToken', 'candidateToken', 'categoryName', 'categoryId', 'accommodationName', 'accommodationId', 'employer2Token', 'employerId', 'postingCategoryId', 'postingClosesAt', 'accA', 'accB', 'accC', 'jobPostingId', 'needA', 'needB', 'resumeUrl', 'searchPostingId', 'searchCategoryId', 'filterAccA', 'filterAccB', 'appPostingId', 'applicationId', 'candidate2Token', 'feedbackApplicationId', 'feedbackEmployerId', 'feedbackGiven', 'feedbackItems', 'feedbackPayload', 'feedbackPartialPayload'].map(
    (key) => ({ key, value: '' }),
  ),
  item: [auth, masterData, employerPostings, candidateSearch, applications, feedback],
};

const target = fileURLToPath(new URL('./OpenDoor.postman_collection.json', import.meta.url));
writeFileSync(target, JSON.stringify(collection, null, 2) + '\n');
console.log(`Wrote ${target}: ${collection.item.map((f) => `${f.name} (${f.item.length})`).join(', ')}`);
