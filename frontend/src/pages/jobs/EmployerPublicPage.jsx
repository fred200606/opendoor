import { useLocation, useParams } from 'react-router-dom';
import { getEmployer, getTrustScore } from '../../api/profile.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { jobPath } from '../../auth/navigation.js';
import AsyncContent from '../../components/AsyncContent.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import JobCard from '../../components/JobCard.jsx';
import Page from '../../components/Page.jsx';
import { VerifiedBadge } from '../../components/StatusBadge.jsx';
import TrustScoreCard from '../../components/TrustScoreCard.jsx';
import { useAsync } from '../../hooks/useAsync.js';

/** Public employer page (Figma 3:908): company, verified badge, trust score with breakdown, open jobs. */
export default function EmployerPublicPage() {
  const { id } = useParams();
  const { state: locationState } = useLocation();
  const { user } = useAuth();
  const back =
    typeof locationState?.back?.to === 'string' && locationState.back.to.startsWith('/')
      ? locationState.back
      : { to: user?.role === 'candidate' ? '/candidate/jobs' : '/jobs', label: 'Back to job results' };
  const state = useAsync(
    () => Promise.all([getEmployer(id), getTrustScore(id).catch(() => null)]),
    [id],
  );

  return (
    <AsyncContent state={state} label="Loading the employer" errorTitle="This employer could not be loaded">
      {([employer, trustScore]) => (
        <Page
          title={employer.company_name}
          className="employer-page"
          back={back}
          badge={<VerifiedBadge verified={employer.verified} />}
          subtitle={
            <div className="employer-intro">
              {employer.logo_url && <img src={employer.logo_url} alt={`${employer.company_name} logo`} className="employer-logo" />}
              <p className="employer-intro__meta">{[employer.industry, employer.location?.label ?? employer.address].filter(Boolean).join(' · ')}</p>
              {employer.description && <div className="prose">{employer.description}</div>}
            </div>
          }
        >
          <div className="employer-layout">
            <TrustScoreCard trustScore={trustScore ?? employer.trust_score} breakdown={trustScore?.breakdown} />

            <section aria-labelledby="open-jobs-title">
              <h2 id="open-jobs-title">Open jobs</h2>
              {employer.open_postings?.length ? (
                <ul className="result-list">
              {employer.open_postings.map((job) => (
                <li key={job.id}>
                  <JobCard
                    job={{ ...job, employer: job.employer ?? employer }}
                    to={jobPath(user?.role, job.id)}
                    state={{ back: { to: `/employers/${employer.id}`, label: `Back to ${employer.company_name}` } }}
                    headingLevel={3}
                  />
                </li>
              ))}
                </ul>
              ) : (
                <EmptyState title="No open jobs right now" />
              )}
            </section>
          </div>
        </Page>
      )}
    </AsyncContent>
  );
}
