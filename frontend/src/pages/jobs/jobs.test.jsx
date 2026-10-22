import { fireEvent, screen, waitFor, within } from '@testing-library/react';
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
    expect(screen.queryByRole('button', { name: 'Recommended for me' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Distance' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Work setup' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: /^Save/ })).not.toBeInTheDocument();
    const search = calls.find((call) => call.key === 'GET /job-postings');
    expect(search.config.params.get('match')).toBeNull();
  });

  test('candidate filters go into the URL and the API query', async () => {
    const { user, calls, location } = renderApp('/candidate/jobs', {
      as: 'candidate',
      routes: { ...masterData, 'GET /job-postings': () => [200, paged([job], { match_mode: true })] },
    });

    expect(await screen.findByRole('button', { name: 'Recommended for me' })).toHaveAttribute('aria-pressed', 'true');
    await screen.findByText('Match: 74%');

    // Each chip opens its panel; Escape closes it and puts focus back on the chip.
    const categoryChip = screen.getByRole('button', { name: 'Category' });
    await user.click(categoryChip);
    expect(categoryChip).toHaveAttribute('aria-expanded', 'true');
    await user.click(within(screen.getByRole('group', { name: 'Category' })).getByLabelText('Information Technology'));
    await user.keyboard('{Escape}');
    expect(categoryChip).toHaveAttribute('aria-expanded', 'false');
    expect(categoryChip).toHaveFocus();
    expect(categoryChip).toHaveAccessibleName('Category: Information Technology');

    await user.click(screen.getByRole('button', { name: 'Accommodations' }));
    const dialog = screen.getByRole('dialog', { name: 'Accommodations provided' });
    await user.click(within(dialog).getByLabelText('Sign language interpreter'));
    await user.click(within(dialog).getByRole('button', { name: 'Show jobs' }));
    expect(screen.getByRole('button', { name: 'Accommodations: 1 accommodation' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Work setup' }));
    await user.click(within(screen.getByRole('group', { name: 'Work setup' })).getByLabelText('Remote'));
    await user.click(screen.getByRole('button', { name: 'Distance' }));
    await user.click(within(screen.getByRole('group', { name: 'Distance' })).getByLabelText('Within 25 km'));
    await user.type(screen.getByRole('searchbox', { name: 'Search jobs' }), 'encoder');

    await waitFor(() => expect(location()).toBe('/candidate/jobs?category=3&acc=5&setup=remote&dist=25&q=encoder'));
    // The request for the new URL is sent by an effect after the render, so wait for it too.
    await waitFor(() => {
      const last = calls.filter((call) => call.key === 'GET /job-postings').at(-1).config.params;
      expect([...last.entries()]).toEqual([
        ['q', 'encoder'],
        ['category', '3'],
        ['accommodations[]', '5'],
        ['work_setup[]', 'remote'],
        ['distance', '25'],
        ['match', '1'],
        ['sort', 'best'],
      ]);
    });
    expect(screen.getByRole('link', { name: 'Data Encoder' })).toHaveAttribute('href', '/candidate/jobs/42');
    // Filters change only the query string: focus stays where the user is typing.
    expect(screen.getByRole('searchbox', { name: 'Search jobs' })).toHaveFocus();
  });

  test('a card puts the work first: salary, place, summary, skills, qualifications, match, then accommodations (Decision 2026-10-22e)', async () => {
    const card = { ...job, skills: ['Microsoft Excel', 'Typing', 'Data entry', 'Filing', 'Email'] };
    const { user } = renderApp('/candidate/jobs', {
      as: 'candidate',
      routes: { ...masterData, 'GET /job-postings': () => [200, paged([card, { ...job, id: 43, title: 'Packer', salary: null, accommodations: [], match: null }], { match_mode: true })] },
    });

    const [first, second] = await screen.findAllByRole('article');
    expect(within(first).getByRole('heading', { level: 3, name: 'Data Encoder' })).toBeInTheDocument();
    expect(first).toHaveTextContent('Salary: ₱18,000 to ₱22,000 a month');
    expect(first).toHaveTextContent('Quezon City · , On-site · , Full-time');
    expect(first).toHaveTextContent('Encode records. Work with the admin team.');
    // Up to 3 skills, the candidate's matched one first, then a link to all of them.
    expect(within(first).getAllByRole('listitem').slice(0, 3).map((item) => item.textContent)).toEqual(['Data entry (you have it)', 'Microsoft Excel', 'Typing']);
    expect(within(first).getByRole('link', { name: '+2 more: view all skills for Data Encoder' })).toHaveAttribute('href', '/candidate/jobs/42#skills');
    expect(first).toHaveTextContent('Qualifications:Senior high school or higher, at least 1 year of experience');

    const why = within(first).getByRole('button', { name: 'Why this match?' });
    expect(why).toHaveAttribute('aria-expanded', 'false');
    await user.click(why);
    expect(why).toHaveAttribute('aria-expanded', 'true');
    expect(first).toHaveTextContent('Partly fits: You have 1 of the 2 required skills');
    expect(first).toHaveTextContent('Does not fit: Less experience than the job asks for');
    expect(within(first).getByRole('link', { name: 'See the full match for Data Encoder' })).toHaveAttribute('href', '/candidate/jobs/42#match');

    // Accommodations: one smaller row with a link, no tags and no "Show more".
    expect(first).toHaveTextContent('2 workplace accommodations, offers 1 of your 2 needs');
    expect(within(first).getByRole('link', { name: 'View accommodations for Data Encoder' })).toHaveAttribute('href', '/candidate/jobs/42#accommodations');
    expect(within(first).queryByText('Wheelchair-accessible entrance')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Show more/ })).not.toBeInTheDocument();
    expect(first).toHaveTextContent('Apply by November 30, 2026');
    expect(within(first).getByRole('link', { name: 'View job: Data Encoder' })).toHaveAttribute('href', '/candidate/jobs/42');
    expect(within(first).getByRole('button', { name: 'Save Data Encoder' })).toBeInTheDocument();

    expect(second).toHaveTextContent('Salary not disclosed');
    expect(second).toHaveTextContent('No workplace accommodations listed');
    expect(within(second).queryByRole('button', { name: 'Why this match?' })).not.toBeInTheDocument();
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

  test('a distance that cannot be used is explained', async () => {
    renderApp('/candidate/jobs?dist=10', {
      as: 'candidate',
      routes: { ...masterData, 'GET /job-postings': () => [200, paged([], { total: 0, match_mode: true, distance: null })] },
    });

    expect(await screen.findByText(/We could not find your city on the map yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'your profile' })).toHaveAttribute('href', '/candidate/profile?tab=about');
    expect(screen.getByText('No jobs match these filters')).toBeInTheDocument();
  });
});

