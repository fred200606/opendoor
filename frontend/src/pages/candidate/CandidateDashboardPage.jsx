import { Link, useLocation } from 'react-router-dom';
import { getDashboard } from '../../api/account.js';
import { getApplications } from '../../api/applications.js';
import { searchJobs } from '../../api/jobs.js';
import { getCandidateProfile } from '../../api/profile.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import Alert from '../../components/Alert.jsx';
import AsyncContent from '../../components/AsyncContent.jsx';
import GetStarted from '../../components/GetStarted.jsx';
import IconTile from '../../components/IconTile.jsx';
import MatchBadge from '../../components/MatchBadge.jsx';
import Page from '../../components/Page.jsx';
import { ApplicationStatusBadge } from '../../components/StatusBadge.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useOnboarding } from '../../hooks/useOnboarding.js';
import { formatDate, plural } from '../../lib/format.js';
import { pipelineTiles } from '../../lib/statusTiles.js';

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
              <MyApplications dashboard={dashboard} />

              {/* A rating that can be given now is in "My applications" (Feedback due); later ones are listed here. */}
              <div className="dashboard-side">
                <BestMatches />
                <YourNeeds count={dashboard.needs_count ?? 0} />
                <RatingsToGive due={dashboard.feedback_due ?? []} />
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

const RECENT = 5;

/**
 * "My applications" in the IPT layout: See all N, a "Feedback due" callout for each rating that
 * can be given now, the counts per group, then the newest applications with their status.
 */
function MyApplications({ dashboard }) {
  const counts = dashboard.applications ?? {};
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const recent = useAsync(() => (total > 0 ? getApplications() : Promise.resolve({ data: [] })), [total]);
  const due = (dashboard.feedback_due ?? []).filter((item) => item.is_open);

  return (
    <section aria-labelledby="my-applications-title" className="od rounded-lg border-2 border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="my-applications-title" className="text-2xl font-bold">
          My applications
        </h2>
        {total > 0 && (
          <Link to="/candidate/applications" className="inline-flex min-h-11 items-center font-bold text-primary underline underline-offset-4 hover:no-underline">
            See all {total} <span className="sr-only">applications</span>
          </Link>
        )}
      </div>

      {due.map((item) => (
        <div key={item.application_id} className="mt-4 rounded-lg border-2 border-warning bg-warning-soft p-4">
          <h3 className="text-lg font-bold text-warning">Feedback due</h3>
          <p className="mt-1">
            Rate how {item.company_name} delivered the accommodations for {item.job_title}.
          </p>
          <Link className="button mt-3" to={`/candidate/applications/${item.application_id}/feedback`}>
            Rate the accommodations <span className="sr-only">for {item.job_title}</span>
          </Link>
        </div>
      ))}

      {/* The stage tiles from `pipeline` (Decision 2026-10-22b, after opendoor-ipt). */}
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {pipelineTiles(dashboard.pipeline, 'candidate').map((tile) => (
          <li key={tile.label} className="flex flex-col items-start gap-1 rounded-lg border-2 border-border p-4">
            <IconTile icon={tile.icon} tone={tile.tone} />
            <span className="mt-1 font-display text-2xl font-bold text-accent">{tile.value}</span>
            <span className="font-bold">{tile.label}</span>
          </li>
        ))}
      </ul>

      <h3 className="mt-6 text-lg font-bold">Your latest applications</h3>
      {total === 0 ? (
        <p className="mt-2">
          You have not applied yet. <Link to="/candidate/jobs">Find jobs that fit you</Link>
        </p>
      ) : (
        <AsyncContent state={recent} label="Loading your applications">
          {({ data }) => (
            <ul className="mt-2 divide-y divide-border">
              {data.slice(0, RECENT).map((application) => (
                <li key={application.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
                  <div className="min-w-0">
                    <Link to={`/candidate/applications/${application.id}`} className="font-bold">
                      {application.job_posting?.title}
                    </Link>
                    <p className="text-sm text-muted">
                      {application.job_posting?.employer?.company_name} · Applied {formatDate(application.created_at)}
                    </p>
                  </div>
                  <ApplicationStatusBadge application={application} />
                </li>
              ))}
            </ul>
          )}
        </AsyncContent>
      )}
    </section>
  );
}

const RECOMMENDED = 3;

/** The best fits right away (decision 2026-10-21): the first "Recommended for me" results. */
function BestMatches() {
  const state = useAsync(() => searchJobs({ match: 1 }), []);
  const jobs = (state.data?.data ?? []).slice(0, RECOMMENDED);

  return (
    <section aria-labelledby="matches-title">
      <h2 id="matches-title">Your best matches</h2>
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
          <Link to="/candidate/jobs">See all your matches</Link>
        </p>
      </div>
    </section>
  );
}

/** Ratings not open yet, with their date ("My applications" shows the open ones). Nothing due → how rating works. */
function RatingsToGive({ due }) {
  const later = due.filter((item) => !item.is_open);
  if (due.length > 0 && later.length === 0) return null;

  return (
    <section aria-labelledby="feedback-due-title">
      <h2 id="feedback-due-title">Ratings to give</h2>
      <div className="dashboard-side__cards">
        {later.length === 0 ? (
          <div className="card">
            <p className="muted">Nothing to rate yet. You can rate the accommodations 30 days after an employer contacts you.</p>
          </div>
        ) : (
          later.map((item) => (
            <div key={item.application_id} className="card">
              <h3 className="dashboard-side__title">
                {item.job_title} at {item.company_name}
              </h3>
              <p className="muted">You can rate the accommodations from {formatDate(item.opens_on)}.</p>
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
