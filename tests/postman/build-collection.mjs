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
function request(name, { method = 'GET', path = '', url, auth = NO_AUTH, headers = {}, body, raw, files, tests, prerequest, description }) {
  const item = {
    name,
    request: {
      method,
      auth,
      header: [{ key: 'Accept', value: 'application/json' }, ...Object.entries(headers).map(([key, value]) => ({ key, value }))],
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

// ---------------------------------------------------------------- 04 Candidate & Matching

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
  '04 Candidate & Matching',
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
    request('Guest searches open postings', {
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
    request('T03 Demo candidate "Matches my needs" → ranked by needs met', {
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
    request('T03 Job details show the match and the missing needs by name', {
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
    // M12 saved jobs – throwaway candidate, so demo bookmarks are untouched
    request('M12 Candidate saves a posting → 201', {
      method: 'POST',
      path: '/candidate/saved-jobs/{{searchPostingId}}',
      auth: bearer('newCandidateLoginToken'),
      tests: `
${status(201)}
pm.test('returns the posting as saved', () => {
  const p = pm.response.json();
  pm.expect(p.id).to.eql(Number(pm.collectionVariables.get('searchPostingId')));
  pm.expect(p.saved).to.eql(true);
});`,
    }),
    request('M12 Saving it again → 200 (idempotent)', {
      method: 'POST',
      path: '/candidate/saved-jobs/{{searchPostingId}}',
      auth: bearer('newCandidateLoginToken'),
      tests: status(200),
    }),
    request('M12 Saved jobs list shows it', {
      path: '/candidate/saved-jobs',
      auth: bearer('newCandidateLoginToken'),
      tests: `
${status(200)}
const body = pm.response.json();
pm.test('one saved posting, marked saved, with match', () => {
  pm.expect(body.meta.total).to.eql(1);
  pm.expect(body.data[0].id).to.eql(Number(pm.collectionVariables.get('searchPostingId')));
  pm.expect(body.data[0].saved).to.eql(true);
  pm.expect(body.data[0].match).to.include.keys('met', 'total', 'missing');
});`,
    }),
    request('M12 Job details say it is saved', {
      path: '/job-postings/{{searchPostingId}}',
      auth: bearer('newCandidateLoginToken'),
      tests: `${status(200)}\npm.test('saved is true', () => pm.expect(pm.response.json().saved).to.eql(true));`,
    }),
    request('M12 Unknown posting cannot be saved → 404', {
      method: 'POST',
      path: '/candidate/saved-jobs/999999',
      auth: bearer('newCandidateLoginToken'),
      tests: `${status(404)}\n${envelope('NOT_FOUND')}`,
    }),
    request('M12 Employer has no saved jobs → 403', {
      path: '/candidate/saved-jobs',
      auth: bearer('employerToken'),
      tests: `${status(403)}\n${envelope('FORBIDDEN')}`,
    }),
    request('M12 Candidate removes it → 204', {
      method: 'DELETE',
      path: '/candidate/saved-jobs/{{searchPostingId}}',
      auth: bearer('newCandidateLoginToken'),
      tests: status(204),
    }),
    request('M12 Saved jobs list is empty again', {
      path: '/candidate/saved-jobs',
      auth: bearer('newCandidateLoginToken'),
      tests: `${status(200)}\npm.test('no saved postings', () => pm.expect(pm.response.json().meta.total).to.eql(0));`,
    }),
  ],
);

// ---------------------------------------------------------------- 05 Applications & Status

const applicationShape = `
pm.test('matches the Application shape', () => {
  const a = pm.response.json();
  pm.expect(a).to.include.keys('id', 'job_posting_id', 'job_posting', 'status', 'cover_note', 'interview_request', 'hired_at', 'hire_confirmed_by', 'feedback_opens_on', 'created_at');
});`;

const applications = folder(
  '05 Applications & Status',
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
    request('T04 Candidate applies with an interview accommodation request → 201', {
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
    request('T04 The employer is notified of the application', {
      path: '/notifications',
      auth: bearer('employerToken'),
      tests: `
${status(200)}
const body = pm.response.json();
pm.test('newest notice is application_received for this application', () => {
  const n = body.data[0];
  pm.expect(n.type).to.eql('application_received');
  pm.expect(n.data.application_id).to.eql(pm.collectionVariables.get('applicationId'));
  pm.expect(n.data.url).to.eql('/employer/applications/' + pm.collectionVariables.get('applicationId'));
  pm.expect(n.read_at).to.eql(null);
});
pm.test('unread_count counts it', () => pm.expect(body.meta.unread_count).to.be.at.least(1));`,
    }),
    request('T05 Applying again → 409 ALREADY_APPLIED', {
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

// ---------------------------------------------------------------- 08 Admin & SOAP Registry

const registryResultShape = (field) => `
pm.test('${field} matches the RegistryResult shape', () => {
  const r = ${field};
  pm.expect(r).to.have.all.keys('status', 'registered_name', 'name_match', 'checked_at');
  pm.expect(r.status).to.be.oneOf(['ACTIVE', 'EXPIRED', 'CANCELLED', 'NOT_FOUND', 'ERROR']);
  pm.expect(r.checked_at).to.match(/^\\d{4}-\\d\\d-\\d\\dT/);
});`;

const adminRegistry = folder(
  '08 Admin & SOAP Registry',
  'M3 verification through the legacy SOAP Business Registry (the registry service must be running). T14 checks the seeded ACTIVE SEC number of employer2@ (Kalinga Foods); the admin then approves and removes the verification, and employer2@ re-saves the company so it is back in the queue (re-runnable). T15 uses a throwaway employer with a random number (NOT_FOUND). A wrong SOAP password (502 REGISTRY_AUTH_FAILED) cannot be caused from Postman – it is covered by the Core PHPUnit tests (tests/Feature/Registry).',
  [
    request('Admin finds Kalinga Foods in the verification queue', {
      path: '/admin/employers?status=pending&q=CS201912345',
      auth: bearer('adminToken'),
      tests: `
${status(200)}
const body = pm.response.json();
const k = body.data.find((e) => e.business_reg_no === 'CS201912345');
pm.test('pending, with owner and registration data', () => {
  pm.expect(k).to.be.an('object');
  pm.expect(k.verified_at).to.eql(null);
  pm.expect(k.registry_type).to.eql('SEC');
  pm.expect(k.owner.email).to.eql(pm.environment.get('employer2Email'));
  pm.expect(k).to.have.property('latest_registry_check');
});
pm.collectionVariables.set('kalingaId', k.id);`,
    }),
    request('Employers cannot open the admin queue → 403', {
      path: '/admin/employers',
      auth: bearer('employer2Token'),
      tests: `${status(403)}\n${envelope('FORBIDDEN')}`,
    }),
    request('T14 Admin registry check (SOAP) for a seeded ACTIVE SEC number → 200 [slow]', {
      method: 'PATCH',
      path: '/admin/employers/{{kalingaId}}/verify',
      auth: bearer('adminToken'),
      body: { action: 'check' },
      tests: `
${status(200)}
const body = pm.response.json();
${registryResultShape('body.registry')}
pm.test('ACTIVE, registered name, name_match ≥ 0.80', () => {
  pm.expect(body.registry.status).to.eql('ACTIVE');
  pm.expect(body.registry.registered_name).to.eql('KALINGA FOODS, INC.');
  pm.expect(body.registry.name_match).to.be.at.least(0.8);
});
pm.test('the check never approves by itself', () => pm.expect(body.verified_at).to.eql(null));`,
      description: 'Gateway → Core → SOAP registry (WS-Security UsernameToken). [slow]: the first call loads the WSDL.',
    }),
    request('T14 The check is stored and shown on the employer', {
      path: '/admin/employers/{{kalingaId}}',
      auth: bearer('adminToken'),
      tests: `
${status(200)}
const e = pm.response.json();
${registryResultShape('e.latest_registry_check')}
pm.test('latest_registry_check is the ACTIVE result', () => pm.expect(e.latest_registry_check.status).to.eql('ACTIVE'));`,
    }),
    request('Rejecting without a reason → 422 errors.reason', {
      method: 'PATCH',
      path: '/admin/employers/{{kalingaId}}/verify',
      auth: bearer('adminToken'),
      body: { action: 'reject' },
      tests: fieldError('reason'),
    }),
    request('A candidate cannot verify employers → 403', {
      method: 'PATCH',
      path: '/admin/employers/{{kalingaId}}/verify',
      auth: bearer('candidateToken'),
      body: { action: 'approve' },
      tests: `${status(403)}\n${envelope('FORBIDDEN')}`,
    }),
    request('Admin approves → verified_at, Verified badge on the public page', {
      method: 'PATCH',
      path: '/admin/employers/{{kalingaId}}/verify',
      auth: bearer('adminToken'),
      body: { action: 'approve' },
      tests: `
${status(200)}
const body = pm.response.json();
pm.test('verified_at is set; the current check comes along', () => {
  pm.expect(body.verified_at).to.be.a('string');
  pm.expect(body.registry.status).to.eql('ACTIVE');
});`,
    }),
    request('Public employer page shows the Verified badge', {
      path: '/employers/{{kalingaId}}',
      tests: `${status(200)}\npm.test('verified', () => pm.expect(pm.response.json().verified).to.eql(true));`,
    }),
    request('Admin removes the verification with a reason', {
      method: 'PATCH',
      path: '/admin/employers/{{kalingaId}}/verify',
      auth: bearer('adminToken'),
      body: { action: 'reject', reason: 'Postman run: verification removed again.' },
      tests: `${status(200)}\npm.test('not verified any more', () => pm.expect(pm.response.json().verified_at).to.eql(null));`,
    }),
    request('The employer sees the reason', {
      path: '/employer/company',
      auth: bearer('employer2Token'),
      tests: `
${status(200)}
const c = pm.response.json();
pm.test('reason shown, not verified', () => {
  pm.expect(c.verification_rejected_reason).to.eql('Postman run: verification removed again.');
  pm.expect(c.verified).to.eql(false);
});
const keep = ['company_name', 'registry_type', 'business_reg_no', 'industry', 'address', 'description'];
const payload = Object.fromEntries(keep.map((k) => [k, c[k]]));
payload.location_psgc = c.location ? c.location.psgc_code : null;
payload.location_label = c.location ? c.location.label : null;
pm.collectionVariables.set('kalingaCompany', JSON.stringify(payload));`,
    }),
    request('The employer saves the company → back in the queue (cleanup)', {
      method: 'PUT',
      path: '/employer/company',
      auth: bearer('employer2Token'),
      raw: '{{kalingaCompany}}',
      tests: `
${status(200)}
pm.test('reason cleared, pending again', () => {
  const c = pm.response.json();
  pm.expect(c.verification_rejected_reason).to.eql(null);
  pm.expect(c.verified_at).to.eql(null);
});`,
    }),
    request('T15 Register a throwaway employer', {
      method: 'POST',
      path: '/register',
      prerequest: `
pm.collectionVariables.set('pmEmployerEmail', 'pm-employer-' + Date.now() + '@opendoor.test');
pm.collectionVariables.set('pmRegNo', '9' + String(Math.floor(Math.random() * 1e7)).padStart(7, '0'));`,
      body: { name: 'Postman Employer', email: '{{pmEmployerEmail}}', password: 'postman-pass-123', password_confirmation: 'postman-pass-123', role: 'employer', consent: true },
      tests: `${status(201)}\npm.collectionVariables.set('pmEmployerToken', pm.response.json().token);`,
    }),
    request('T15 Throwaway employer saves a company with an unknown DTI number', {
      method: 'PUT',
      path: '/employer/company',
      auth: bearer('pmEmployerToken'),
      body: { company_name: 'Postman Unknown Trading', registry_type: 'DTI', business_reg_no: '{{pmRegNo}}', industry: 'Retail', address: '1 Postman St.', location_label: 'Pasig City, Metro Manila' },
      tests: `${status(200)}\npm.collectionVariables.set('pmEmployerId', pm.response.json().id);`,
    }),
    request('T15 Registry check with an unknown number → 200 NOT_FOUND [slow]', {
      method: 'PATCH',
      path: '/admin/employers/{{pmEmployerId}}/verify',
      auth: bearer('adminToken'),
      body: { action: 'check' },
      tests: `
${status(200)}
const body = pm.response.json();
${registryResultShape('body.registry')}
pm.test('NOT_FOUND without a name or score', () => {
  pm.expect(body.registry.status).to.eql('NOT_FOUND');
  pm.expect(body.registry.registered_name).to.eql(null);
  pm.expect(body.registry.name_match).to.eql(null);
});`,
    }),
    request('Unknown employer → 404', {
      method: 'PATCH',
      path: '/admin/employers/999999/verify',
      auth: bearer('adminToken'),
      body: { action: 'check' },
      tests: `${status(404)}\n${envelope('NOT_FOUND')}`,
    }),
  ],
);

// ---------------------------------------------------------------- 07 Insights Mashup

const SOURCE_STATUS = `['ok', 'cached', 'stale', 'unavailable']`;

/** Snapshot body (`s`) shape from docs/openapi.yaml → Snapshot. Map data is live, so only shapes are checked. */
const snapshotShape = `
pm.test('snapshot shape', () => {
  pm.expect(s).to.have.all.keys('job_posting_id', 'location', 'employer_claims', 'community_verification', 'nearby_accessible', 'sources', 'disclaimer', 'generated_at');
  pm.expect(s.job_posting_id).to.eql(Number(pm.collectionVariables.get('insightsPostingId')));
  pm.expect(s.location).to.have.all.keys('psgc_code', 'label', 'lat', 'lon', 'precision');
  pm.expect(s.disclaimer).to.include('OpenStreetMap');
  pm.expect(s.generated_at).to.match(/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\+08:00$/);
});
pm.test('sources has a status for each source', () => {
  pm.expect(s.sources).to.have.all.keys('core', 'psgc', 'nominatim', 'overpass');
  Object.values(s.sources).forEach((v) => pm.expect(v).to.be.oneOf(${SOURCE_STATUS}));
  pm.expect(s.sources.core).to.eql('ok');
});
pm.test('employer claims are accommodation names grouped by group', () => {
  const groups = ['physical_access', 'communication', 'work_arrangement', 'assistive_technology', 'support'];
  Object.entries(s.employer_claims).forEach(([group, names]) => {
    pm.expect(group).to.be.oneOf(groups);
    pm.expect(names).to.be.an('array').that.is.not.empty;
  });
});
pm.test('community verification only when the trust score is published (3+ responses)', () => {
  if (s.community_verification === null) return;
  pm.expect(s.community_verification.trust_score).to.be.within(0, 100);
  pm.expect(s.community_verification.based_on).to.be.at.least(3);
  pm.expect(s.community_verification.breakdown).to.be.an('array');
});
pm.test('nearby places: null when Overpass gave nothing, else the nearest 3 per category within 500 m', () => {
  const n = s.nearby_accessible;
  if (s.sources.overpass === 'unavailable') return pm.expect(n).to.eql(null);
  if (n === null) return pm.expect(s.location.lat).to.eql(null);
  pm.expect(n.radius_m).to.eql(500);
  ['transit_stops', 'toilets', 'parking', 'other'].forEach((category) => {
    pm.expect(n[category]).to.be.an('array').with.length.at.most(3);
    n[category].forEach((place, i) => {
      pm.expect(place.wheelchair).to.be.oneOf(['yes', 'limited']);
      pm.expect(place.distance_m).to.be.within(0, 500);
      if (i > 0) pm.expect(place.distance_m).to.be.at.least(n[category][i - 1].distance_m);
    });
  });
});`;

/** The gateway's root (baseUrl without /api), for paths outside /api. */
const GATEWAY_ROOT = `pm.collectionVariables.set('gatewayRoot', pm.environment.get('baseUrl').replace(/\\/api\\/?$/, ''));`;

const insights = folder(
  '07 Insights Mashup',
  'Accessibility Snapshot (T12, T13) and PSGC location lists through the gateway; T16 calls Core directly. The snapshot uses live PSGC/Nominatim/Overpass locally, so map data is checked by shape only. T13 runs only with --env-var overpassDown=true while Insights runs with an unreachable OVERPASS_URL; T16 only with --env-var coreUrl=<Core URL> (Core is private in production).',
  [
    request('Find a seeded posting with a PSGC location', {
      path: '/job-postings',
      tests: `
${status(200)}
const posting = pm.response.json().data.find((p) => p.location && p.location.psgc_code);
pm.test('a visible posting has a PSGC code (demo seed)', () => pm.expect(posting).to.be.an('object'));
pm.collectionVariables.set('insightsPostingId', posting.id);
pm.collectionVariables.set('insightsPsgcCode', posting.location.psgc_code);`,
    }),
    request('T12 Accessibility Snapshot (Gateway → Insights → Core + PSGC + Nominatim + Overpass) [slow]', {
      path: '/insights/job-postings/{{insightsPostingId}}',
      tests: `
${status(200)}
const s = pm.response.json();
${snapshotShape}
pm.test('answers within the gateway timeout (15 s)', () => pm.expect(pm.response.responseTime).to.be.below(15000));
pm.test('location has the PSGC code, its names and coordinates', () => {
  pm.expect(s.location.psgc_code).to.eql(pm.collectionVariables.get('insightsPsgcCode'));
  pm.expect(s.location.label).to.be.a('string').and.not.empty;
  pm.expect(s.location.lat).to.be.within(4.5, 21.5);
  pm.expect(s.location.lon).to.be.within(116, 127);
  pm.expect(s.location.precision).to.be.oneOf(['street', 'city']);
});`,
    }),
    request('Snapshot again → PSGC, Nominatim and Overpass are not asked again', {
      path: '/insights/job-postings/{{insightsPostingId}}',
      tests: `
${status(200)}
const s = pm.response.json();
${snapshotShape}
pm.test('no source fetched again (cached, or skipped after a recent failure)', () => {
  ['psgc', 'nominatim', 'overpass'].forEach((source) => pm.expect(s.sources[source], source).to.not.eql('ok'));
});`,
    }),
    request('T13 Snapshot with Overpass unreachable → 200, other sections present [slow]', {
      path: '/insights/job-postings/{{insightsPostingId}}',
      description:
        'Only with --env-var overpassDown=true and Insights started with an unreachable OVERPASS_URL. A cache entry from the last 24 h is still served (overpass: cached/stale) – that is the designed degradation; empty `overpass_cache` for a strict `unavailable`.',
      prerequest: `if (pm.environment.get('overpassDown') !== 'true') pm.execution.skipRequest();`,
      tests: `
${status(200)}
const s = pm.response.json();
${snapshotShape}
pm.test('Overpass is not reported as ok; the other sections are still there', () => {
  pm.expect(s.sources.overpass).to.be.oneOf(['unavailable', 'cached', 'stale']);
  if (s.sources.overpass === 'unavailable') pm.expect(s.nearby_accessible).to.eql(null);
  pm.expect(s.location.label).to.be.a('string');
  pm.expect(s.employer_claims).to.be.an('object');
});
pm.test('answers within the gateway timeout (15 s)', () => pm.expect(pm.response.responseTime).to.be.below(15000));`,
    }),
    request('Snapshot of an unknown posting → 404', {
      path: '/insights/job-postings/999999',
      tests: `${status(404)}\n${envelope('NOT_FOUND')}`,
    }),
    request('Snapshot with a non-numeric id → 404', {
      path: '/insights/job-postings/abc',
      tests: `${status(404)}\n${envelope('NOT_FOUND')}`,
    }),
    request('PSGC regions (10-digit codes, sorted by name) [slow]', {
      path: '/insights/locations/regions',
      tests: `
${status(200)}
const items = pm.response.json();
pm.test('X-Data-Source tells where the list came from', () => pm.expect(pm.response.headers.get('X-Data-Source')).to.be.oneOf(['ok', 'cached', 'stale', 'fallback']));
pm.test('regions with 10-digit codes, NCR included', () => {
  pm.expect(items.length).to.be.at.least(17);
  items.forEach((r) => {
    pm.expect(r).to.have.all.keys('code', 'name', 'level');
    pm.expect(r.code).to.match(/^\\d{10}$/);
    pm.expect(r.level).to.eql('region');
  });
  pm.expect(items.map((r) => r.code)).to.include('1300000000');
});
pm.test('sorted by name', () => {
  const names = items.map((r) => r.name);
  pm.expect(names).to.eql([...names].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })));
});
pm.test('answers within 6 s (PSGC timeout + fallback)', () => pm.expect(pm.response.responseTime).to.be.below(6000));`,
    }),
    request('PSGC provinces of Ilocos Region [slow]', {
      path: '/insights/locations/provinces?parent=0100000000',
      tests: `
${status(200)}
const items = pm.response.json();
pm.test('provinces of the region', () => {
  pm.expect(items.map((p) => p.name)).to.include.members(['Ilocos Norte', 'Pangasinan']);
  items.forEach((p) => pm.expect(p.level).to.eql('province'));
});
pm.test('answers within 6 s (PSGC timeout + fallback)', () => pm.expect(pm.response.responseTime).to.be.below(6000));`,
    }),
    request('PSGC cities of NCR (a region without provinces) [slow]', {
      path: '/insights/locations/cities?parent=1300000000',
      tests: `
${status(200)}
const items = pm.response.json();
pm.test('NCR cities and Pateros', () => {
  const byCode = Object.fromEntries(items.map((c) => [c.code, c]));
  pm.expect(byCode['1381300000']).to.include({ name: 'Quezon City', level: 'city' });
  pm.expect(byCode['1381701000']).to.include({ level: 'municipality' });
});
pm.test('answers within 6 s (PSGC timeout + fallback)', () => pm.expect(pm.response.responseTime).to.be.below(6000));`,
    }),
    request('Provinces without parent → 422', {
      path: '/insights/locations/provinces',
      tests: fieldError('parent'),
    }),
    request('Provinces with a 9-digit parent → 422', {
      path: '/insights/locations/provinces?parent=010000000',
      tests: fieldError('parent'),
    }),
    request('Provinces of an unknown region → 404', {
      path: '/insights/locations/provinces?parent=9900000000',
      tests: `${status(404)}\n${envelope('NOT_FOUND')}`,
    }),
    request('Unknown location level → 404', {
      path: '/insights/locations/barangays?parent=1381300000',
      tests: `${status(404)}\n${envelope('NOT_FOUND')}`,
    }),
    request('The gateway does not route /internal → 404', {
      url: '{{gatewayRoot}}/internal/job-postings/{{insightsPostingId}}/summary',
      prerequest: GATEWAY_ROOT,
      tests: `${status(404)}\n${envelope('NOT_FOUND')}`,
    }),
    request('T16 Core /internal without X-Service-Key → 401', {
      url: '{{coreUrl}}/internal/job-postings/{{insightsPostingId}}/summary',
      description: 'Calls Core directly (not through the gateway). Only with --env-var coreUrl=http://127.0.0.1:8001 – Core is private in production.',
      prerequest: `if (!pm.environment.get('coreUrl')) pm.execution.skipRequest();`,
      tests: `${status(401)}\n${envelope('UNAUTHENTICATED')}`,
    }),
  ],
);

// ---------------------------------------------------------------- 09 Negative & Security Cases

const negativeSecurity = folder(
  '09 Negative & Security Cases',
  'T09 + role, ownership, privacy, injection, CORS/header and suspension cases. Uses the throwaway employer from 08 (password postman-pass-123): it posts, is suspended and reactivated, and deletes its posting again.',
  [
    request('Admin user id (for the self-suspension case)', {
      path: '/me',
      auth: bearer('adminToken'),
      tests: `${status(200)}\npm.collectionVariables.set('adminUserId', pm.response.json().id);`,
    }),
    request('Throwaway employer user id', {
      path: '/me',
      auth: bearer('pmEmployerToken'),
      tests: `${status(200)}\npm.collectionVariables.set('pmUserId', pm.response.json().id);`,
    }),
    request('Throwaway employer submits a posting → 201', {
      method: 'POST',
      path: '/job-postings',
      auth: bearer('pmEmployerToken'),
      prerequest: INT_IDS,
      body: postingBody({ title: 'Postman Suspension Test', description: 'Created by the Postman run for folder 09. Deleted at the end.' }),
      tests: `${status(201)}\npm.collectionVariables.set('secPostingId', pm.response.json().id);`,
    }),
    request('Admin approves it → open', {
      method: 'PATCH',
      path: '/admin/job-postings/{{secPostingId}}/approve',
      auth: bearer('adminToken'),
      body: { action: 'approve' },
      tests: `${status(200)}\npm.test('status is open', () => pm.expect(pm.response.json().status).to.eql('open'));`,
    }),
    request('Guest sees the open posting', {
      path: '/job-postings/{{secPostingId}}',
      tests: status(200),
    }),

    // Authentication
    request('T09 GET /applications without a token → 401 UNAUTHENTICATED', {
      path: '/applications',
      tests: `${status(401)}\n${envelope('UNAUTHENTICATED')}`,
    }),
    request('Forged token → 401 UNAUTHENTICATED', {
      path: '/me',
      auth: { type: 'bearer', bearer: [{ key: 'token', value: '1|forged-token-that-was-never-issued', type: 'string' }] },
      tests: `${status(401)}\n${envelope('UNAUTHENTICATED')}`,
    }),

    // Roles and ownership (server-side, whatever the UI shows)
    request('Candidate cannot open the admin dashboard → 403', {
      path: '/admin/dashboard',
      auth: bearer('candidateToken'),
      tests: `${status(403)}\n${envelope('FORBIDDEN')}`,
    }),
    request('Employer cannot list users → 403', {
      path: '/admin/users',
      auth: bearer('employerToken'),
      tests: `${status(403)}\n${envelope('FORBIDDEN')}`,
    }),
    request('Candidate cannot edit a posting → 403', {
      method: 'PUT',
      path: '/job-postings/{{secPostingId}}',
      auth: bearer('candidateToken'),
      prerequest: INT_IDS,
      body: postingBody({ title: 'Hijacked' }),
      tests: `${status(403)}\n${envelope('FORBIDDEN')}`,
    }),
    request("Another employer cannot close someone else's posting → 403", {
      method: 'PATCH',
      path: '/job-postings/{{secPostingId}}/status',
      auth: bearer('employer2Token'),
      body: { status: 'closed' },
      tests: `${status(403)}\n${envelope('FORBIDDEN')}`,
    }),
    request("Another employer cannot delete someone else's posting → 403", {
      method: 'DELETE',
      path: '/job-postings/{{secPostingId}}',
      auth: bearer('employer2Token'),
      tests: `${status(403)}\n${envelope('FORBIDDEN')}`,
    }),
    request("A candidate cannot read another candidate's application → 403", {
      path: '/applications/{{applicationId}}',
      auth: bearer('candidateToken'),
      tests: `${status(403)}\n${envelope('FORBIDDEN')}`,
    }),
    request('An employer cannot read an application to another employer → 403 (needs stay private)', {
      path: '/applications/{{applicationId}}',
      auth: bearer('employer2Token'),
      tests: `${status(403)}\n${envelope('FORBIDDEN')}`,
    }),
    request('Admin cannot suspend their own account → 422 errors.suspended', {
      method: 'PATCH',
      path: '/admin/users/{{adminUserId}}/suspend',
      auth: bearer('adminToken'),
      body: { suspended: true },
      tests: fieldError('suspended'),
    }),

    // Input handling
    request("Search text is never SQL: ' OR '1'='1 → 200, nothing matched", {
      path: "/job-postings?q=%27%20OR%20%271%27%3D%271",
      tests: `${status(200)}\npm.test('no postings match the literal text', () => pm.expect(pm.response.json().meta.total).to.eql(0));`,
    }),
    request('Search text over 100 characters → 422 errors.q', {
      path: `/job-postings?q=${'a'.repeat(101)}`,
      tests: fieldError('q'),
    }),
    request('Malformed JSON → 422 envelope, no stack trace', {
      method: 'POST',
      path: '/login',
      raw: '{"email": "x@opendoor.test", ',
      tests: `
${status(422)}
${envelope('VALIDATION_FAILED')}
pm.test('no exception details leak', () => {
  pm.expect(body).to.not.have.any.keys('exception', 'trace', 'file', 'line');
  pm.expect(pm.response.text()).to.not.include('vendor/laravel');
});`,
    }),

    // Gateway hardening
    request('Unknown origin gets no CORS allow header', {
      path: '/categories',
      headers: { Origin: 'https://evil.example' },
      tests: `${status(200)}\npm.test('no Access-Control-Allow-Origin', () => pm.expect(pm.response.headers.has('Access-Control-Allow-Origin')).to.eql(false));`,
    }),
    request('Upstream stack is not disclosed (no X-Powered-By)', {
      path: '/categories',
      tests: `${status(200)}\npm.test('no X-Powered-By', () => pm.expect(pm.response.headers.has('X-Powered-By')).to.eql(false));`,
    }),

    // Suspension (M10): login blocked, tokens revoked, postings hidden until reactivation
    request('Admin suspends the throwaway employer → 200', {
      method: 'PATCH',
      path: '/admin/users/{{pmUserId}}/suspend',
      auth: bearer('adminToken'),
      body: { suspended: true },
      tests: `${status(200)}\npm.test('is_active is false', () => pm.expect(pm.response.json().is_active).to.eql(false));`,
    }),
    request("Suspended employer's old token → 401", {
      path: '/me',
      auth: bearer('pmEmployerToken'),
      tests: `${status(401)}\n${envelope('UNAUTHENTICATED')}`,
    }),
    request('Suspended employer cannot log in → 403 ACCOUNT_SUSPENDED', {
      method: 'POST',
      path: '/login',
      body: { email: '{{pmEmployerEmail}}', password: 'postman-pass-123' },
      tests: `${status(403)}\n${envelope('ACCOUNT_SUSPENDED')}`,
    }),
    request("Suspended employer's posting is hidden → 404", {
      path: '/job-postings/{{secPostingId}}',
      tests: `${status(404)}\n${envelope('NOT_FOUND')}`,
    }),
    request("Suspended employer's posting is not in search", {
      path: '/job-postings?q=Postman%20Suspension%20Test',
      tests: `${status(200)}\npm.test('not listed', () => pm.expect(pm.response.json().data.map((p) => p.id)).to.not.include(Number(pm.collectionVariables.get('secPostingId'))));`,
    }),
    request('Candidate cannot save it → 404', {
      method: 'POST',
      path: '/candidate/saved-jobs/{{secPostingId}}',
      auth: bearer('newCandidateLoginToken'),
      tests: `${status(404)}\n${envelope('NOT_FOUND')}`,
    }),
    request('Candidate cannot apply to it → 404', {
      method: 'POST',
      path: '/job-postings/{{secPostingId}}/applications',
      auth: bearer('newCandidateLoginToken'),
      body: {},
      tests: `${status(404)}\n${envelope('NOT_FOUND')}`,
    }),
    request('Admin reactivates the employer → 200', {
      method: 'PATCH',
      path: '/admin/users/{{pmUserId}}/suspend',
      auth: bearer('adminToken'),
      body: { suspended: false },
      tests: `${status(200)}\npm.test('is_active is true', () => pm.expect(pm.response.json().is_active).to.eql(true));`,
    }),
    request('The posting is visible again', {
      path: '/job-postings/{{secPostingId}}',
      tests: `${status(200)}\npm.test('still open (nothing was changed)', () => pm.expect(pm.response.json().status).to.eql('open'));`,
    }),
    request('Throwaway employer logs in again', {
      method: 'POST',
      path: '/login',
      body: { email: '{{pmEmployerEmail}}', password: 'postman-pass-123' },
      tests: `${status(200)}\npm.collectionVariables.set('pmEmployerToken', pm.response.json().token);`,
    }),
    // Admin removal (soft delete with a reason; also the cleanup of this folder)
    request('Admin removal without a reason → 422 errors.reason', {
      method: 'DELETE',
      path: '/admin/job-postings/{{secPostingId}}',
      auth: bearer('adminToken'),
      body: { reason: '' },
      tests: fieldError('reason'),
    }),
    request('Employer cannot use the admin removal → 403', {
      method: 'DELETE',
      path: '/admin/job-postings/{{secPostingId}}',
      auth: bearer('pmEmployerToken'),
      body: { reason: 'Mine.' },
      tests: `${status(403)}\n${envelope('FORBIDDEN')}`,
    }),
    request('Admin removes the posting with a reason → 204', {
      method: 'DELETE',
      path: '/admin/job-postings/{{secPostingId}}',
      auth: bearer('adminToken'),
      body: { reason: 'Removed by the Postman run.' },
      tests: status(204),
    }),
    request('The employer is told why', {
      path: '/notifications',
      auth: bearer('pmEmployerToken'),
      tests: `
${status(200)}
pm.test('newest notice is the removal with the reason', () => {
  const n = pm.response.json().data[0];
  pm.expect(n.type).to.eql('posting_review');
  pm.expect(n.data.removed).to.eql(true);
  pm.expect(n.data.job_posting_id).to.eql(Number(pm.collectionVariables.get('secPostingId')));
  pm.expect(n.data.message).to.include('Removed by the Postman run.');
});`,
    }),
    request('The removed posting is gone → 404; removing again → 404', {
      method: 'DELETE',
      path: '/admin/job-postings/{{secPostingId}}',
      auth: bearer('adminToken'),
      body: { reason: 'Again.' },
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
  variable: ['newCandidateEmail', 'newCandidateToken', 'newCandidateLoginToken', 'adminToken', 'employerToken', 'candidateToken', 'categoryName', 'categoryId', 'accommodationName', 'accommodationId', 'employer2Token', 'employerId', 'postingCategoryId', 'postingClosesAt', 'accA', 'accB', 'accC', 'jobPostingId', 'needA', 'needB', 'resumeUrl', 'searchPostingId', 'searchCategoryId', 'filterAccA', 'filterAccB', 'appPostingId', 'applicationId', 'candidate2Token', 'feedbackApplicationId', 'feedbackEmployerId', 'feedbackGiven', 'feedbackItems', 'feedbackPayload', 'feedbackPartialPayload', 'kalingaId', 'kalingaCompany', 'pmEmployerEmail', 'pmRegNo', 'pmEmployerToken', 'pmEmployerId', 'insightsPostingId', 'insightsPsgcCode', 'gatewayRoot', 'adminUserId', 'pmUserId', 'secPostingId'].map(
    (key) => ({ key, value: '' }),
  ),
  item: [auth, masterData, employerPostings, candidateSearch, applications, feedback, insights, adminRegistry, negativeSecurity],
};

const target = fileURLToPath(new URL('./OpenDoor.postman_collection.json', import.meta.url));
writeFileSync(target, JSON.stringify(collection, null, 2) + '\n');
console.log(`Wrote ${target}: ${collection.item.map((f) => `${f.name} (${f.item.length})`).join(', ')}`);
