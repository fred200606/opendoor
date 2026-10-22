import { Building2, EyeOff, Flag, MessageSquare, ShieldCheck, TriangleAlert, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getDashboard } from '../../api/account.js';
import AsyncContent from '../../components/AsyncContent.jsx';
import BarRows, { StackedBar } from '../../components/charts/BarRows.jsx';
import ChartCard from '../../components/charts/ChartCard.jsx';
import LineChart from '../../components/charts/LineChart.jsx';
import Page from '../../components/Page.jsx';
import StatCards from '../../components/StatCards.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { formatDate, percent } from '../../lib/format.js';
import { POSTING_STATUSES } from '../../lib/labels.js';
import { POSTING_TILES } from '../../lib/statusTiles.js';

const SHORT_DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
const shortDate = (date) => SHORT_DATE.format(new Date(`${date}T00:00:00+08:00`));

const ACTIVITY = [
  { key: 'applications', label: 'Applications', color: 'var(--viz-series-1)' },
  { key: 'hires', label: 'Confirmed hires', color: 'var(--viz-series-2)' },
];

const STAGES = [
  ['submitted', 'Submitted'],
  ['reviewed', 'Under review'],
  ['shortlisted', 'Shortlisted'],
  ['contacted', 'Contacted'],
  ['hired', 'Hired'],
];

const NEED_SERIES = [
  { label: 'Job seekers who need it', color: 'var(--viz-series-1)' },
  { label: 'Open jobs that offer it', color: 'var(--viz-series-2)' },
];

/** GET /admin/dashboard – shape documented in docs/openapi.yaml (AdminDashboard). Figma 7:3068; charts: Decision 2026-10-22d. */
export default function AdminDashboardPage() {
  const state = useAsync(() => getDashboard('admin'), []);

  return (
    <Page title="Administration" subtitle={<p className="page__subtitle">Work queues, platform numbers and how hiring is going.</p>}>
      <AsyncContent state={state} label="Loading analytics">
        {(dashboard) => (
          <div className="admin-dashboard">
            <StatCards
              title="Waiting for you"
              className="stats--fit"
              items={[
                { label: 'Employers to verify', value: dashboard.verification_queue ?? 0, to: '/admin/employers', linkLabel: 'Open queue', icon: Building2, tone: 'lilac' },
                { label: 'Open reports', value: dashboard.open_reports ?? 0, to: '/admin/reports', linkLabel: 'Open queue', icon: Flag, tone: 'orange' },
              ]}
            />

            {dashboard.analytics && <Analytics analytics={dashboard.analytics} />}

            <StatCards
              title="Users"
              className="stats--fit"
              items={[
                { label: 'Job seekers', value: dashboard.users?.candidate ?? 0, to: '/admin/users?role=candidate', icon: User, tone: 'pink' },
                { label: 'Employers', value: dashboard.users?.employer ?? 0, to: '/admin/users?role=employer', icon: Building2, tone: 'lilac' },
                { label: 'Administrators', value: dashboard.users?.admin ?? 0, to: '/admin/users?role=admin', icon: ShieldCheck, tone: 'sky' },
                { label: 'Suspended', value: dashboard.users?.suspended ?? 0, icon: TriangleAlert, tone: 'orange' },
              ]}
            />
            <StatCards
              title="Job postings"
              className="stats--fit"
              items={Object.entries(POSTING_STATUSES).map(([status, label]) => ({ label, value: dashboard.postings?.[status] ?? 0, ...POSTING_TILES[status] }))}
            />
            <StatCards
              title="Verification after hire"
              className="stats--fit"
              items={[
                { label: 'Feedback responses', value: dashboard.feedback?.responses ?? 0, to: '/admin/feedback', icon: MessageSquare, tone: 'lilac' },
                { label: 'Hidden responses', value: dashboard.feedback?.hidden ?? 0, icon: EyeOff, tone: 'pink' },
                { label: 'Published trust scores', value: dashboard.published_trust_scores ?? 0, icon: ShieldCheck, tone: 'sky' },
              ]}
            />
            <p>
              Manage <Link to="/admin/master-data">categories and accommodation types</Link>
            </p>
          </div>
        )}
      </AsyncContent>
    </Page>
  );
}

function Analytics({ analytics }) {
  return (
    <section aria-label="Analytics" className="admin-charts">
      <Activity weeks={analytics.weeks ?? []} />
      <div className="admin-charts admin-charts--pair">
        <Funnel funnel={analytics.funnel ?? {}} />
        <Delivery delivery={analytics.delivery ?? {}} />
      </div>
      <Needs needs={analytics.needs ?? { top: [] }} />
    </section>
  );
}

