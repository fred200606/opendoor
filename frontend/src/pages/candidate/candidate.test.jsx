import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { accommodationGroups, application, job, skillsList } from '../../test/fixtures.js';
import { apiError, paged, renderApp, users, validationError } from '../../test/render.jsx';

const profile = {
  id: 3,
  headline: 'Data encoder',
  skills: ['Microsoft Excel', 'Typing'],
  experience: '3 years',
  education_level: 'senior_high',
  experience_years: 3,
  preferred_work_setups: ['onsite'],
  preferred_employment_types: ['full_time'],
  location_psgc: '1381300000',
  location: { psgc_code: '1381300000', label: 'Quezon City, NCR' },
  disability_type: null,
  show_disability: false,
  resume_url: null,
  accommodations: [{ id: 2, name: 'Accessible restroom', group: 'physical_access' }],
};

describe('CandidateSetupPage', () => {
  const incomplete = { ...users.candidate, profile_complete: false };
  const routes = {
    'GET /me': () => [200, incomplete],
    'GET /candidate/profile': () => apiError(404, 'NOT_FOUND'),
    'GET /skills': () => [200, { data: skillsList }],
    'GET /insights/locations/regions': () => [200, []],
  };

  test('an incomplete profile is sent to the setup from any candidate page', async () => {
    const { location } = renderApp('/candidate/jobs', { as: 'candidate', routes });

    expect(await screen.findByRole('heading', { level: 1, name: 'Complete your profile' })).toBeInTheDocument();
    expect(location()).toBe('/candidate/setup');
    // The welcome tour waits for the dashboard.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('every missing answer is listed at once, nothing is sent', async () => {
    const { user, calls } = renderApp('/candidate/setup', { as: 'candidate', routes });

    await user.click(await screen.findByRole('button', { name: 'Save and continue' }));

    const summary = screen.getByRole('alert', { name: 'There is a problem' });
    expect(summary).toHaveFocus();
    expect(within(summary).getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Choose the city or municipality where you live.',
      'Add at least 3 skills.',
      'Choose your highest education.',
      'Choose at least one work setup.',
      'Choose at least one type of work.',
    ]);
    expect(calls.some((call) => call.key === 'PUT /candidate/profile')).toBe(false);
  });

  test('a complete answer is saved and opens the dashboard', async () => {
    const saved = { ...profile, profile_complete: true, profile_missing: [] };
    const { user, calls, location } = renderApp('/candidate/setup', {
      as: 'candidate',
      routes: {
        ...routes,
        'GET /candidate/profile': () => [200, { ...profile, skills: ['Typing'], education_level: null, preferred_work_setups: [], preferred_employment_types: [] }],
        'PUT /candidate/profile': () => [200, saved],
        'GET /candidate/dashboard': () => [200, { applications: {}, matching_jobs: 0, feedback_due: [] }],
        'GET /job-postings': () => [200, paged([])],
      },
    });

    const skills = await screen.findByRole('combobox', { name: /Your skills/ });
    await user.type(skills, 'excel{Enter}');
    await user.type(skills, 'Data entry{Enter}');
    await user.selectOptions(screen.getByLabelText(/Highest education/), 'Senior high school');
    await user.click(within(screen.getByRole('group', { name: /Work setups you prefer/ })).getByLabelText('Hybrid'));
    await user.click(within(screen.getByRole('group', { name: /Types of work you want/ })).getByLabelText('Part-time'));
    await user.click(screen.getByRole('button', { name: 'Save and continue' }));

    await vi.waitFor(() => expect(location()).toBe('/candidate/dashboard'));
    expect(await screen.findByText('Your profile is complete. Here are the jobs we recommend for you.')).toBeInTheDocument();
    expect(location()).toBe('/candidate/dashboard');
    expect(calls.find((call) => call.key === 'PUT /candidate/profile').data).toEqual({
      location_psgc: '1381300000',
      location_label: 'Quezon City, NCR',
      skills: ['Typing', 'Microsoft Excel', 'Data entry'],
      education_level: 'senior_high',
      experience_years: 3,
      preferred_work_setups: ['hybrid'],
      preferred_employment_types: ['part_time'],
    });
  });
});

