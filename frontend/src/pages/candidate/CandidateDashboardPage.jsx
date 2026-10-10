import { Link } from 'react-router-dom';
import { getDashboard } from '../../api/account.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import AsyncContent from '../../components/AsyncContent.jsx';
import Page from '../../components/Page.jsx';
import StatCards from '../../components/StatCards.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { formatDate } from '../../lib/format.js';
import { APPLICATION_STATUSES } from '../../lib/labels.js';

/** GET /candidate/dashboard – shape documented in docs/openapi.yaml (CandidateDashboard). */
export default function CandidateDashboardPage() {
  const { user } = useAuth();
  const state = useAsync(() => getDashboard('candidate'), []);

  return (
    <Page title={`Welcome, ${user.name}`}>
      <AsyncContent state={state} label="Loading your summary">
        {(dashboard) => (
          <>
            {dashboard.needs_count === 0 && (
              <div className="callout">
                <p>
                  <strong>Add your accommodation needs</strong> so we can show which jobs offer them.
                </p>
                <Link className="button" to="/candidate/profile">
                  Add my needs
                </Link>
              </div>
            )}

            <StatCards
              title="Your applications"
              items={Object.entries(APPLICATION_STATUSES).map(([status, label]) => ({
                label,
                value: dashboard.applications?.[status] ?? 0,
                to: `/candidate/applications?status=${status}`,
              }))}
            />

            <section aria-labelledby="matches-title">
              <h2 id="matches-title">Jobs for you</h2>
              <p>
                {matchingJobsText(dashboard.matching_jobs ?? 0)} all the accommodations you need.{' '}
                <Link to="/candidate/jobs">See matching jobs</Link>
              </p>
            </section>

            {dashboard.feedback_due?.length > 0 && (
              <section aria-labelledby="feedback-due-title">
                <h2 id="feedback-due-title">Ratings to give</h2>
                <ul>
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
              </section>
            )}
          </>
        )}
      </AsyncContent>
    </Page>
  );
}

function matchingJobsText(count) {
  if (count === 0) return 'No open jobs offer';
  return count === 1 ? '1 open job offers' : `${count} open jobs offer`;
}