describe('JobDetailsPage', () => {
  const routes = {
    'GET /job-postings/42': () => [200, job],
    'GET /insights/job-postings/42': () => [200, snapshot],
    // Applying needs a résumé on the profile (Decision 2026-10-22b).
    'GET /candidate/profile': () => [200, { resume_url: 'http://localhost:8080/api/resumes/3?expires=1&signature=abc' }],
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
    const fit = screen.getByRole('region', { name: 'How this job fits you' });
    expect(within(fit).getByText('Good match, 74%')).toBeInTheDocument();
    expect(within(fit).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Partly fits: You have 1 of the 2 skills it needsYou have: Data entry. Not in your profile: Microsoft Excel.',
      'Fits: In your city, about 2.4 km away',
      'Fits: Education: Senior high school or higherYour education meets this.',
      'Does not fit: Experience: at least 1 yearYour profile shows less experience, or none.',
      'Fits: On-site workOne of the work setups you prefer.',
      'Fits: Full-timeA type of work you want.',
      'Partly fits: Meets 1 of your 2 needs',
    ]);
    expect(within(fit).getByText('Not mentioned in this posting: Accessible restroom')).toBeInTheDocument();
    expect(screen.getByText('86%')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'How trust scores work' })).toHaveAttribute('href', '/trust-scores');

    const skills = screen.getByRole('region', { name: 'Required skills' });
    expect(within(skills).getByRole('list', { name: 'Skills this job needs' })).toHaveTextContent('Data entry (in your profile)Microsoft Excel');
    const qualifications = screen.getByRole('region', { name: 'Qualifications' });
    expect(within(qualifications).getByText('Senior high school')).toBeInTheDocument();
    expect(within(qualifications).getByText('1 year')).toBeInTheDocument();

    // The snapshot is closed at first and is only requested when opened.
    expect(calls.some((call) => call.key === 'GET /insights/job-postings/42')).toBe(false);
    await openSnapshot(user);
    const snapshotSection = screen.getByRole('region', { name: 'Workplace Accessibility Snapshot' });
    expect(await within(snapshotSection).findByText(/Quezon Ave. MRT Station – 220 m away, wheelchair accessible/)).toBeInTheDocument();
    expect(within(snapshotSection).getByText(/Unnamed place – 1.5 km away, partly wheelchair accessible/)).toBeInTheDocument();
  });

  test('the page is in sections with a contents list; salary, benefits, schedule and requirements (Decision 2026-10-22e)', async () => {
    renderApp('/candidate/jobs/42', { as: 'candidate', routes });

    await screen.findByRole('heading', { level: 1, name: 'Data Encoder' });
    const sections = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
    expect(sections).toEqual([
      'On this page',
      'Job overview',
      'How this job fits you',
      'Responsibilities',
      'Required skills',
      'Qualifications',
      'Salary and benefits',
      'Location, schedule and work setup',
      'Workplace accommodations',
      'Workplace Accessibility Snapshot',
      'About the employer',
      'Application requirements',
      'Apply for this job',
    ]);
    const contents = screen.getByRole('navigation', { name: 'On this page' });
    expect(within(contents).getByRole('link', { name: 'Workplace accommodations' })).toHaveAttribute('href', '#accommodations');

    expect(screen.getByRole('region', { name: 'Job overview' })).toHaveTextContent('Salary₱18,000 to ₱22,000 a month');
    expect(within(screen.getByRole('region', { name: 'Responsibilities' })).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Encode customer records',
      'Check records for errors',
    ]);
    const salary = screen.getByRole('region', { name: 'Salary and benefits' });
    expect(within(salary).getByRole('list', { name: 'Benefits' })).toHaveTextContent('HMO from the first month13th-month pay');
    const place = screen.getByRole('region', { name: 'Location, schedule and work setup' });
    expect(place).toHaveTextContent('Workplace address123 Quezon Ave., Quezon City, NCR');
    expect(place).toHaveTextContent('ScheduleMonday to Friday, 9:00 AM to 5:00 PM');
    const requirements = screen.getByRole('region', { name: 'Application requirements' });
    expect(requirements).toHaveTextContent('Your résumé (PDF)');
    expect(requirements).toHaveTextContent('A short writing sample.');
    expect(requirements).toHaveTextContent('Online interview.');
    expect(within(screen.getByRole('region', { name: 'About the employer' })).getByRole('link', { name: 'Bayanihan Tech Solutions' })).toHaveAttribute('href', '/employers/7');
  });

  test('a card link opens the job at its accommodations; an undisclosed salary says so', async () => {
    renderApp('/candidate/jobs/42#accommodations', {
      as: 'candidate',
      routes: { ...routes, 'GET /job-postings/42': () => [200, { ...job, salary: null, benefits: null, responsibilities: null }] },
    });

    const accommodations = await screen.findByRole('region', { name: 'Workplace accommodations' });
    await waitFor(() => expect(accommodations).toHaveFocus());
    expect(screen.getByRole('region', { name: 'Salary and benefits' })).toHaveTextContent('Salary not disclosed');
    expect(screen.getByText('The employer did not list any benefits.')).toBeInTheDocument();
    expect(screen.getByText(/did not list the responsibilities separately/)).toBeInTheDocument();
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

  test('without a résumé the form asks for a PDF, uploads it to the profile, then applies', async () => {
    const { user, calls } = renderApp('/candidate/jobs/42', {
      as: 'candidate',
      routes: {
        ...routes,
        'GET /candidate/profile': () => [200, { resume_url: null }],
        'POST /candidate/resume': () => [200, { resume_url: 'http://localhost:8080/api/resumes/3?expires=1&signature=abc' }],
        'POST /job-postings/42/applications': () => [201, { id: 11, job_posting_id: 42, status: 'pending' }],
      },
    });

    const field = await screen.findByLabelText(/Your résumé/);
    await user.click(screen.getByRole('button', { name: 'Send application' }));
    expect(await screen.findByText('Choose your résumé (PDF) to apply.')).toBeInTheDocument();
    expect(field).toHaveFocus();

    fireEvent.change(field, { target: { files: [new File(['notes'], 'notes.txt', { type: 'text/plain' })] } });
    expect(await screen.findByText('Choose a PDF file.')).toBeInTheDocument();

    fireEvent.change(field, { target: { files: [new File(['%PDF-1.4'], 'cv.pdf', { type: 'application/pdf' })] } });
    await user.click(screen.getByRole('button', { name: 'Send application' }));

    expect(await screen.findByText('Application sent')).toBeInTheDocument();
    const keys = calls.map((call) => call.key);
    expect(keys.indexOf('POST /candidate/resume')).toBeGreaterThan(-1);
    expect(keys.indexOf('POST /candidate/resume')).toBeLessThan(keys.indexOf('POST /job-postings/42/applications'));
  });

  test('RESUME_REQUIRED from the server is explained', async () => {
    const { user } = renderApp('/candidate/jobs/42', {
      as: 'candidate',
      routes: { ...routes, 'POST /job-postings/42/applications': () => apiError(422, 'RESUME_REQUIRED') },
    });

    await user.click(await screen.findByRole('button', { name: 'Send application' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Add your résumé (PDF) to apply. We save it to your profile.');
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
