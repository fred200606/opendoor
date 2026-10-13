import { Link } from 'react-router-dom';
import { getDashboard } from '../../api/account.js';
import { getCandidateProfile } from '../../api/profile.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import AsyncContent from '../../components/AsyncContent.jsx';
import Page from '../../components/Page.jsx';
import StatCards from '../../components/StatCards.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { formatDate, plural } from '../../lib/format.js';
import { APPLICATION_STATUSES } from '../../lib/labels.js';
import { APPLICATION_TILES } from '../../lib/statusTiles.js';

/** GET /candidate/dashboard – shape documented in docs/openapi.yaml (CandidateDashboard). */
export default function CandidateDashboardPage() {
  const { user } = useAuth();
  const state = useAsync(() => getDashboard('candidate'), []);

  return (
    <Page title={`Welcome, ${user.name}`} subtitle={<p className="page__subtitle">Where your applications stand and what to do next.</p>}>
      <AsyncContent state={state} label="Loading your summary">
        {(dashboard) => (
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
                  <JobsForYou count={dashboard.matching_jobs ?? 0} />
                  <YourNeeds count={dashboard.needs_count ?? 0} />
                </>
              ) : (
                <>
                  <JobsForYou count={dashboard.matching_jobs ?? 0} />
                  <YourNeeds count={dashboard.needs_count ?? 0} />
                  <RatingsToGive due={dashboard.feedback_due ?? []} />
                </>
              )}
            </div>
          </div>
        )}
      </AsyncContent>
    </Page>
  );
}

function JobsForYou({ count }) {
  return (
    <section aria-labelledby="matches-title">
      <h2 id="matches-title">Jobs for you</h2>
      <div className={count > 0 ? 'card card--tint' : 'card'}>
        <p>{matchingJobsText(count)} all the accommodations you need.</p>
        {count > 0 ? (
          <Link className="button button--block" to="/candidate/jobs">
            See matching jobs
          </Link>
        ) : (
          <p className="dashboard-side__link">
            <Link to="/candidate/jobs">See matching jobs</Link>
          </p>
        )}
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

function matchingJobsText(count) {
  if (count === 0) return 'No open jobs offer';
  return count === 1 ? '1 open job offers' : `${count} open jobs offer`;
}
