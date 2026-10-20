import { Link, useLocation } from 'react-router-dom';
import { getDashboard } from '../../api/account.js';
import { searchJobs } from '../../api/jobs.js';
import { getCandidateProfile } from '../../api/profile.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import Alert from '../../components/Alert.jsx';
import AsyncContent from '../../components/AsyncContent.jsx';
import GetStarted from '../../components/GetStarted.jsx';
import MatchBadge from '../../components/MatchBadge.jsx';
import Page from '../../components/Page.jsx';
import StatCards from '../../components/StatCards.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useOnboarding } from '../../hooks/useOnboarding.js';
import { formatDate, plural } from '../../lib/format.js';
import { APPLICATION_STATUSES } from '../../lib/labels.js';
import { APPLICATION_TILES } from '../../lib/statusTiles.js';

/** GET /candidate/dashboard – shape documented in docs/openapi.yaml (CandidateDashboard). */
export default function CandidateDashboardPage() {
  const { user } = useAuth();
  const location = useLocation();
  const state = useAsync(() => getDashboard('candidate'), []);

  return (
    <Page title={`Welcome, ${user.name}`} subtitle={<p className="page__subtitle">Where your applications stand and what to do next.</p>}>
      {location.state?.message && (
        <Alert type="success" live="polite">
          <p>{location.state.message}</p>
        </Alert>
      )}
      <AsyncContent state={state} label="Loading your summary">
        {(dashboard) => (
          <>
            <CandidateGetStarted dashboard={dashboard} />
            <div className="dashboard-layout">
              <StatCards
                title="Your applications"
                items={Object.entries(APPLICATION_STATUSES).map(([status, label]) => ({
                  label,
                  value: dashboard.applications?.[status] ?? 0,
                  to: `/candidate/applications?status=${status}`,
                  ...APPLICATION_TILES[status],
                }))}
              />

              {/* A rating that can be given now comes first (Figma 15:5668). */}
              <div className="dashboard-side">
                {dashboard.feedback_due?.some((item) => item.is_open) ? (
                  <>
                    <RatingsToGive due={dashboard.feedback_due} />
                    <JobsForYou />
                    <YourNeeds count={dashboard.needs_count ?? 0} />
                  </>
                ) : (
                  <>
                    <JobsForYou />
                    <YourNeeds count={dashboard.needs_count ?? 0} />
                    <RatingsToGive due={dashboard.feedback_due ?? []} />
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </AsyncContent>
    </Page>
  );
}

/** Onboarding list. The profile step needs the profile (none yet = 404), loaded only while the list can show. */
function CandidateGetStarted({ dashboard }) {
  const { onboarding } = useOnboarding();
  const wanted = onboarding?.checklist_hidden === false;
  const profile = useAsync(
    () => (wanted ? getCandidateProfile().catch((error) => (error.status === 404 ? null : Promise.reject(error))) : Promise.resolve(null)),
    [wanted],
  );
  if (wanted && profile.loading) return null;

  const skills = (profile.data?.skills ?? []).length > 0;
  const applied = Object.values(dashboard.applications ?? {}).some((count) => count > 0);
  return (
    <GetStarted
      steps={[
        { id: 'account', title: 'Create your account', done: true },
        {
          id: 'needs',
          title: 'Add the accommodations you need',
          done: (dashboard.needs_count ?? 0) > 0,
          hint: 'We use them to show the jobs that offer them first.',
          link: { to: '/candidate/profile', label: 'Add your needs' },
        },
        {
          id: 'profile',
          title: 'Add your skills and résumé',
          done: skills && Boolean(profile.data?.resume_url),
          hint: 'Employers see them when you apply.',
          link: { to: `/candidate/profile?tab=${skills ? 'resume' : 'about'}`, label: 'Complete your profile' },
        },
        {
          id: 'apply',
          title: 'Apply to a job that fits',
          done: applied,
          hint: '“Recommended for me” in Find jobs shows the best fits first.',
          link: { to: '/candidate/jobs', label: 'Find jobs' },
        },
      ]}
    />
  );
}

const RECOMMENDED = 3;

/** The best fits right away (decision 2026-10-21): the first "Recommended for me" results. */
function JobsForYou() {
  const state = useAsync(() => searchJobs({ match: 1 }), []);
  const jobs = (state.data?.data ?? []).slice(0, RECOMMENDED);

  return (
    <section aria-labelledby="matches-title">
      <h2 id="matches-title">Recommended for you</h2>
      <div className="card card--tint">
        <AsyncContent state={state} label="Finding jobs for you">
          {() =>
            jobs.length === 0 ? (
              <p>No open jobs yet. We will show the best fits here.</p>
            ) : (
              <ul className="recommended-list">
                {jobs.map((job) => (
                  <li key={job.id}>
                    <Link to={`/candidate/jobs/${job.id}`} state={{ back: { to: '/candidate/dashboard', label: 'Back to your dashboard' } }}>
                      {job.title}
                    </Link>
                    <span className="muted"> – {job.employer?.company_name}</span>
                    <MatchBadge match={job.match} />
                  </li>
                ))}
              </ul>
            )
          }
        </AsyncContent>
        <p className="dashboard-side__link">
          <Link to="/candidate/jobs">See all recommended jobs</Link>
        </p>
      </div>
    </section>
  );
}

/** One card per hire that can be rated (now, or from its date). */
function RatingsToGive({ due }) {
  return (
    <section aria-labelledby="feedback-due-title">
      <h2 id="feedback-due-title">Ratings to give</h2>
      <div className="dashboard-side__cards">
        {due.length === 0 ? (
          <div className="card">
            <p className="muted">Nothing to rate yet. You can rate 30 days after being hired.</p>
          </div>
        ) : (
          due.map((item) => (
            <div key={item.application_id} className={item.is_open ? 'card card--tint' : 'card'}>
              <h3 className="dashboard-side__title">
                {item.job_title} at {item.company_name}
              </h3>
              {item.is_open ? (
                <>
                  <p className="muted">Tell other job seekers whether the promised accommodations were provided. Your answers are anonymous.</p>
                  <Link className="button" to={`/candidate/applications/${item.application_id}/feedback`}>
                    Rate the accommodations now <span className="visually-hidden">for {item.job_title}</span>
                  </Link>
                </>
              ) : (
                <p className="muted">You can rate the accommodations from {formatDate(item.opens_on)}.</p>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

/** The saved needs as tags (from the profile), or a prompt to add them. */
function YourNeeds({ count }) {
  const state = useAsync(() => (count > 0 ? getCandidateProfile() : Promise.resolve(null)), [count]);
  const needs = state.data?.accommodations ?? [];

  return (
    <section aria-labelledby="needs-title">
      <h2 id="needs-title">Your needs</h2>
      <div className="card">
        {count === 0 ? (
          <>
            <p>
              <strong>Add your accommodation needs</strong> so we can show which jobs offer them.
            </p>
            <Link className="button" to="/candidate/profile">
              Add my needs
            </Link>
          </>
        ) : (
          <>
            {needs.length > 0 ? (
              <ul className="tag-list">
                {needs.map((need) => (
                  <li key={need.id} className="tag">
                    {need.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p>{plural(count, 'need')} saved.</p>
            )}
            <p className="dashboard-side__link">
              <Link to="/candidate/profile">Change your needs</Link>
            </p>
          </>
        )}
      </div>
    </section>
  );
}
