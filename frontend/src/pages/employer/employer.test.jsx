import { screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { accommodationGroups, application, categories, job, skillsList } from '../../test/fixtures.js';
import { apiError, paged, renderApp, validationError } from '../../test/render.jsx';

const company = {
  id: 7,
  company_name: 'Bayanihan Tech Solutions',
  verified: true,
  industry: 'Information Technology',
  address: '123 Quezon Ave.',
  location: { psgc_code: '1381300000', label: 'Quezon City, NCR' },
  description: null,
  logo_url: null,
  trust_score: { published: false, score: null, based_on: 1 },
  business_reg_no: 'DTI-123456',
  registry_type: 'DTI',
  verified_at: '2026-10-02T10:00:00+08:00',
  verification_rejected_reason: null,
};

describe('CompanyProfilePage', () => {
  test('a new employer fills in the company and saves it as JSON', async () => {
    const { user, calls } = renderApp('/employer/company', {
      as: 'employer',
      routes: {
        'GET /employer/company': () => apiError(404, 'NOT_FOUND'),
        'PUT /employer/company': () => [200, { ...company, verified_at: null }],
        'GET /insights/locations/regions': () => [200, []],
      },
    });

    await user.type(await screen.findByLabelText(/Company name/), 'Kalinga Foods Inc.');
    await user.click(screen.getByLabelText(/SEC/));
    await user.type(screen.getByLabelText(/Business registration number/), 'CS201912345');
    await user.type(screen.getByLabelText(/Industry/), 'Food');
    await user.type(screen.getByLabelText(/Office address/), '1 Ayala Ave.');
    await user.click(screen.getByRole('button', { name: 'Save company profile' }));

    expect(await screen.findByText('Your company profile is saved.')).toBeInTheDocument();
    expect(screen.getByText('Waiting for verification')).toBeInTheDocument();
    // The form now shows the stored values (the API normalizes the registration number).
    expect(screen.getByLabelText(/Business registration number/)).toHaveValue('DTI-123456');
    expect(calls.find((call) => call.key === 'PUT /employer/company').data).toEqual({
      company_name: 'Kalinga Foods Inc.',
      business_reg_no: 'CS201912345',
      registry_type: 'SEC',
      industry: 'Food',
      address: '1 Ayala Ave.',
      location_psgc: null,
      location_label: null,
      description: null,
    });
  });

  test('a verified employer is warned that a new registration number removes the badge', async () => {
    const { user } = renderApp('/employer/company', { as: 'employer', routes: { 'GET /employer/company': () => [200, company] } });

    expect(await screen.findByText('Verified employer')).toBeInTheDocument();
    const regNo = screen.getByLabelText(/Business registration number/);
    await user.type(regNo, '9');
    expect(regNo).toHaveAccessibleDescription(/removes your Verified badge/);
  });

  test('the optional details are folded away and open when one of them has an error', async () => {
    const { user } = renderApp('/employer/company', {
      as: 'employer',
      routes: {
        'GET /employer/company': () => [200, company],
        'PUT /employer/company': () => validationError({ description: ['The description may not be greater than 5000 characters.'] }),
      },
    });

    const details = (await screen.findByText('More details: about the company and logo')).closest('details');
    expect(details).not.toHaveAttribute('open');
    await user.click(screen.getByRole('button', { name: 'Save company profile' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('may not be greater than 5000 characters');
    expect(details).toHaveAttribute('open');
  });

  test('a logo upload is sent as multipart with _method=PUT', async () => {
    const { user, calls } = renderApp('/employer/company', {
      as: 'employer',
      routes: { 'GET /employer/company': () => [200, company], 'POST /employer/company': () => [200, company] },
    });

    await user.upload(await screen.findByLabelText(/^Logo/), new File(['png'], 'logo.png', { type: 'image/png' }));
    await user.click(screen.getByRole('button', { name: 'Save company profile' }));

    await screen.findByText('Your company profile is saved.');
    const body = calls.find((call) => call.key === 'POST /employer/company').config.data;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('_method')).toBe('PUT');
    expect(body.get('logo').name).toBe('logo.png');
  });
});

describe('PostingFormPage', () => {
  const routes = {
    'GET /categories': () => [200, { data: categories }],
    'GET /accommodations': () => [200, { data: accommodationGroups }],
    'GET /skills': () => [200, { data: skillsList }],
    'GET /insights/locations/regions': () => [200, []],
    'GET /employer/company': () => [200, { id: 3, company_name: 'Bayanihan Tech Solutions', verified_at: '2026-10-01T09:00:00+08:00' }],
  };

  // Walks through the steps to the review.
  async function fillRequired(user) {
    await user.type(await screen.findByLabelText(/Job title/), 'Data Encoder');
    await user.selectOptions(screen.getByLabelText(/Category/), 'Administrative');
    await user.click(screen.getByLabelText('Part-time'));
    await user.click(screen.getByLabelText('Hybrid'));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.type(screen.getByLabelText(/Job description/), 'Encode records.');
    await user.click(screen.getByLabelText('Online interview'));
    await user.type(screen.getByLabelText(/Workplace address/), '123 Quezon Ave.');
    await user.type(screen.getByLabelText(/Applications close on/), '2099-11-30');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.type(screen.getByRole('combobox', { name: /Skills this job needs/ }), 'encoding{Enter}');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByLabelText('Wheelchair-accessible entrance'));
    await user.type(screen.getByLabelText(/Details for “Wheelchair-accessible entrance”/), 'Ramp at gate 2');
    await user.click(screen.getByRole('button', { name: 'Next' }));
  }

  test('each step is checked before the next; the review shows everything', async () => {
    const { user, calls } = renderApp('/employer/jobs/new', { as: 'employer', routes });

    await screen.findByRole('heading', { level: 2, name: 'Step 1 of 5 · Job basics' });
    await user.click(screen.getByRole('button', { name: 'Next' }));
    const summary = await screen.findByRole('alert');
    expect(summary).toHaveFocus();
    expect(summary).toHaveTextContent('Enter a job title.');
    expect(summary).toHaveTextContent('Choose a work setup.');

    await fillRequired(user);
    expect(screen.getByRole('heading', { level: 2, name: 'Step 5 of 5 · Review and publish' })).toHaveFocus();
    const basics = screen.getByRole('region', { name: 'Job basics' });
    expect(basics).toHaveTextContent('Data Encoder');
    expect(basics).toHaveTextContent('Part-time');
    expect(screen.getByRole('region', { name: 'Accommodations offered' })).toHaveTextContent('Wheelchair-accessible entrance: Ramp at gate 2');
    expect(screen.getByRole('region', { name: 'Skills and qualifications' })).toHaveTextContent('Data entry');

    await user.click(screen.getByRole('button', { name: 'Change description and place' }));
    expect(screen.getByLabelText(/Workplace address/)).toHaveValue('123 Quezon Ave.');
    expect(calls.some((call) => call.key === 'POST /job-postings')).toBe(false);
  });

  test('publishes a new posting with accommodations and notes', async () => {
    const { user, calls, location } = renderApp('/employer/jobs/new', {
      as: 'employer',
      routes: {
        ...routes,
        'POST /job-postings': () => [201, { ...job, status: 'open' }],
        'GET /employer/job-postings': () => [200, paged([])],
      },
    });

    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: 'Publish job' }));

    expect(await screen.findByText('“Data Encoder” is published and open to job seekers.')).toBeInTheDocument();
    expect(location()).toBe('/employer/jobs');
    expect(calls.find((call) => call.key === 'POST /job-postings').data).toEqual({
      title: 'Data Encoder',
      description: 'Encode records.',
      category_id: 1,
      address: '123 Quezon Ave.',
      location_psgc: null,
      location_label: null,
      employment_type: 'part_time',
      work_setup: 'hybrid',
      interview_format: 'online',
      closes_at: '2099-11-30',
      skills: ['Data entry'],
      education_level: null,
      experience_years: null,
      qualifications: null,
      accommodations: [{ id: 1, note: 'Ramp at gate 2' }],
      submit: true,
    });
  });

  test('save as draft sends submit false; item errors point to the accommodations group', async () => {
    const { user, calls } = renderApp('/employer/jobs/new', {
      as: 'employer',
      routes: { ...routes, 'POST /job-postings': () => validationError({ 'accommodations.0.note': ['The note may not be greater than 255 characters.'] }) },
    });

    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: 'Save as draft' }));

    // The error sends the employer back to the Accommodations step.
    await user.click(await screen.findByRole('link', { name: /may not be greater than 255/ }));
    expect(screen.getByRole('heading', { level: 2, name: 'Step 4 of 5 · Accommodations' })).toBeInTheDocument();
    expect(document.getElementById('accommodations')).toHaveFocus();
    expect(calls.find((call) => call.key === 'POST /job-postings').data.submit).toBe(false);
  });

  test('without a company profile the employer is linked to set it up', async () => {
    const { user } = renderApp('/employer/jobs/new', {
      as: 'employer',
      routes: { ...routes, 'POST /job-postings': () => validationError({ company: ['Create your company profile before posting a job.'] }) },
    });

    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: 'Publish job' }));

    expect(await screen.findByRole('link', { name: 'Set up your company profile' })).toHaveAttribute('href', '/employer/company');
    expect(screen.queryByText('There is a problem')).not.toBeInTheDocument();
  });

  test('editing an open posting publishes the changes and offers Cancel, not draft', async () => {
    const { user } = renderApp('/employer/jobs/42/edit', {
      as: 'employer',
      routes: { ...routes, 'GET /job-postings/42': () => [200, { ...job, status: 'open', skills: ['Data entry'] }] },
    });

    expect(await screen.findByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/employer/jobs');
    expect(screen.queryByRole('button', { name: 'Save as draft' })).not.toBeInTheDocument();
    for (let step = 0; step < 4; step += 1) await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('button', { name: 'Publish changes' })).toBeInTheDocument();
  });

  test('an unverified company is told why and can only save a draft', async () => {
    const { user, calls } = renderApp('/employer/jobs/new', {
      as: 'employer',
      routes: {
        ...routes,
        'GET /employer/company': () => [200, { id: 3, company_name: 'Kalinga Foods Inc.', verified_at: null }],
        'POST /job-postings': () => [201, { ...job, status: 'draft' }],
        'GET /employer/job-postings': () => [200, paged([])],
      },
    });

    expect(await screen.findByText('Your company is not verified yet')).toBeInTheDocument();
    await fillRequired(user);
    expect(screen.queryByRole('button', { name: 'Publish job' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save as draft' }));

    expect(await screen.findByText('“Data Encoder” was saved as a draft.')).toBeInTheDocument();
    expect(calls.find((call) => call.key === 'POST /job-postings').data.submit).toBe(false);
  });

  test('editing loads the posting and shows a rejection reason', async () => {
    const { user } = renderApp('/employer/jobs/42/edit', {
      as: 'employer',
      routes: { ...routes, 'GET /job-postings/42': () => [200, { ...job, status: 'draft', skills: ['Data entry'], rejection_reason: 'Please describe the hours.' }] },
    });

    expect(await screen.findByRole('heading', { level: 1, name: 'Edit “Data Encoder”' })).toBeInTheDocument();
    expect(screen.getByText(/Please describe the hours/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to job postings' })).toHaveAttribute('href', '/employer/jobs');
    // Editing starts at step 1 with the saved values; each step keeps them.
    expect(screen.getByLabelText(/Job title/)).toHaveValue('Data Encoder');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('list', { name: /Skills this job needs/ })).toHaveTextContent('Data entry');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByLabelText('Wheelchair-accessible entrance')).toBeChecked();
    expect(screen.getByLabelText(/Details for “Wheelchair-accessible entrance”/)).toHaveValue('Ramp at main entrance');
  });
});

describe('PostingsPage', () => {
  test('lists postings, closes an open one and deletes after confirmation', async () => {
    const { user, calls } = renderApp('/employer/jobs', {
      as: 'employer',
      routes: {
        'GET /employer/job-postings': () => [200, paged([{ ...job, applicants_count: 3 }])],
        'PATCH /job-postings/42/status': () => [200, { ...job, status: 'closed' }],
        'DELETE /job-postings/42': () => [204, ''],
      },
    });

    expect(await screen.findByRole('link', { name: '3 applicants for Data Encoder' })).toHaveAttribute('href', '/employer/jobs/42/applicants');
    await user.click(screen.getByRole('button', { name: 'Close Data Encoder' }));
    expect(await screen.findByRole('button', { name: 'Reopen Data Encoder' })).toBeInTheDocument();
    expect(calls.find((call) => call.key === 'PATCH /job-postings/42/status').data).toEqual({ status: 'closed' });

    await user.click(screen.getByRole('button', { name: 'Delete Data Encoder' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete posting' }));
    expect(await screen.findByText('“Data Encoder” was deleted.')).toBeInTheDocument();
  });
});

describe('EmployerApplicationPage', () => {
  test('shows needs against the posting and the interview request; shortlists, then marks as contacted', async () => {
    const { user, calls } = renderApp('/employer/applications/11', {
      as: 'employer',
      routes: {
        'GET /applications/11': () => [
          200,
          { ...application, status: 'reviewed', candidate: { ...application.candidate, accommodations: [job.accommodations[0], { id: 2, name: 'Accessible restroom', group: 'physical_access' }] } },
        ],
        'PATCH /applications/11/status': (config) => [200, { ...application, status: JSON.parse(config.data).status }],
      },
    });

    expect(await screen.findByText(/Captions in the video call/)).toBeInTheDocument();
    expect(screen.getByText('Wheelchair-accessible entrance', { exact: false }).closest('li')).toHaveTextContent('offered in your posting');
    expect(screen.getByText('Accessible restroom', { exact: false }).closest('li')).toHaveTextContent('not listed in your posting');

    // Reviewed: Shortlist, Mark as contacted and Not selected, in that order.
    const actions = () => screen.queryAllByRole('button', { name: /^(Shortlist|Mark as contacted|Not selected)$/ }).map((button) => button.textContent);
    expect(actions()).toEqual(['Shortlist', 'Mark as contacted', 'Not selected']);

    await user.click(screen.getByRole('button', { name: 'Shortlist' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Add this applicant to your shortlist?' })).getByRole('button', { name: 'Shortlist' }));
    expect(await screen.findByText('The applicant is on your shortlist.')).toBeInTheDocument();
    expect(actions()).toEqual(['Mark as contacted', 'Not selected']);

    await user.click(screen.getByRole('button', { name: 'Mark as contacted' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Mark this applicant as contacted?' })).getByRole('button', { name: 'Mark as contacted' }));
    expect(await screen.findByText('The applicant is marked as contacted.')).toBeInTheDocument();
    expect(calls.filter((call) => call.key === 'PATCH /applications/11/status').map((call) => call.data)).toEqual([{ status: 'shortlisted' }, { status: 'contacted' }]);
    expect(actions()).toEqual([]);
  });

  test('shows skills, experience, a shared disability and the résumé link', async () => {
    const candidate = {
      ...application.candidate,
      skills: ['Excel', 'Typing'],
      experience: 'Three years of data entry.',
      disability_type: 'Low vision',
      resume_url: 'http://localhost:8080/api/resumes/4?expires=1&signature=abc',
    };
    renderApp('/employer/applications/11', { as: 'employer', routes: { 'GET /applications/11': () => [200, { ...application, status: 'reviewed', candidate }] } });

    expect(await screen.findByText('Excel, Typing')).toBeInTheDocument();
    expect(screen.getByText('Three years of data entry.')).toBeInTheDocument();
    expect(screen.getByText('Low vision')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Open the résumé (PDF, opens in a new tab)' });
    expect(link).toHaveAttribute('href', candidate.resume_url);
    expect(link).toHaveAttribute('target', '_blank');
  });

  test('without shared details the page says so and hides the disability row', async () => {
    renderApp('/employer/applications/11', {
      as: 'employer',
      routes: { 'GET /applications/11': () => [200, { ...application, candidate: { ...application.candidate, skills: [], experience: null, disability_type: null, resume_url: null } }] },
    });

    expect(await screen.findByText('No résumé uploaded')).toBeInTheDocument();
    expect(screen.getAllByText('Not listed')).toHaveLength(4);
    expect(screen.queryByText('Disability (shared by the applicant)')).not.toBeInTheDocument();
  });

  test('final statuses offer no decisions', async () => {
    renderApp('/employer/applications/11', { as: 'employer', routes: { 'GET /applications/11': () => [200, { ...application, status: 'withdrawn' }] } });

    expect(await screen.findByText('Withdrawn')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark as contacted' })).not.toBeInTheDocument();
  });
});

describe('Employer trust score and dashboard', () => {
  test('trust score page loads the score for the own company', async () => {
    renderApp('/employer/trust-score', {
      as: 'employer',
      routes: {
        'GET /employer/company': () => [200, company],
        'GET /employers/7/trust-score': () => [200, { published: false, score: null, based_on: 2, breakdown: [] }],
      },
    });

    expect(await screen.findByText(/\(2 of 3 so far\)/)).toBeInTheDocument();
  });

  test('dashboard prompts for the company profile', async () => {
    renderApp('/employer/dashboard', {
      as: 'employer',
      routes: {
        'GET /employer/dashboard': () => [
          200,
          { company: { exists: false, verified: false }, postings: { open: 2 }, applications: { pending: 5 }, trust_score: { published: false, based_on: 0 } },
        ],
      },
    });

    expect(await screen.findByRole('link', { name: 'Set up company' })).toHaveAttribute('href', '/employer/company');
    expect(screen.getByRole('link', { name: 'View Open (2)' })).toHaveAttribute('href', '/employer/jobs?status=open');
  });

  test('dashboard shows the counts and links to the score breakdown', async () => {
    renderApp('/employer/dashboard', {
      as: 'employer',
      routes: {
        'GET /employer/dashboard': () => [
          200,
          {
            company: { exists: true, verified: true },
            postings: { draft: 1, open: 2 },
            applications: { pending: 3, reviewed: 2, shortlisted: 1, contacted: 1 },
            trust_score: { published: true, score: 79, based_on: 3 },
          },
        ],
      },
    });

    expect(await screen.findByRole('link', { name: 'View Open (2)' })).toHaveAttribute('href', '/employer/jobs?status=open');
    expect(screen.queryByText(/waiting for approval/)).not.toBeInTheDocument();
    const applications = screen.getByRole('region', { name: 'Applications received' });
    expect(within(applications).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['3Submitted', '2Under review', '1Shortlisted', '1Contacted']);
    expect(within(applications).queryByRole('link')).not.toBeInTheDocument();
    const trust = screen.getByRole('region', { name: 'Trust score' });
    expect(within(trust).getByText('79%')).toBeInTheDocument();
    expect(within(trust).getByRole('link', { name: 'See each accommodation' })).toHaveAttribute('href', '/employer/trust-score');
  });
});
