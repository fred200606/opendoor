import { Accessibility, Briefcase, Building2, Calendar, Check, Clock, Flag, Laptop, MapPin, MessageSquare, ShieldCheck, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { applyToJob } from '../../api/applications.js';
import { getJob, reportPosting } from '../../api/jobs.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import AccessibilitySnapshot from '../../components/AccessibilitySnapshot.jsx';
import Alert, { ApiErrorAlert } from '../../components/Alert.jsx';
import AsyncContent from '../../components/AsyncContent.jsx';
import Button from '../../components/Button.jsx';
import Dialog from '../../components/Dialog.jsx';
import ErrorSummary from '../../components/form/ErrorSummary.jsx';
import { TextArea } from '../../components/form/fields.jsx';
import MatchDetails from '../../components/MatchDetails.jsx';
import Page from '../../components/Page.jsx';
import ReadAloud from '../../components/ReadAloud.jsx';
import SaveJobButton from '../../components/SaveJobButton.jsx';
import StatusBadge, { VerifiedBadge } from '../../components/StatusBadge.jsx';
import TrustScoreCard from '../../components/TrustScoreCard.jsx';
import { useApiForm } from '../../hooks/useApiForm.js';
import { useAsync } from '../../hooks/useAsync.js';
import { companyInitials, formatDate } from '../../lib/format.js';
import MascotMessage from '../../components/mascot/MascotMessage.jsx';
import { ACCOMMODATION_GROUPS, EDUCATION_LEVELS, EMPLOYMENT_TYPES, INTERVIEW_FORMATS, WORK_SETUPS } from '../../lib/labels.js';

// IPT look (Francis Ruzgal's opendoor-ipt, decision 2026-10-21b): white cards on the canvas.
const CARD = 'od rounded-lg border-2 border-border bg-surface p-5 sm:p-6';
const CARD_TITLE = 'font-display text-2xl font-bold';
const GROUP_ICONS = { physical_access: Accessibility, communication: MessageSquare, work_arrangement: Clock, assistive_technology: Laptop, support: Users };

const APPLY_ERRORS = {
  ALREADY_APPLIED: 'You have already applied to this job. You can follow it in My applications.',
  POSTING_CLOSED: 'This job is no longer accepting applications.',
  PROFILE_INCOMPLETE: 'Complete your profile before you apply: where you live, at least 3 skills, your education and your work preferences. You can do this under Profile and needs.',
};

export default function JobDetailsPage() {
  const { id } = useParams();
  const state = useAsync(() => getJob(id), [id]);

  return (
    <AsyncContent state={state} label="Loading the job" errorTitle="This job could not be loaded">
      {(job) => <JobDetails job={job} />}
    </AsyncContent>
  );
}

function JobDetails({ job }) {
  const { user } = useAuth();
  const { state, pathname } = useLocation();
  const isCandidate = user?.role === 'candidate';
  const readRef = useRef(null);
  const back = isBackLink(state?.back) ? state.back : { to: isCandidate ? '/candidate/jobs' : '/jobs', label: 'Back to job results' };
  const trustScore = <TrustScoreCard trustScore={job.trust_score} explain />;

  const facts = [
    { icon: Building2, label: 'Work setup', value: WORK_SETUPS[job.work_setup] },
    { icon: Clock, label: 'Employment type', value: EMPLOYMENT_TYPES[job.employment_type] },
    { icon: MapPin, label: 'Location', value: [job.address, job.location?.label].filter(Boolean).join(', ') },
    { icon: MessageSquare, label: 'Interview', value: INTERVIEW_FORMATS[job.interview_format] },
    { icon: Calendar, label: 'Apply by', value: formatDate(job.closes_at) },
    { icon: Briefcase, label: 'Category', value: job.category?.name },
  ];
  const details = (
    <section key="details" className={CARD} aria-labelledby="job-details-title">
      <h2 id="job-details-title" className={CARD_TITLE}>
        Job details
      </h2>
      <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
        {facts.map((fact) => (
          <div key={fact.label} className="grid grid-cols-[1.25rem_1fr] content-start gap-x-2">
            <fact.icon className="mt-0.5 size-5 text-accent" aria-hidden="true" focusable="false" />
            <dt className="font-bold">{fact.label}</dt>
            <dd className="col-start-2">{fact.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
  const about = (
    <section key="about" className={CARD} aria-labelledby="job-about-title">
      <h2 id="job-about-title" className={CARD_TITLE}>
        About the job
      </h2>
      <div className="mt-3 whitespace-pre-line">{job.description}</div>
    </section>
  );
  const accommodations = <OfferedAccommodations key="accommodations" items={job.accommodations ?? []} />;
  const requirements = <Requirements key="requirements" job={job} />;

  return (
    <Page
      title={job.title}
      back={back}
      actions={<ReadAloud targetRef={readRef} title={[job.title, job.employer?.company_name].filter(Boolean).join('. ')} label="Read this job aloud" />}
    >
      <div ref={readRef} className="od mt-6 grid gap-6">
        <EmployerSummary job={job} backTo={{ to: pathname, label: `Back to ${job.title}` }} />
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="grid min-w-0 gap-6">
            {isCandidate && <MatchDetails job={job} />}
            {/* Job seekers see the accommodations first (Figma 5:1901); everyone else starts with the details. */}
            {isCandidate ? [accommodations, requirements, details, about] : [details, requirements, about, accommodations]}
            <AccessibilitySnapshot jobId={job.id} />
          </div>
          <div className="grid gap-6 lg:sticky lg:top-4">
            {!isCandidate && trustScore}
            <JobActions job={job} />
            {isCandidate && trustScore}
          </div>
        </div>
      </div>
    </Page>
  );
}


/** The employer at the top of the job (IPT): initials, name and badge, the facts and the trust score. */
function EmployerSummary({ job, backTo }) {
  const trust = job.trust_score;
  return (
    <section aria-label="Employer" className={`${CARD} flex gap-4`}>
      <span aria-hidden="true" className="grid size-16 shrink-0 place-items-center rounded-md border border-border bg-primary-soft font-display text-xl font-semibold text-accent">
        {companyInitials(job.employer?.company_name)}
      </span>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link to={`/employers/${job.employer?.id}`} state={{ back: backTo }} className="font-display text-lg font-semibold text-primary underline underline-offset-4 hover:no-underline">
            {job.employer?.company_name}
          </Link>
          <VerifiedBadge verified={job.employer?.verified} />
          {job.status !== 'open' && <StatusBadge kind="posting" status={job.status} />}
        </p>
        <p className="mt-2 text-muted">
          {[job.location?.label ?? job.address, WORK_SETUPS[job.work_setup], EMPLOYMENT_TYPES[job.employment_type]].filter(Boolean).join(' · ')}
        </p>
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-subtle px-3 py-1 text-sm text-muted">
          <ShieldCheck className="size-4" aria-hidden="true" focusable="false" />
          {trust?.published ? `Trust score: ${trust.score}% (${trust.based_on} ratings)` : 'Trust score: not rated yet'}
        </p>
      </div>
    </section>
  );
}

/** A back link handed over by the page that linked here (search, saved jobs, employer page). */
function isBackLink(back) {
  return typeof back?.to === 'string' && back.to.startsWith('/') && typeof back.label === 'string';
}

/** Skills and qualifications the employer asks for (decision 2026-10-21). */
function Requirements({ job }) {
  const skills = job.skills ?? [];
  const years = job.experience_years;

  return (
    <section className={CARD}>
      <h2 className={CARD_TITLE}>Skills and qualifications</h2>
      {skills.length === 0 ? (
        <p>The employer did not list any skills.</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Skills this job needs">
          {skills.map((skill) => (
            <li key={skill} className="tag">
              {skill}
            </li>
          ))}
        </ul>
      )}
      <dl className="details-list mt-4 mb-0">
        <dt>Minimum education</dt>
        <dd>{EDUCATION_LEVELS[job.education_level] ?? 'No minimum'}</dd>
        <dt>Minimum experience</dt>
        <dd>{years ? `${years} ${years === 1 ? 'year' : 'years'}` : 'None needed'}</dd>
        {job.qualifications && (
          <>
            <dt>Other qualifications</dt>
            <dd className="prose">{job.qualifications}</dd>
          </>
        )}
      </dl>
    </section>
  );
}

/** The accommodations by group, each with a tick and the employer's note (IPT: a violet left edge). */
function OfferedAccommodations({ items }) {
  const groups = Object.keys(ACCOMMODATION_GROUPS)
    .map((group) => ({ group, items: items.filter((item) => item.group === group) }))
    .filter((entry) => entry.items.length > 0);
  const ungrouped = items.filter((item) => !ACCOMMODATION_GROUPS[item.group]);

  return (
    <section className={`${CARD} border-l-4 border-l-primary`} aria-labelledby="job-accommodations-title">
      <h2 id="job-accommodations-title" className={CARD_TITLE}>
        Accommodations offered
      </h2>
      {items.length === 0 ? (
        <p className="mt-3">The employer did not list any accommodations.</p>
      ) : (
        [...groups, ...(ungrouped.length > 0 ? [{ group: 'other', items: ungrouped }] : [])].map(({ group, items: groupItems }) => {
          const Icon = GROUP_ICONS[group] ?? Check;
          return (
            <div key={group} className="mt-4">
              <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-accent">
                <Icon className="size-5" aria-hidden="true" focusable="false" />
                {ACCOMMODATION_GROUPS[group] ?? 'Other'}
              </h3>
              <ul className="mt-2 grid gap-2">
                {groupItems.map((item) => (
                  <li key={item.id} className="grid grid-cols-[1.25rem_1fr] gap-x-2">
                    <Check className="mt-0.5 size-5 text-success" aria-hidden="true" focusable="false" />
                    <span className="font-bold">{item.name}</span>
                    {item.note && <span className="col-start-2 text-muted">{item.note}</span>}
                  </li>
                ))}
              </ul>
            </div>
          );
        })
      )}
    </section>
  );
}

function JobActions({ job }) {
  const { user } = useAuth();
  const [mine, setMine] = useState(job.my_application ?? null);
  const [justApplied, setJustApplied] = useState(false);
  const sentRef = useRef(null);

  useEffect(() => {
    if (justApplied) sentRef.current?.focus();
  }, [justApplied]);

  if (!user) {
    return (
      <section className="card job-actions" aria-labelledby="apply-title" data-read-aloud="skip">
        <h2 id="apply-title">Interested?</h2>
        <p className="job-actions__lead">Log in to apply, or create an account. It takes about 2 minutes.</p>
        <Link to="/login" state={{ from: { pathname: `/candidate/jobs/${job.id}` } }} className="button button--block">
          Log in to apply
        </Link>
        <Link to="/register" className="button button--secondary button--block">
          Create an account
        </Link>
      </section>
    );
  }
  if (user.role !== 'candidate') return null;

  return (
    <div className="job-actions-group" data-read-aloud="skip">
      {justApplied && (
        <div ref={sentRef} tabIndex={-1} className="focus-target" role="status">
          <MascotMessage mood="happy" title="Application sent" headingLevel={2}>
            <p>
              The employer will review it. You can follow its status in <Link to="/candidate/applications">My applications</Link>.
            </p>
          </MascotMessage>
        </div>
      )}
      <section className="card job-actions" aria-labelledby="apply-title">
        <h2 id="apply-title">{mine ? 'Your application' : 'Apply for this job'}</h2>
        {mine ? (
          <>
            <p>
              You applied on {formatDate(mine.created_at)}. Status: <StatusBadge kind="application" status={mine.status} />
            </p>
            <p>
              <Link to={`/candidate/applications/${mine.id}`}>View your application</Link>
            </p>
          </>
        ) : job.status === 'open' ? (
          <ApplyForm
            job={job}
            onApplied={(application) => {
              setMine({ created_at: new Date().toISOString(), ...application });
              setJustApplied(true);
            }}
          />
        ) : (
          <p>This job is no longer accepting applications.</p>
        )}
      </section>
      <div className="actions job-actions__more">
        <SaveJobButton jobId={job.id} initiallySaved={Boolean(job.saved)} />
        <ReportButton jobId={job.id} />
      </div>
    </div>
  );
}

function ApplyForm({ job, onApplied }) {
  const form = useApiForm({ coverNote: '', interviewRequest: '' });
  const knownError = form.formError && APPLY_ERRORS[form.formError.code];

  async function handleSubmit(event) {
    event.preventDefault();
    const result = await form.submit((values) => applyToJob(job.id, values));
    if (result) onApplied(result);
  }

  return (
    <>
      <ErrorSummary
        errors={form.fieldErrors}
        fields={{ cover_note: { id: 'cover_note' }, interview_request: { id: 'interview_request' } }}
      />
      {knownError ? (
        <Alert type="error" live="assertive">
          <p>{knownError}</p>
        </Alert>
      ) : (
        <ApiErrorAlert error={form.formError} title="Your application was not sent" />
      )}
      <form onSubmit={handleSubmit} noValidate>
        <TextArea
          label="Cover note"
          voice
          id="cover_note"
          hint="Optional."
          maxLength={2000}
          error={form.fieldErrors.cover_note}
          {...form.bind('coverNote')}
        />
        <TextArea
          label="Interview accommodation request"
          voice
          id="interview_request"
          hint={`${job.interview_format === 'online' ? 'Online' : 'On-site'} interview. Optional. For example: sign language interpreter, extra time, captions.`}
          maxLength={1000}
          error={form.fieldErrors.interview_request}
          {...form.bind('interviewRequest')}
        />
        <Button type="submit" className="button button--block" disabled={form.submitting}>
          {form.submitting ? 'Sending…' : 'Send application'}
        </Button>
      </form>
    </>
  );
}

function ReportButton({ jobId }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const form = useApiForm({ reason: '' });

  async function handleSubmit(event) {
    event.preventDefault();
    const report = await form.submit((values) => reportPosting(jobId, values.reason));
    if (report) {
      setOpen(false);
      setDone(true);
    }
  }

  return (
    <>
      <Button type="button" className="button button--link button--icon-link" onClick={() => setOpen(true)} disabled={done}>
        {!done && <Flag aria-hidden="true" focusable="false" />}
        {done ? 'Reported – thank you' : 'Report this job'}
      </Button>
      {open && (
        <Dialog title="Report this job" onClose={() => setOpen(false)}>
          <ApiErrorAlert error={form.formError} title="The report was not sent" />
          <ErrorSummary errors={form.fieldErrors} fields={{ reason: { id: 'reason' } }} />
          <form onSubmit={handleSubmit} noValidate>
            <TextArea
              label="What is wrong with this posting?"
              id="reason"
              required
              maxLength={1000}
              hint="For example: misleading accommodations, discriminatory wording, or a scam."
              error={form.fieldErrors.reason}
              {...form.bind('reason')}
            />
            <div className="dialog__actions">
              <Button type="submit" className="button" disabled={form.submitting}>
                Send report
              </Button>
              <button type="button" className="button button--secondary" onClick={() => setOpen(false)}>
                Cancel
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}
