import { BadgeCheck, Briefcase, CircleCheck, FileText, Hourglass, Inbox, Info, Plus, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getDashboard } from '../../api/account.js';
import { getMyPostings } from '../../api/jobs.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { ApiErrorAlert } from '../../components/Alert.jsx';
import AsyncContent from '../../components/AsyncContent.jsx';
import BarRows from '../../components/charts/BarRows.jsx';
import ChartCard from '../../components/charts/ChartCard.jsx';
import LineChart from '../../components/charts/LineChart.jsx';
import GetStarted from '../../components/GetStarted.jsx';
import IconTile from '../../components/IconTile.jsx';
import Loading from '../../components/Loading.jsx';
import Page from '../../components/Page.jsx';
import StatCards from '../../components/StatCards.jsx';
import Tabs from '../../components/Tabs.jsx';
import TrustScoreCard from '../../components/TrustScoreCard.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { showsGetStarted, useOnboarding } from '../../hooks/useOnboarding.js';
import { formatDate, percent, plural } from '../../lib/format.js';
import { EMPLOYMENT_TYPES, WORK_SETUPS } from '../../lib/labels.js';

// IPT look (decision 2026-10-21b): white cards on the canvas.
const CARD = 'od min-w-0 rounded-lg border-2 border-border bg-surface p-5 sm:p-6';
const CARD_TITLE = 'font-display text-xl font-bold';
const TWO_COLUMNS = 'grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]';
const SHOWN_POSTINGS = 5;
const POSTING_TABS = [
  ['open', 'Open'],
  ['draft', 'Draft'],
  ['closed', 'Closed'],
];

const SHORT_DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
const shortDate = (date) => SHORT_DATE.format(new Date(`${date}T00:00:00+08:00`));

const WEEK_SERIES = [
  { key: 'applications', label: 'Applications', color: 'var(--viz-series-1)' },
  { key: 'hires', label: 'Confirmed hires', color: 'var(--viz-series-2)' },
];

/**
 * GET /employer/dashboard – shape documented in docs/openapi.yaml (EmployerDashboard). Layout from
 * the user’s reference (Decision 2026-10-22f), rearranged 2026-10-25: tiles → job postings |
 * needs attention + trust score → applications per week | application overview → recent activity.
 */
export default function EmployerDashboardPage() {
  const { user } = useAuth();
  const state = useAsync(() => getDashboard('employer'), []);
  const { onboarding } = useOnboarding();

  return (
    <Page
      title={`Welcome, ${user.name}`}
      subtitle={<p className="page__subtitle">Manage your jobs and connect with candidates.</p>}
      actions={
        <Link to="/employer/jobs/new" className="button">
          <Plus aria-hidden="true" focusable="false" />
          Post a job
        </Link>
      }
    >
      <AsyncContent state={state} label="Loading your summary">
        {(dashboard) => {
          const steps = employerSteps(dashboard);
          const pipeline = dashboard.pipeline ?? {};
          return (
            <div className="grid gap-6">
              <GetStarted steps={steps} />
              {/* The "Get started" list has the same first step. */}
              {!dashboard.company?.exists && !showsGetStarted(onboarding, steps) && (
                <div className="callout">
                  <Info className="callout__icon" aria-hidden="true" focusable="false" />
                  <p>
                    <strong>Set up your company profile</strong> so an administrator can verify your business.
                  </p>
                  <Link className="button button--small" to="/employer/company">
                    Set up company
                  </Link>
                </div>
              )}
              {dashboard.company?.exists && !dashboard.company.verified && (
                <div className="callout">
                  <Info className="callout__icon" aria-hidden="true" focusable="false" />
                  <p>
                    {dashboard.company.verification_rejected_reason
                      ? `Verification was not approved: ${dashboard.company.verification_rejected_reason}`
                      : 'Your business registration is waiting for verification. You can prepare jobs as drafts and publish them once an administrator has verified your company.'}
                  </p>
                  <Link className="button button--secondary button--small" to="/employer/company">
                    View company profile
                  </Link>
                </div>
              )}

              <StatCards
                title="At a glance"
                hideTitle
                className="stats--fit"
                items={[
                  { label: 'Open jobs', value: dashboard.postings?.open ?? 0, to: '/employer/jobs?status=open', icon: Briefcase, tone: 'sky' },
                  { label: 'New applications', value: pipeline.submitted ?? 0, icon: Inbox, tone: 'lilac' },
                  { label: 'Pending hire confirmations', value: pipeline.hiring_pending ?? 0, icon: Hourglass, tone: 'orange' },
                  { label: 'Confirmed hires', value: pipeline.hired ?? 0, icon: BadgeCheck, tone: 'sky' },
                ]}
              />

              {/* Both rows share one 3:2 split and stretch their cards, so edges and bottoms line up. */}
              <div className={TWO_COLUMNS}>
                <YourPostings counts={dashboard.postings ?? {}} />
                <div className="flex min-w-0 flex-col gap-6">
                  <NeedsAttention attention={dashboard.attention ?? {}} />
                  <section className={`${CARD} flex-1`} aria-labelledby="trust-title">
                    <h2 id="trust-title" className={CARD_TITLE}>
                      Accommodation trust score
                    </h2>
                    <div className="mt-4">
                      <TrustScoreCard
                        trustScore={dashboard.trust_score}
                        showTitle={false}
                        explain
                        link={{ to: '/employer/trust-score', label: 'See each accommodation' }}
                      />
                    </div>
                  </section>
                </div>
              </div>

              <div className={dashboard.weeks ? TWO_COLUMNS : 'grid'}>
                {dashboard.weeks && <WeeklyApplications weeks={dashboard.weeks} />}
                <ApplicationOverview pipeline={pipeline} applications={dashboard.applications ?? {}} />
              </div>

              <RecentActivity items={dashboard.recent_activity ?? []} />
            </div>
          );
        }}
      </AsyncContent>
    </Page>
  );
}

