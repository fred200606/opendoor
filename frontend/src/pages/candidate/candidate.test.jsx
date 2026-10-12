import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { accommodationGroups, application } from '../../test/fixtures.js';
import { apiError, paged, renderApp, validationError } from '../../test/render.jsx';

const profile = {
  id: 3,
  headline: 'Data encoder',
  skills: ['Excel', 'Typing'],
  experience: '3 years',
  location_psgc: '1381300000',
  location: { psgc_code: '1381300000', label: 'Quezon City, NCR' },
  disability_type: null,
  show_disability: false,
  resume_url: null,
  accommodations: [{ id: 2, name: 'Accessible restroom', group: 'physical_access' }],
};

describe('CandidateProfilePage', () => {
  const routes = {
    'GET /candidate/profile': () => [200, profile],
    'GET /accommodations': () => [200, { data: accommodationGroups }],
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

  test('saves the profile with skills as a list; disability stays private by default', async () => {
    const { user, calls } = renderApp('/candidate/profile', {
      as: 'candidate',
      routes: { ...routes, 'PUT /candidate/profile': () => [200, profile] },
    });

    const skills = await screen.findByLabelText('Skills');
    await user.clear(skills);
    await user.type(skills, 'Excel, Filing , ');
    expect(screen.queryByLabelText(/Show my disability type/)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Disability type'), 'Deaf');
    expect(screen.getByLabelText(/Show my disability type/)).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(await screen.findByText('Your profile is saved.')).toBeInTheDocument();
    expect(calls.find((call) => call.key === 'PUT /candidate/profile').data).toEqual({
      headline: 'Data encoder',
      skills: ['Excel', 'Filing'],
      experience: '3 years',
      location_psgc: '1381300000',
      location_label: 'Quezon City, NCR',
      disability_type: 'Deaf',
      show_disability: false,
    });
  });

  test('a new candidate without a profile gets an empty form and the welcome message', async () => {
    renderApp('/candidate/profile', {
      as: 'candidate',
      routes: { ...routes, 'GET /candidate/profile': () => apiError(404, 'NOT_FOUND') },
    });

    expect(await screen.findByText('None selected.')).toBeInTheDocument();
    expect(screen.getByText('You have not uploaded a résumé yet.')).toBeInTheDocument();
  });

  test('résumé upload refuses non-PDF files before sending', async () => {
    const { user, calls } = renderApp('/candidate/profile', { as: 'candidate', routes });

    const input = await screen.findByLabelText('Upload résumé');
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
    expect(screen.queryByRole('button', { name: 'I was hired' })).not.toBeInTheDocument();
    const dialog = screen.getByRole('dialog', { name: 'Withdraw this application?' });
    await user.click(within(dialog).getByRole('button', { name: 'Withdraw application' }));

    expect(await screen.findByText('Your application was withdrawn.')).toBeInTheDocument();
    expect(calls.find((call) => call.key === 'PATCH /applications/11/status').data).toEqual({ status: 'withdrawn' });
    expect(screen.queryByRole('button', { name: 'Withdraw application' })).not.toBeInTheDocument();
  });

  test('a reviewed application offers "I was hired"', async () => {
    renderApp('/candidate/applications/11', {
      as: 'candidate',
      routes: { 'GET /applications/11': () => [200, { ...application, status: 'reviewed' }] },
    });

    expect(await screen.findByRole('button', { name: 'I was hired' })).toBeInTheDocument();
  });

  test('hired: feedback link once the 30-day window is open, a date before that', async () => {
    const hired = { ...application, status: 'hired', hired_at: '2026-01-02T09:00:00+08:00' };
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

  test('hired and already rated: no feedback link', async () => {
    renderApp('/candidate/applications/11', {
      as: 'candidate',
      routes: {
        'GET /applications/11': () => [200, { ...application, status: 'hired', feedback_opens_on: '2026-02-01', feedback_submitted: true }],
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

    for (const group of await screen.findAllByRole('group')) {
      await user.click(within(group).getByLabelText('Not delivered'));
    }
    await user.click(screen.getByRole('button', { name: 'Submit ratings' }));

    await user.click(await screen.findByRole('link', { name: 'The rating is invalid.' }));
    expect(document.getElementById('rating-5')).toHaveFocus();
  });
});

describe('CandidateDashboardPage and SavedJobsPage', () => {
  test('dashboard shows counts, the needs prompt and due ratings', async () => {
    renderApp('/candidate/dashboard', {
      as: 'candidate',
      routes: {
        'GET /candidate/dashboard': () => [
          200,
          {
            applications: { pending: 2, reviewed: 1, hired: 1, rejected: 0, withdrawn: 0 },
            needs_count: 0,
            matching_jobs: 4,
            feedback_due: [{ application_id: 11, job_title: 'Data Encoder', company_name: 'Bayanihan Tech', opens_on: '2026-02-01', is_open: true }],
          },
        ],
      },
    });

    expect(await screen.findByRole('link', { name: 'Add my needs' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View Submitted (2)' })).toHaveAttribute('href', '/candidate/applications?status=pending');
    expect(screen.getByRole('link', { name: 'rate the accommodations now' })).toHaveAttribute('href', '/candidate/applications/11/feedback');
    expect(screen.getByRole('region', { name: 'Jobs for you' })).toHaveTextContent('4 open jobs offer all the accommodations you need.');
  });

  test('one matching job is worded in the singular', async () => {
    renderApp('/candidate/dashboard', {
      as: 'candidate',
      routes: {
        'GET /candidate/dashboard': () => [200, { applications: {}, needs_count: 3, matching_jobs: 1, feedback_due: [] }],
      },
    });

    expect(await screen.findByRole('region', { name: 'Jobs for you' })).toHaveTextContent('1 open job offers all the accommodations you need.');
  });

  test('saved job can be removed', async () => {
    const { user, calls } = renderApp('/candidate/saved-jobs', {
      as: 'candidate',
      routes: {
        'GET /candidate/saved-jobs': () => [200, paged([application.job_posting])],
        'DELETE /candidate/saved-jobs/42': () => [204, ''],
      },
    });

    await user.click(await screen.findByRole('button', { name: /Remove “Data Encoder”/ }));

    expect(await screen.findByText('No saved jobs')).toBeInTheDocument();
    expect(calls.some((call) => call.key === 'DELETE /candidate/saved-jobs/42')).toBe(true);
  });
});
