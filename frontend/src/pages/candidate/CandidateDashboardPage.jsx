import { Check, FileText, Minus, Search, X } from 'lucide-react';
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

// Figma "4.1 Dashboard": an icon tile per status.
const STATUS_TILES = {
  pending: { icon: FileText, tone: 'pink' },
  reviewed: { icon: Search, tone: 'lilac' },
  hired: { icon: Check, tone: 'sky' },
  rejected: { icon: X, tone: 'orange' },
  withdrawn: { icon: Minus, tone: 'pink' },
};

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
                ...STATUS_TILES[status],
              }))}
            />

            <div className="dashboard-side">
              <section aria-labelledby="matches-title">
                <h2 id="matches-title">Jobs for you</h2>
                <div className="card card--tint">
                  <p>{matchingJobsText(dashboard.matching_jobs ?? 0)} all the accommodations you need.</p>
                  <Link className="button button--block" to="/candidate/jobs">
                    See matching jobs
                  </Link>
                </div>
              </section>

              <YourNeeds count={dashboard.needs_count ?? 0} />

              <section aria-labelledby="feedback-due-title">
                <h2 id="feedback-due-title">Ratings to give</h2>
                <div className="card">
                  {dashboard.feedback_due?.length > 0 ? (
                    <ul className="plain-list">
                      {dashboard.feedback_due.map((item) => (
                        <li key={item.application_id}>
                          {item.job_title} at {item.company_name} –{' '}
                          {item.is_open ? (
                            <Link to={`/candidate/applications/${item.application_id}/feedback`}>rate the accommodations now</Link>
                          ) : (
                            `you can rate from ${formatDate(item.opens_on)}`
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">Nothing to rate yet. You can rate 30 days after being hired.</p>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}
      </AsyncContent>
    </Page>
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