/** The employer's postings by status in tabs; each tab loads its first page from the postings list. */
function YourPostings({ counts }) {
  const [selected, setSelected] = useState('open');

  return (
    <section className={CARD} aria-labelledby="your-postings-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="your-postings-title" className={CARD_TITLE}>
          Your job postings
        </h2>
        <Link to={`/employer/jobs?status=${selected}`} className="font-bold text-primary underline underline-offset-4 hover:no-underline">
          View all <span className="visually-hidden">{POSTING_TABS.find(([id]) => id === selected)[1].toLowerCase()} job postings</span>
        </Link>
      </div>
      <div className="mt-3">
        <Tabs
          label="Job postings by status"
          selected={selected}
          onSelect={setSelected}
          tabs={POSTING_TABS.map(([id, label]) => ({
            id,
            label: `${label} (${counts[id] ?? 0})`,
            content: id === selected ? <PostingsTable status={id} label={label} /> : null,
          }))}
        />
      </div>
    </section>
  );
}

function PostingsTable({ status, label }) {
  const state = useAsync(() => getMyPostings({ status }), [status]);
  if (state.loading) return <Loading label={`Loading ${label.toLowerCase()} job postings`} />;
  if (state.error) return <ApiErrorAlert error={state.error} title="Your job postings could not be loaded" />;

  const postings = (state.data?.data ?? []).slice(0, SHOWN_POSTINGS);
  if (postings.length === 0) {
    return (
      <p className="mt-2">
        No {label.toLowerCase()} jobs.{' '}
        {status !== 'closed' && (
          <Link to="/employer/jobs/new" className="font-bold text-primary underline underline-offset-4">
            Post a job
          </Link>
        )}
      </p>
    );
  }

  return (
    // Wider than a phone, the table scrolls in its own box, which takes focus (WCAG 1.4.10).
    <div className="relative overflow-x-auto" role="region" aria-label={`${label} job postings`} tabIndex={0}>
      <table className="w-full min-w-[30rem] border-collapse text-left">
        <thead className="bg-subtle text-sm">
          <tr>
            <th scope="col" className="px-3 py-2">
              Job title
            </th>
            <th scope="col" className="px-3 py-2">
              Applicants
            </th>
            <th scope="col" className="px-3 py-2">
              Deadline
            </th>
            <th scope="col" className="px-3 py-2">
              <span className="visually-hidden">Action</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {postings.map((posting) => (
            <tr key={posting.id} className="border-t border-border">
              <th scope="row" className="px-3 py-3 font-normal">
                <span className="block font-bold">{posting.title}</span>
                <span className="text-sm text-muted">{[WORK_SETUPS[posting.work_setup], EMPLOYMENT_TYPES[posting.employment_type]].filter(Boolean).join(' · ')}</span>
              </th>
              <td className="px-3 py-3">
                <Link
                  to={`/employer/jobs/${posting.id}/applicants`}
                  aria-label={`${plural(posting.applicants_count ?? 0, 'applicant')} for ${posting.title}`}
                  className="text-primary underline underline-offset-4 hover:no-underline"
                >
                  {posting.applicants_count ?? 0}
                </Link>
              </td>
              <td className="px-3 py-3 whitespace-nowrap">{shortDate(posting.closes_at)}</td>
              <td className="px-3 py-3 text-right">
                <Link to={`/employer/jobs/${posting.id}/edit`} className="button button--secondary button--small" aria-label={`Manage ${posting.title}`}>
                  Manage
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** New applications per job and the hiring reports the employer has to answer. */
function NeedsAttention({ attention }) {
  const jobs = attention.new_applications ?? [];
  const reports = attention.hiring_reports ?? [];
  const newTotal = jobs.reduce((sum, job) => sum + job.count, 0);

  return (
    <section className={CARD} aria-labelledby="attention-title">
      <h2 id="attention-title" className={CARD_TITLE}>
        Needs attention
      </h2>
      {newTotal === 0 && reports.length === 0 ? (
        <p className="mt-4 flex items-center gap-2">
          <CircleCheck className="size-5 text-success" aria-hidden="true" focusable="false" />
          You’re all caught up.
        </p>
      ) : (
        <ul className="mt-4 grid gap-4">
          {newTotal > 0 && (
            <li className="rounded-md border border-border p-4">
              <div className="flex gap-3">
                <IconTile icon={Users} tone="lilac" />
                <div className="min-w-0">
                  <h3 className="font-bold">{plural(newTotal, 'new application')}</h3>
                  <p className="text-sm text-muted">Candidates waiting for your review.</p>
                </div>
              </div>
              <ul className="mt-3 grid gap-2">
                {jobs.map((job) => (
                  <li key={job.job_posting_id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {job.title} <span className="text-muted">({job.count})</span>
                    </span>
                    <Link to={`/employer/jobs/${job.job_posting_id}/applicants`} className="button button--small">
                      Review applicants <span className="visually-hidden">for {job.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          )}
          {reports.map((report) => (
            <li key={report.hiring_report_id} className="rounded-md border border-border p-4">
              <div className="flex gap-3">
                <IconTile icon={FileText} tone="orange" />
                <div className="min-w-0">
                  <h3 className="font-bold">Hiring report to confirm</h3>
                  <p className="text-sm text-muted">
                    {report.candidate_name ?? 'A candidate'} reported being hired as {report.job_title}, starting {formatDate(report.start_date)}.
                  </p>
                </div>
              </div>
              <p className="mt-3 text-right">
                <Link to={`/employer/applications/${report.application_id}`} className="button button--small">
                  Review confirmation <span className="visually-hidden">from {report.candidate_name ?? 'the candidate'}</span>
                </Link>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Every application by where it stands now; the stages add up to all applications received. */
function ApplicationOverview({ pipeline, applications }) {
  const rejected = applications.rejected ?? 0;
  const withdrawn = applications.withdrawn ?? 0;
  const stages = [
    ['Submitted', pipeline.submitted ?? 0],
    ['Under review', pipeline.under_review ?? 0],
    ['Shortlisted', pipeline.shortlisted ?? 0],
    ['Contacted', pipeline.contacted ?? 0],
    ['Hired', pipeline.hired ?? 0],
    ['Not selected', rejected],
    ['Withdrawn', withdrawn],
    ['Job closed', Math.max(0, (pipeline.closed ?? 0) - rejected - withdrawn)],
  ];
  const total = stages.reduce((sum, [, count]) => sum + count, 0);

  return (
    <ChartCard
      title="Application overview"
      subtitle={`Where your ${plural(total, 'application')} stand now.`}
      empty={total === 0 ? 'No applications yet.' : null}
      table={{ caption: 'Applications by stage', columns: ['Stage', 'Applications', 'Share'], rows: stages.map(([label, count]) => [label, count, percent(count, total)]) }}
    >
      <BarRows
        inline
        series={[{ label: 'Applications', color: 'var(--viz-series-1)' }]}
        rows={stages.map(([label, count]) => ({ label, bars: [{ value: total ? count / total : 0, text: String(count), detail: `· ${percent(count, total)}` }] }))}
      />
    </ChartCard>
  );
}

/** Applications received and hires confirmed per week (one axis: both count applications). */
function WeeklyApplications({ weeks }) {
  const sum = (key) => weeks.reduce((total, week) => total + (week[key] ?? 0), 0);
  const latest = weeks[weeks.length - 1] ?? {};

  return (
    <ChartCard
      title="Applications, last 12 weeks"
      subtitle={`${plural(sum('applications'), 'application')} received and ${plural(sum('hires'), 'confirmed hire')}.`}
      empty={sum('applications') + sum('hires') === 0 ? 'No applications in the last 12 weeks yet.' : null}
      table={{
        caption: 'Applications and confirmed hires per week (Monday to Sunday, Manila time)',
        columns: ['Week of', 'Applications', 'Confirmed hires'],
        rows: weeks.map((week) => [formatDate(week.week_start), week.applications, week.hires]),
      }}
    >
      <LineChart
        points={weeks.map((week) => ({
          label: `Week of ${formatDate(week.week_start)}`,
          short: shortDate(week.week_start),
          values: { applications: week.applications ?? 0, hires: week.hires ?? 0 },
        }))}
        series={WEEK_SERIES}
        describe={`Applications and confirmed hires per week over the last 12 weeks. This week: ${latest.applications ?? 0} applications, ${latest.hires ?? 0} confirmed hires.`}
      />
    </ChartCard>
  );
}

/** "Ana Cruz applied for Data Encoder" etc.: what happened, by whom, on which job. */
function activityText(item) {
  const name = item.candidate_name ?? 'A candidate';
  const you = item.by === 'employer';
  switch (item.type) {
    case 'application_received':
      return `${name} applied for ${item.job_title}`;
    case 'hiring_reported':
      return you ? `You reported hiring ${name} for ${item.job_title}` : `${name} reported being hired as ${item.job_title}`;
    case 'hiring_confirmed':
      return you ? `You confirmed ${name}’s hire for ${item.job_title}` : `${name} confirmed the hire for ${item.job_title}`;
    case 'hiring_not_yet':
      return `${you ? 'You' : name} answered “Not yet” to the hiring report for ${item.job_title}`;
    case 'hiring_disputed':
      return `${you ? 'You' : name} said the hiring report for ${item.job_title} is incorrect`;
    case 'hiring_cancelled':
      return `The hiring report for ${name} (${item.job_title}) was cancelled`;
    default:
      return `Update on ${name}’s application for ${item.job_title}`;
  }
}

function RecentActivity({ items }) {
  return (
    <section className={CARD} aria-labelledby="activity-title">
      <h2 id="activity-title" className={CARD_TITLE}>
        Recent activity
      </h2>
      {items.length === 0 ? (
        <p className="mt-3">No activity yet. New applications and hiring reports show up here.</p>
      ) : (
        <table className="mt-3 w-full border-collapse text-left">
          <thead className="bg-subtle text-sm">
            <tr>
              <th scope="col" className="px-3 py-2">
                Activity
              </th>
              <th scope="col" className="px-3 py-2">
                Date
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={`${item.type}-${item.application_id}-${item.at}`} className="border-t border-border">
                <td className="px-3 py-2">
                  <span className="mr-3 hidden align-middle sm:inline-flex">
                    <IconTile icon={item.type === 'application_received' ? Users : FileText} tone={item.type === 'application_received' ? 'lilac' : 'orange'} />
                  </span>
                  <Link to={`/employer/applications/${item.application_id}`} className="text-primary underline underline-offset-4 hover:no-underline">
                    {activityText(item)}
                  </Link>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{shortDate(item.at.slice(0, 10))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/** Onboarding "Get started" steps, from the dashboard data. */
function employerSteps(dashboard) {
  const company = dashboard.company ?? {};
  const submitted = ['open', 'closed'].some((status) => (dashboard.postings?.[status] ?? 0) > 0);
  let verificationHint = 'An administrator is checking your registration. We will notify you.';
  if (!company.exists) verificationHint = 'An administrator checks your registration after you set up your company profile.';
  else if (company.verification_rejected_reason) verificationHint = 'Not approved yet. Update your company profile and it is checked again.';

  return [
    { id: 'account', title: 'Create your account', done: true },
    {
      id: 'company',
      title: 'Set up your company profile',
      done: Boolean(company.exists),
      hint: 'With your DTI or SEC registration number.',
      link: { to: '/employer/company', label: 'Set up company' },
    },
    {
      id: 'verified',
      title: 'Get your business verified',
      done: Boolean(company.verified),
      hint: verificationHint,
      link: company.exists && company.verification_rejected_reason ? { to: '/employer/company', label: 'Update company' } : undefined,
    },
    {
      id: 'post',
      title: 'Publish your first job',
      done: submitted,
      hint: 'List the skills it needs and the accommodations it offers. It goes live as soon as you publish it.',
      link: company.exists ? { to: '/employer/jobs/new', label: 'Post a job' } : undefined,
    },
  ];
}
