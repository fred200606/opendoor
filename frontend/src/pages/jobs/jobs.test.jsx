import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { accommodationGroups, categories, job, snapshot } from '../../test/fixtures.js';
import { apiError, paged, renderApp, validationError } from '../../test/render.jsx';

const masterData = {
  'GET /categories': () => [200, { data: categories }],
  'GET /accommodations': () => [200, { data: accommodationGroups }],
};

describe('JobSearchPage', () => {
  test('guest search announces the count and links to public details', async () => {
    const { calls } = renderApp('/jobs', {
      routes: { ...masterData, 'GET /job-postings': () => [200, paged([job], { total: 1, match_mode: false })] },
    });

    expect(await screen.findByText('1 job found')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('link', { name: 'Data Encoder' })).toHaveAttribute('href', '/jobs/42');
    expect(screen.queryByLabelText('Matches my needs')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Save/ })).not.toBeInTheDocument();
    const search = calls.find((call) => call.key === 'GET /job-postings');
    expect(search.config.params.get('match')).toBeNull();
  });

  test('candidate filters go into the URL and the API query', async () => {
    const { user, calls, location } = renderApp('/candidate/jobs', {
      as: 'candidate',
      routes: { ...masterData, 'GET /job-postings': () => [200, paged([job], { match_mode: true })] },
    });

    expect(await screen.findByLabelText('Matches my needs')).toBeChecked();
    await screen.findByText('Meets 1 of your 2 needs');

    await user.selectOptions(screen.getByLabelText('Category'), 'Information Technology');
    await user.click(screen.getByText(/Must offer these accommodations/));
    await user.click(screen.getByLabelText('Sign language interpreter'));
    await user.type(screen.getByLabelText('Keyword'), 'encoder');

    await waitFor(() => expect(location()).toBe('/candidate/jobs?category=3&acc=5&q=encoder'));
    // The request for the new URL is sent by an effect after the render, so wait for it too.
    await waitFor(() => {
      const last = calls.filter((call) => call.key === 'GET /job-postings').at(-1).config.params;
      expect(Object.fromEntries(last)).toEqual({ q: 'encoder', category: '3', 'accommodations[]': '5', match: '1', sort: 'best' });
    });
    expect(screen.getByRole('link', { name: 'Data Encoder' })).toHaveAttribute('href', '/candidate/jobs/42');
    // Filters change only the query string: focus stays where the user is typing.
    expect(screen.getByLabelText('Keyword')).toHaveFocus();
  });

  test('candidates can save or unsave a job from its result card; guests see no Save', async () => {
    const { user, calls } = renderApp('/candidate/jobs', {
      as: 'candidate',
      routes: {
        ...masterData,
        'GET /job-postings': () => [200, paged([{ ...job, saved: true }], { match_mode: true })],
        'DELETE /candidate/saved-jobs/42': () => [204, ''],
        'POST /candidate/saved-jobs/42': () => [201, { ...job, saved: true }],
      },
    });

    const saved = await screen.findByRole('button', { name: 'Saved Data Encoder' });
    expect(saved).toHaveAttribute('aria-pressed', 'true');
    await user.click(saved);
    expect(await screen.findByRole('button', { name: 'Save Data Encoder' })).toHaveAttribute('aria-pressed', 'false');
    expect(calls.some((call) => call.key === 'DELETE /candidate/saved-jobs/42')).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Save Data Encoder' }));
    expect(await screen.findByRole('button', { name: 'Saved Data Encoder' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('candidate without needs is told to add them', async () => {
    renderApp('/candidate/jobs', {
      as: 'candidate',
      routes: { ...masterData, 'GET /job-postings': () => [200, paged([], { total: 0, match_mode: false })] },
    });

    expect(await screen.findByRole('link', { name: 'your profile' })).toHaveAttribute('href', '/candidate/profile');
    expect(screen.getByText('No jobs match these filters')).toBeInTheDocument();
  });
});

describe('JobDetailsPage', () => {
  const routes = {
    'GET /job-postings/42': () => [200, job],
    'GET /insights/job-postings/42': () => [200, snapshot],
  };

  const openSnapshot = async (user) => {
    const button = await screen.findByRole('button', { name: 'Show Workplace Accessibility Snapshot' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await user.click(button);
    expect(screen.getByRole('button', { name: 'Hide Workplace Accessibility Snapshot' })).toHaveAttribute('aria-expanded', 'true');
  };

  test('shows details, notes, missing needs, trust score and the snapshot', async () => {
    const { user, calls } = renderApp('/candidate/jobs/42', { as: 'candidate', routes });

    expect(await screen.findByRole('heading', { level: 1, name: 'Data Encoder' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to job results' })).toHaveAttribute('href', '/candidate/jobs');
    expect(screen.getByText(/Ramp at main entrance/)).toBeInTheDocument();
    expect(screen.getByText('Meets 1 of your 2 needs')).toBeInTheDocument();
    expect(screen.getByText('Not mentioned in this posting: Accessible restroom')).toBeInTheDocument();
    expect(screen.getByText('86%')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'How trust scores work' })).toHaveAttribute('href', '/trust-scores');

    const requirements = screen.getByRole('heading', { level: 2, name: 'Skills and qualifications' }).closest('section');
    expect(within(requirements).getByRole('list', { name: 'Skills this job needs' })).toHaveTextContent('Data entryMicrosoft Excel');
    expect(within(requirements).getByText('Senior high school')).toBeInTheDocument();
    expect(within(requirements).getByText('1 year')).toBeInTheDocument();

    // The snapshot is closed at first and is only requested when opened.
    expect(calls.some((call) => call.key === 'GET /insights/job-postings/42')).toBe(false);
    await openSnapshot(user);
    const snapshotSection = screen.getByRole('region', { name: 'Workplace Accessibility Snapshot' });
    expect(await within(snapshotSection).findByText(/Quezon Ave. MRT Station – 220 m away, wheelchair accessible/)).toBeInTheDocument();
    expect(within(snapshotSection).getByText(/Unnamed place – 1.5 km away, partly wheelchair accessible/)).toBeInTheDocument();
  });

  test('snapshot explains failed sources in words', async () => {
    const { user } = renderApp('/jobs/42', {
      routes: {
        ...routes,
        'GET /insights/job-postings/42': () => [
          200,
          { ...snapshot, location: { ...snapshot.location, precision: 'city' }, nearby_accessible: null, sources: { ...snapshot.sources, nominatim: 'unavailable', overpass: 'unavailable' } },
        ],
      },
    });

    await openSnapshot(user);
    expect(await screen.findByText(/distances are measured from the city centre/)).toBeInTheDocument();
    expect(screen.getByText(/Nearby places could not be loaded right now/)).toBeInTheDocument();
  });

  test('the job still shows when the Insights Service is down', async () => {
    const { user } = renderApp('/jobs/42', {
      routes: { ...routes, 'GET /insights/job-postings/42': () => apiError(503, 'SERVICE_UNAVAILABLE') },
    });

    await openSnapshot(user);
    expect(await screen.findByText(/accessibility snapshot is not available right now/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Data Encoder' })).toBeInTheDocument();
  });

  test('guests are invited to log in to apply', async () => {
    renderApp('/jobs/42', { routes });

    expect(await screen.findByRole('link', { name: 'Log in to apply' })).toHaveAttribute('href', '/login');
  });

  test('candidate applies with an interview accommodation request', async () => {
    const { user, calls } = renderApp('/candidate/jobs/42', {
      as: 'candidate',
      routes: { ...routes, 'POST /job-postings/42/applications': () => [201, { id: 11, job_posting_id: 42, status: 'pending' }] },
    });

    await user.type(await screen.findByLabelText(/Interview accommodation request/), 'Captions, please.');
    await user.click(screen.getByRole('button', { name: 'Send application' }));

    expect(await screen.findByText('Application sent')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your application' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View your application' })).toHaveAttribute('href', '/candidate/applications/11');
    expect(calls.find((call) => call.key === 'POST /job-postings/42/applications').data).toEqual({ interview_request: 'Captions, please.' });
  });

  test('a second application gets the ALREADY_APPLIED explanation', async () => {
    const { user } = renderApp('/candidate/jobs/42', {
      as: 'candidate',
      routes: { ...routes, 'POST /job-postings/42/applications': () => apiError(409, 'ALREADY_APPLIED') },
    });

    await user.click(await screen.findByRole('button', { name: 'Send application' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('You have already applied to this job');
  });

  test('an earlier application replaces the form with its status', async () => {
    renderApp('/candidate/jobs/42', {
      as: 'candidate',
      routes: { ...routes, 'GET /job-postings/42': () => [200, { ...job, my_application: { id: 11, status: 'reviewed', created_at: '2026-10-05T09:00:00+08:00' } }] },
    });

    expect(await screen.findByRole('heading', { name: 'Your application' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View your application' })).toHaveAttribute('href', '/candidate/applications/11');
    expect(screen.queryByRole('button', { name: 'Send application' })).not.toBeInTheDocument();
  });

  test('report: a missing reason is announced and focused, then the report is sent', async () => {
    let attempt = 0;
    const { user, calls } = renderApp('/candidate/jobs/42', {
      as: 'candidate',
      routes: {
        ...routes,
        'POST /job-postings/42/reports': () =>
          ++attempt === 1 ? validationError({ reason: ['Tell us what is wrong with this posting.'] }) : [201, { id: 1, job_posting_id: 42, status: 'open' }],
      },
    });

    await user.click(await screen.findByRole('button', { name: 'Report this job' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Send report' }));

    const summary = await screen.findByRole('alert');
    expect(summary).toHaveTextContent('Tell us what is wrong with this posting.');
    expect(summary).toHaveFocus();

    await user.type(screen.getByLabelText(/What is wrong with this posting/), 'The ramp does not exist.');
    await user.click(screen.getByRole('button', { name: 'Send report' }));

    expect(await screen.findByRole('button', { name: 'Reported – thank you' })).toBeInTheDocument();
    expect(calls.filter((call) => call.key === 'POST /job-postings/42/reports').at(-1).data).toEqual({ reason: 'The ramp does not exist.' });
  });

  test('a saved posting shows as saved and can be unsaved', async () => {
    const { user, calls } = renderApp('/candidate/jobs/42', {
      as: 'candidate',
      routes: {
        ...routes,
        'GET /job-postings/42': () => [200, { ...job, saved: true }],
        'DELETE /candidate/saved-jobs/42': () => [204, ''],
      },
    });

    const button = await screen.findByRole('button', { name: 'Saved' });
    expect(button).toHaveAttribute('aria-pressed', 'true');

    await user.click(button);

    expect(await screen.findByRole('button', { name: 'Save job' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Removed from saved jobs.')).toHaveAttribute('role', 'status');
    expect(calls.some((call) => call.key === 'DELETE /candidate/saved-jobs/42')).toBe(true);
  });
});

describe('EmployerPublicPage', () => {
  test('shows company, breakdown and open jobs', async () => {
    renderApp('/employers/7', {
      routes: {
        'GET /employers/7': () => [
          200,
          {
            id: 7,
            company_name: 'Bayanihan Tech Solutions',
            verified: true,
            industry: 'Information Technology',
            address: 'Quezon City',
            description: 'We build software.',
            logo_url: null,
            trust_score: { published: true, score: 86, based_on: 5 },
            open_postings: [job],
          },
        ],
        'GET /employers/7/trust-score': () => [
          200,
          { published: true, score: 86, based_on: 5, breakdown: [{ accommodation_id: 5, name: 'Sign language interpreter', delivered: 1, partial: 1, not_delivered: 1, of: 3 }] },
        ],
      },
    });

    expect(await screen.findByRole('heading', { level: 1, name: 'Bayanihan Tech Solutions' })).toBeInTheDocument();
    expect(screen.getAllByText('Verified employer')[0]).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Sign language interpreter/ })).toHaveTextContent('1 of 3 delivered');
    expect(screen.getByRole('link', { name: 'Data Encoder' })).toHaveAttribute('href', '/jobs/42');
  });
});
