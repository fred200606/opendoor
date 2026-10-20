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
import { companyInitials } from '../../lib/format.js';


/** Public employer page (Figma 3:908, IPT look): company, verified badge, trust score with breakdown, open jobs. */
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
          back={back}
          badge={<VerifiedBadge verified={employer.verified} />}
          subtitle={
            <section aria-label="About the company" className="od mt-6 flex gap-4 rounded-lg border-2 border-border bg-surface p-5 sm:p-6">
              {employer.logo_url ? (
                <img src={employer.logo_url} alt={`${employer.company_name} logo`} className="size-16 shrink-0 rounded-md border border-border bg-surface object-contain" />
              ) : (
                <span aria-hidden="true" className="grid size-16 shrink-0 place-items-center rounded-md border border-border bg-primary-soft font-display text-xl font-semibold text-accent">
                  {companyInitials(employer.company_name)}
                </span>
              )}
              <div className="min-w-0">
                <p className="text-muted">{[employer.industry, employer.location?.label ?? employer.address].filter(Boolean).join(' · ')}</p>
                {employer.description && <div className="mt-2 max-w-prose whitespace-pre-line">{employer.description}</div>}
              </div>
            </section>
          }
        >
          <div className="od mt-6 grid items-start gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
            <TrustScoreCard trustScore={trustScore ?? employer.trust_score} breakdown={trustScore?.breakdown} />

            <section aria-labelledby="open-jobs-title">
              <h2 id="open-jobs-title" className="font-display text-2xl font-bold">
                Open jobs
              </h2>
              {employer.open_postings?.length ? (
                <ul className="mt-4 space-y-4">
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
                <div className="mt-4">
                  <EmptyState title="No open jobs right now" mascot />
                </div>
              )}
            </section>
          </div>
        </Page>
      )}
    </AsyncContent>
  );
}