/** Applications and confirmed hires per week (one axis: both are counts of applications). */
function Activity({ weeks }) {
  const sum = (key) => weeks.reduce((total, week) => total + (week[key] ?? 0), 0);
  const latest = weeks[weeks.length - 1] ?? {};
  const points = weeks.map((week) => ({
    label: `Week of ${formatDate(week.week_start)}`,
    short: shortDate(week.week_start),
    values: { applications: week.applications ?? 0, hires: week.hires ?? 0 },
  }));

  return (
    <ChartCard
      title="Activity, last 12 weeks"
      subtitle={`${sum('applications')} applications, ${sum('hires')} confirmed hires and ${sum('new_accounts')} new accounts.`}
      empty={sum('applications') + sum('hires') === 0 ? 'No applications or hires in the last 12 weeks yet.' : null}
      table={{
        caption: 'Activity per week (Monday to Sunday, Manila time)',
        columns: ['Week of', 'Applications', 'Confirmed hires', 'New accounts'],
        rows: weeks.map((week) => [formatDate(week.week_start), week.applications, week.hires, week.new_accounts]),
      }}
    >
      <LineChart
        points={points}
        series={ACTIVITY}
        describe={`Applications and confirmed hires per week over the last 12 weeks. This week: ${latest.applications ?? 0} applications, ${latest.hires ?? 0} confirmed hires.`}
      />
    </ChartCard>
  );
}

/** How far applications get; each bar is a share of all submitted applications. */
function Funnel({ funnel }) {
  const submitted = funnel.submitted ?? 0;
  return (
    <ChartCard
      title="How far applications get"
      subtitle="Applications that reached each stage. A stage the employer skipped counts as passed."
      empty={submitted === 0 ? 'No applications yet.' : null}
      table={{
        caption: 'Applications per stage',
        columns: ['Stage', 'Applications', 'Share of submitted'],
        rows: STAGES.map(([key, label]) => [label, funnel[key] ?? 0, percent(funnel[key] ?? 0, submitted)]),
      }}
    >
      <BarRows
        series={[{ label: 'Applications', color: 'var(--viz-series-1)' }]}
        rows={STAGES.map(([key, label]) => ({
          label,
          bars: [{ value: submitted ? (funnel[key] ?? 0) / submitted : 0, text: String(funnel[key] ?? 0), detail: `· ${percent(funnel[key] ?? 0, submitted)}` }],
        }))}
      />
    </ChartCard>
  );
}

/** Ratings of promised accommodations: an ordered scale, so one 100% bar with a grey middle. */
function Delivery({ delivery }) {
  const parts = [
    { label: 'Delivered', count: delivery.delivered ?? 0, color: 'var(--viz-good)' },
    { label: 'Partly delivered', count: delivery.partial ?? 0, color: 'var(--viz-mid)' },
    { label: 'Not delivered', count: delivery.not_delivered ?? 0, color: 'var(--viz-bad)' },
  ];
  const total = parts.reduce((sum, part) => sum + part.count, 0);

  return (
    <ChartCard
      title="Were the promised accommodations delivered?"
      subtitle={`From ${total} anonymous ratings by hired employees (hidden responses left out).`}
      empty={total === 0 ? 'No ratings yet. Hired employees can rate 30 days after their start date.' : null}
      table={{
        caption: 'Ratings of promised accommodations',
        columns: ['Rating', 'Ratings', 'Share'],
        rows: parts.map((part) => [part.label, part.count, percent(part.count, total)]),
      }}
    >
      <p className="chart-hero">{percent(parts[0].count, total)}</p>
      <p>of the rated accommodations were fully delivered.</p>
      <StackedBar parts={parts} />
    </ChartCard>
  );
}

/** The most needed accommodations against how many open jobs offer them: where the supply gap is. */
function Needs({ needs }) {
  const top = needs.top ?? [];
  const seekers = needs.job_seekers ?? 0;
  const jobs = needs.open_jobs ?? 0;

  return (
    <ChartCard
      title="Most needed accommodations"
      subtitle={`Share of the ${seekers} job seekers who need each one, next to the share of the ${jobs} open jobs that offer it.`}
      empty={top.length === 0 ? 'No job seeker has saved an accommodation need yet.' : null}
      table={{
        caption: 'Most needed accommodations and how many open jobs offer them',
        columns: ['Accommodation', 'Job seekers who need it', 'Open jobs that offer it'],
        rows: top.map((item) => [item.name, `${item.job_seekers} (${percent(item.job_seekers, seekers)})`, `${item.open_jobs} (${percent(item.open_jobs, jobs)})`]),
      }}
    >
      <BarRows
        series={NEED_SERIES}
        rows={top.map((item) => ({
          label: item.name,
          bars: [
            { value: seekers ? item.job_seekers / seekers : 0, text: percent(item.job_seekers, seekers), detail: `(${item.job_seekers})` },
            { value: jobs ? item.open_jobs / jobs : 0, text: percent(item.open_jobs, jobs), detail: `(${item.open_jobs})` },
          ],
        }))}
      />
    </ChartCard>
  );
}