describe('CandidateProfilePage', () => {
  const routes = {
    'GET /candidate/profile': () => [200, profile],
    'GET /accommodations': () => [200, { data: accommodationGroups }],
    'GET /skills': () => [200, { data: skillsList }],
  };

  test('saves needs as accommodation_ids', async () => {
    const { user, calls } = renderApp('/candidate/profile', {
      as: 'candidate',
      routes: { ...routes, 'PUT /candidate/accommodations': () => [200, { data: [] }] },
    });

    expect(await screen.findByLabelText('Accessible restroom')).toBeChecked();
    await user.click(screen.getByLabelText('Sign language interpreter'));
    await user.click(screen.getByRole('button', { name: 'Save my needs' }));

    expect(await screen.findByText('Your needs are saved.')).toBeInTheDocument();
    expect(calls.find((call) => call.key === 'PUT /candidate/accommodations').data).toEqual({ accommodation_ids: [2, 5] });
  });

  test('saves the profile with skills from the list or typed; disability stays private by default', async () => {
    const { user, calls } = renderApp('/candidate/profile', {
      as: 'candidate',
      routes: { ...routes, 'PUT /candidate/profile': () => [200, profile] },
    });

    await user.click(await screen.findByRole('tab', { name: 'About you' }));
    const skills = screen.getByRole('combobox', { name: /Your skills/ });
    await user.click(screen.getByRole('button', { name: 'Remove Typing' }));
    expect(skills).toHaveFocus();
    expect(screen.getByText('Removed Typing.')).toBeInTheDocument();
    await user.type(skills, 'filing{Enter}');
    expect(screen.getByText('Added Filing and records management.')).toBeInTheDocument();
    await user.type(skills, ' inventory   counting ');
    await user.click(screen.getByRole('button', { name: 'Add skill' }));
    await user.type(skills, 'ms excel{Enter}');
    expect(screen.getByText('Microsoft Excel is already in the list.')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/Highest education/), 'College degree');
    await user.click(within(screen.getByRole('group', { name: /Work setups you prefer/ })).getByLabelText('Remote'));
    expect(screen.queryByLabelText(/Show my disability type/)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Disability type'), 'Deaf');
    expect(screen.getByLabelText(/Show my disability type/)).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(await screen.findByText('Your profile is saved.')).toBeInTheDocument();
    expect(calls.find((call) => call.key === 'PUT /candidate/profile').data).toEqual({
      headline: 'Data encoder',
      location_psgc: '1381300000',
      location_label: 'Quezon City, NCR',
      skills: ['Microsoft Excel', 'Filing and records management', 'inventory counting'],
      education_level: 'college',
      experience_years: 3,
      preferred_work_setups: ['onsite', 'remote'],
      preferred_employment_types: ['full_time'],
      experience: '3 years',
      disability_type: 'Deaf',
      show_disability: false,
    });
  });

  test('skills found in the résumé are added only after the candidate confirms them', async () => {
    const { user, calls } = renderApp('/candidate/profile?tab=about', {
      as: 'candidate',
      routes: {
        ...routes,
        'GET /candidate/profile': () => [200, { ...profile, resume_url: 'http://localhost:8080/api/resumes/3?signature=x' }],
        'GET /candidate/resume/skill-suggestions': () => [200, { data: { readable: true, skills: ['Data entry', 'Filing and records management'] } }],
        'PUT /candidate/profile': () => [200, profile],
      },
    });

    await user.click(await screen.findByRole('button', { name: 'Suggest skills from my résumé' }));
    const found = await screen.findByRole('group', { name: 'Skills found in your résumé' });
    expect(found).toHaveFocus();
    expect(screen.getByText('We found 2 skills in your résumé. Untick any that are not right.')).toBeInTheDocument();
    await user.click(within(found).getByLabelText('Filing and records management'));
    await user.click(screen.getByRole('button', { name: 'Add selected skills' }));

    expect(screen.getByRole('combobox', { name: /Your skills/ })).toHaveFocus();
    expect(screen.getByText('Added 1 skill to your skills. Save your profile to keep them.')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Your skills: added' })).toHaveTextContent('Microsoft ExcelTypingData entry');
    expect(calls.some((call) => call.key === 'PUT /candidate/profile')).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Save profile' }));
    expect(calls.find((call) => call.key === 'PUT /candidate/profile').data.skills).toEqual(['Microsoft Excel', 'Typing', 'Data entry']);
  });

  test('a résumé without readable text is explained', async () => {
    const { user } = renderApp('/candidate/profile?tab=about', {
      as: 'candidate',
      routes: {
        ...routes,
        'GET /candidate/profile': () => [200, { ...profile, resume_url: 'http://localhost:8080/api/resumes/3?signature=x' }],
        'GET /candidate/resume/skill-suggestions': () => [200, { data: { readable: false, skills: [] } }],
      },
    });

    await user.click(await screen.findByRole('button', { name: 'Suggest skills from my résumé' }));
    expect(await screen.findByText(/A scanned résumé has no text/)).toBeInTheDocument();
  });

  test('no suggest button without a résumé', async () => {
    renderApp('/candidate/profile?tab=about', { as: 'candidate', routes });

    expect(await screen.findByRole('combobox', { name: /Your skills/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Suggest skills from my résumé' })).not.toBeInTheDocument();
  });

  test('a new candidate without a profile gets an empty form and the welcome message', async () => {
    renderApp('/candidate/profile', {
      as: 'candidate',
      routes: { ...routes, 'GET /candidate/profile': () => apiError(404, 'NOT_FOUND') },
    });

    expect(await screen.findByText('None selected.')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Accommodations you need' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('You have not uploaded a résumé yet.')).not.toBeVisible();
  });

  test('tabs: arrow keys move between parts, the open tab is kept in the address', async () => {
    const { user, location } = renderApp('/candidate/profile?tab=resume', { as: 'candidate', routes });

    const resume = await screen.findByRole('tab', { name: 'Résumé' });
    expect(resume).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Résumé' })).toBeVisible();

    resume.focus();
    await user.keyboard('{Home}');
    const needs = screen.getByRole('tab', { name: 'Accommodations you need' });
    expect(needs).toHaveFocus();
    expect(needs).toHaveAttribute('aria-selected', 'true');
    expect(location()).toBe('/candidate/profile');

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'About you' })).toHaveFocus();
    expect(location()).toBe('/candidate/profile?tab=about');
    expect(screen.getByRole('combobox', { name: /Your skills/ })).toBeVisible();
  });

  test('résumé upload refuses non-PDF files before sending', async () => {
    const { user, calls } = renderApp('/candidate/profile', { as: 'candidate', routes });

    await user.click(await screen.findByRole('tab', { name: 'Résumé' }));
    const input = screen.getByLabelText('Upload résumé');
    // user.upload would drop the file because of accept="application/pdf"; a browser's "All files" option would not.
    fireEvent.change(input, {
      target: { files: [new File(['hello'], 'cv.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })] },
    });
    await user.click(screen.getByRole('button', { name: 'Upload' }));

    expect(screen.getByText(/Choose a PDF file\./)).toBeInTheDocument();
    expect(calls.some((call) => call.key === 'POST /candidate/resume')).toBe(false);
  });
});

describe('MyApplicationsPage and CandidateApplicationPage', () => {
  test('lists applications with plain-language status', async () => {
    renderApp('/candidate/applications', {
      as: 'candidate',
      routes: { 'GET /applications': () => [200, paged([{ ...application, status: 'rejected' }])] },
    });

    const row = await screen.findByRole('row', { name: /Data Encoder/ });
    expect(within(row).getByText('Not selected')).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: 'Data Encoder' })).toHaveAttribute('href', '/candidate/applications/11');
  });

  test('withdraw asks for confirmation and sends status withdrawn', async () => {
    const { user, calls } = renderApp('/candidate/applications/11', {
      as: 'candidate',
      routes: {
        'GET /applications/11': () => [200, application],
        'PATCH /applications/11/status': () => [200, { ...application, status: 'withdrawn' }],
      },
    });

    await user.click(await screen.findByRole('button', { name: 'Withdraw application' }));
    expect(screen.queryByRole('button', { name: 'The employer contacted me' })).not.toBeInTheDocument();
    const dialog = screen.getByRole('dialog', { name: 'Withdraw this application?' });
    await user.click(within(dialog).getByRole('button', { name: 'Withdraw application' }));

    expect(await screen.findByText('Your application was withdrawn.')).toBeInTheDocument();
    expect(calls.find((call) => call.key === 'PATCH /applications/11/status').data).toEqual({ status: 'withdrawn' });
    expect(screen.queryByRole('button', { name: 'Withdraw application' })).not.toBeInTheDocument();
  });

  test('a shortlisted application can be confirmed as contacted or withdrawn', async () => {
    const { user, calls } = renderApp('/candidate/applications/11', {
      as: 'candidate',
      routes: {
        'GET /applications/11': () => [200, { ...application, status: 'shortlisted' }],
        'PATCH /applications/11/status': () => [200, { ...application, status: 'contacted', contacted_at: '2026-10-22T09:00:00+08:00', feedback_opens_on: '2099-11-21' }],
      },
    });

    expect(await screen.findByRole('button', { name: 'Withdraw application' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'The employer contacted me' }));
    const dialog = screen.getByRole('dialog', { name: 'Confirm that the employer contacted you?' });
    await user.click(within(dialog).getByRole('button', { name: 'The employer contacted me' }));

    expect(await screen.findByText('Recorded: the employer contacted you.')).toBeInTheDocument();
    expect(calls.find((call) => call.key === 'PATCH /applications/11/status').data).toEqual({ status: 'contacted' });
    expect(screen.getByText(/30 days after the employer contacted you/)).toBeInTheDocument();
  });

  test('contacted: feedback link once the 30-day window is open, a date before that', async () => {
    const hired = { ...application, status: 'contacted', contacted_at: '2026-01-02T09:00:00+08:00' };
    const { unmount } = renderApp('/candidate/applications/11', {
      as: 'candidate',
      routes: { 'GET /applications/11': () => [200, { ...hired, feedback_opens_on: '2026-02-01' }] },
    });
    expect(await screen.findByRole('link', { name: 'Rate accommodations' })).toHaveAttribute('href', '/candidate/applications/11/feedback');
    unmount();

    renderApp('/candidate/applications/11', {
      as: 'candidate',
      routes: { 'GET /applications/11': () => [200, { ...hired, feedback_opens_on: '2099-02-01' }] },
    });
    expect(await screen.findByText(/You can rate the accommodations from February 1, 2099/)).toBeInTheDocument();
  });

  test('contacted and already rated: no feedback link', async () => {
    renderApp('/candidate/applications/11', {
      as: 'candidate',
      routes: {
        'GET /applications/11': () => [200, { ...application, status: 'contacted', feedback_opens_on: '2026-02-01', feedback_submitted: true }],
      },
    });

    expect(await screen.findByText(/You have rated the accommodations for this job/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Rate accommodations' })).not.toBeInTheDocument();
  });
});

describe('FeedbackPage', () => {
  const form = {
    opens_on: '2026-02-01',
    is_open: true,
    submitted: false,
    items: [
      { accommodation_id: 1, name: 'Wheelchair-accessible entrance' },
      { accommodation_id: 5, name: 'Sign language interpreter' },
    ],
  };

  test('every promised accommodation must be rated before sending', async () => {
    const { user, calls } = renderApp('/candidate/applications/11/feedback', {
      as: 'candidate',
      routes: { 'GET /applications/11/feedback-form': () => [200, form] },
    });

    const entrance = await screen.findByRole('group', { name: /Wheelchair-accessible entrance/ });
    await user.click(within(entrance).getByLabelText('Delivered'));
    await user.click(screen.getByRole('button', { name: 'Submit ratings' }));

    const summary = await screen.findByRole('alert');
    expect(summary).toHaveTextContent('Choose a rating for “Sign language interpreter”.');
    expect(calls.some((call) => call.key === 'POST /applications/11/feedback')).toBe(false);
  });

  test('sends one rating per item', async () => {
    const { user, calls } = renderApp('/candidate/applications/11/feedback', {
      as: 'candidate',
      routes: {
        'GET /applications/11/feedback-form': () => [200, form],
        'POST /applications/11/feedback': () => [201, { id: 1, application_id: 11, items_rated: 2 }],
      },
    });

    const entrance = await screen.findByRole('group', { name: /Wheelchair-accessible entrance/ });
    const interpreter = screen.getByRole('group', { name: /Sign language interpreter/ });
    await user.click(within(entrance).getByLabelText('Delivered'));
    await user.click(within(interpreter).getByLabelText('Partly delivered'));
    await user.click(screen.getByRole('button', { name: 'Submit ratings' }));

    expect(await screen.findByText('Thank you')).toBeInTheDocument();
    expect(calls.find((call) => call.key === 'POST /applications/11/feedback').data).toEqual({
      items: [
        { accommodation_id: 1, rating: 'delivered' },
        { accommodation_id: 5, rating: 'partial' },
      ],
    });
  });

  test('closed window shows the opening date', async () => {
    renderApp('/candidate/applications/11/feedback', {
      as: 'candidate',
      routes: { 'GET /applications/11/feedback-form': () => [200, { ...form, is_open: false, opens_on: '2099-01-31' }] },
    });

    expect(await screen.findByText(/from January 31, 2099/)).toBeInTheDocument();
  });

  test('an earlier response shows "Already rated" instead of the form', async () => {
    renderApp('/candidate/applications/11/feedback', {
      as: 'candidate',
      routes: { 'GET /applications/11/feedback-form': () => [200, { ...form, submitted: true }] },
    });

    expect(await screen.findByText('Already rated')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit ratings' })).not.toBeInTheDocument();
  });

  test('a posting without accommodations has nothing to rate', async () => {
    renderApp('/candidate/applications/11/feedback', {
      as: 'candidate',
      routes: { 'GET /applications/11/feedback-form': () => [200, { ...form, items: [] }] },
    });

    expect(await screen.findByText('Nothing to rate')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit ratings' })).not.toBeInTheDocument();
  });

  test('server validation for an item is linked to its question', async () => {
    const { user } = renderApp('/candidate/applications/11/feedback', {
      as: 'candidate',
      routes: {
        'GET /applications/11/feedback-form': () => [200, form],
        'POST /applications/11/feedback': () => validationError({ 'items.1.rating': ['The rating is invalid.'] }),
      },
    });

    for (const group of await within(screen.getByRole('main')).findAllByRole('group')) {
      await user.click(within(group).getByLabelText('Not delivered'));
    }
    await user.click(screen.getByRole('button', { name: 'Submit ratings' }));

    await user.click(await screen.findByRole('link', { name: 'The rating is invalid.' }));
    expect(document.getElementById('rating-5')).toHaveFocus();
  });
});

describe('CandidateDashboardPage and SavedJobsPage', () => {
  test('My applications: See all, Feedback due, the grouped counts and the latest applications', async () => {
    const mine = [
      { ...application, id: 21, status: 'shortlisted', job_posting: { ...job, title: 'Office Clerk' } },
      { ...application, id: 22, status: 'contacted', job_posting: { ...job, title: 'Data Encoder' } },
    ];
    renderApp('/candidate/dashboard', {
      as: 'candidate',
      routes: {
        'GET /candidate/dashboard': () => [
          200,
          {
            applications: { pending: 2, reviewed: 1, shortlisted: 1, contacted: 1, rejected: 1, withdrawn: 1 },
            needs_count: 0,
            matching_jobs: 4,
            feedback_due: [
              { application_id: 22, job_title: 'Data Encoder', company_name: 'Bayanihan Tech', opens_on: '2026-02-01', is_open: true },
              { application_id: 23, job_title: 'Cashier', company_name: 'Sari Store', opens_on: '2099-02-01', is_open: false },
            ],
          },
        ],
        'GET /applications': () => [200, paged(mine)],
        'GET /job-postings': () => [200, paged([])],
      },
    });

    const section = await screen.findByRole('region', { name: 'My applications' });
    expect(within(section).getByRole('link', { name: 'See all 7 applications' })).toHaveAttribute('href', '/candidate/applications');
    expect(within(section).getByText('Rate how Bayanihan Tech delivered the accommodations for Data Encoder.')).toBeInTheDocument();
    expect(within(section).getByRole('link', { name: 'Rate the accommodations for Data Encoder' })).toHaveAttribute('href', '/candidate/applications/22/feedback');
    const tiles = within(section).getAllByRole('list')[0];
    expect(within(tiles).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['3Waiting for a reply', '1Shortlisted', '1Contacted', '2Closed']);
    expect(await within(section).findByRole('link', { name: 'Office Clerk' })).toHaveAttribute('href', '/candidate/applications/21');
    const latest = within(section).getAllByRole('list')[1];
    expect(within(latest).getAllByRole('listitem').map((item) => item.querySelector('.badge').textContent)).toEqual(['Shortlisted', 'Contacted']);

    // The rating that is not open yet stays in "Ratings to give"; the open one is only in My applications.
    const ratings = screen.getByRole('region', { name: 'Ratings to give' });
    expect(within(ratings).getByText('Cashier at Sari Store')).toBeInTheDocument();
    expect(within(ratings).queryByText(/Data Encoder/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add my needs' })).toBeInTheDocument();
    expect(await within(screen.getByRole('region', { name: 'Your best matches' })).findByText('No open jobs yet. We will show the best fits here.')).toBeInTheDocument();
  });

  test('My applications before the first application', async () => {
    const { calls } = renderApp('/candidate/dashboard', {
      as: 'candidate',
      routes: { 'GET /candidate/dashboard': () => [200, { applications: {}, needs_count: 0, matching_jobs: 0, feedback_due: [] }], 'GET /job-postings': () => [200, paged([])] },
    });

    const section = await screen.findByRole('region', { name: 'My applications' });
    expect(within(section).getByText(/You have not applied yet/)).toBeInTheDocument();
    expect(within(section).getByRole('link', { name: 'Find jobs that fit you' })).toHaveAttribute('href', '/candidate/jobs');
    expect(within(section).queryByRole('link', { name: /See all/ })).not.toBeInTheDocument();
    expect(calls.some((call) => call.key === 'GET /applications')).toBe(false);
  });

  test('the three best recommended jobs are shown with their match', async () => {
    const jobs = [1, 2, 3, 4].map((id) => ({ ...job, id, title: `Job ${id}` }));
    const { calls } = renderApp('/candidate/dashboard', {
      as: 'candidate',
      routes: {
        'GET /candidate/dashboard': () => [200, { applications: {}, needs_count: 1, matching_jobs: 1, feedback_due: [] }],
        'GET /candidate/profile': () => [200, profile],
        'GET /job-postings': () => [200, paged(jobs, { match_mode: true })],
      },
    });

    const recommended = await screen.findByRole('region', { name: 'Your best matches' });
    expect(await within(recommended).findByRole('link', { name: 'Job 1' })).toHaveAttribute('href', '/candidate/jobs/1');
    expect(within(recommended).getAllByText('Good match, 74%')).toHaveLength(3);
    expect(within(recommended).queryByRole('link', { name: 'Job 4' })).not.toBeInTheDocument();
    expect(within(recommended).getByRole('link', { name: 'See all your matches' })).toHaveAttribute('href', '/candidate/jobs');
    expect(calls.find((call) => call.key === 'GET /job-postings').config.params.get('match')).toBe('1');
    // Your needs lists the saved needs from the profile; nothing is due for rating yet.
    const needs = screen.getByRole('region', { name: 'Your needs' });
    expect(await within(needs).findByText('Accessible restroom')).toBeInTheDocument();
    expect(within(needs).getByRole('link', { name: 'Change your needs' })).toHaveAttribute('href', '/candidate/profile');
    expect(screen.getByRole('region', { name: 'Ratings to give' })).toHaveTextContent('Nothing to rate yet.');
  });

  test('saved job can be removed', async () => {
    const { user, calls } = renderApp('/candidate/saved-jobs', {
      as: 'candidate',
      routes: {
        'GET /candidate/saved-jobs': () => [200, paged([application.job_posting])],
        'DELETE /candidate/saved-jobs/42': () => [204, ''],
        'POST /candidate/saved-jobs/42': () => [200, { ...application.job_posting, saved: true }],
      },
    });

    await user.click(await screen.findByRole('button', { name: /Remove “Data Encoder”/ }));

    expect(await screen.findByText('No saved jobs')).toBeInTheDocument();
    expect(calls.some((call) => call.key === 'DELETE /candidate/saved-jobs/42')).toBe(true);
    expect(screen.getByRole('status')).toHaveTextContent('Removed “Data Encoder” from saved jobs.');

    // Undo takes focus and puts the job back (focus returns to its Remove button).
    const undo = screen.getByRole('button', { name: 'Undo removing “Data Encoder”' });
    expect(undo).toHaveFocus();
    await user.click(undo);
    expect(await screen.findByRole('button', { name: /Remove “Data Encoder”/ })).toHaveFocus();
    expect(calls.some((call) => call.key === 'POST /candidate/saved-jobs/42')).toBe(true);
    expect(screen.getByRole('status')).toHaveTextContent('“Data Encoder” is back in your saved jobs.');
  });
});
