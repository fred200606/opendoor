import { Accessibility, Banknote, Briefcase, Building2, Calendar, Check, Clock, Flag, Laptop, MapPin, MessageSquare, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { applyToJob } from '../../api/applications.js';
import { getJob, reportPosting } from '../../api/jobs.js';
import { getCandidateProfile, RESUME_MAX_MB, uploadResume } from '../../api/profile.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import AccessibilitySnapshot from '../../components/AccessibilitySnapshot.jsx';
import Alert, { ApiErrorAlert } from '../../components/Alert.jsx';
import AsyncContent from '../../components/AsyncContent.jsx';
import Button from '../../components/Button.jsx';
import Dialog from '../../components/Dialog.jsx';
import ErrorSummary from '../../components/form/ErrorSummary.jsx';
import { TextArea, TextField } from '../../components/form/fields.jsx';
import MatchDetails from '../../components/MatchDetails.jsx';
import Page from '../../components/Page.jsx';
import ReadAloud from '../../components/ReadAloud.jsx';
import SaveJobButton from '../../components/SaveJobButton.jsx';
import StatusBadge, { VerifiedBadge } from '../../components/StatusBadge.jsx';
import TrustScoreCard from '../../components/TrustScoreCard.jsx';
import { useApiForm } from '../../hooks/useApiForm.js';
import { useAsync } from '../../hooks/useAsync.js';
import { companyInitials, formatDate } from '../../lib/format.js';
import { cityOf, lines, salaryText, yearsText } from '../../lib/jobs.js';
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
  RESUME_REQUIRED: 'Add your résumé (PDF) to apply. We save it to your profile.',
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
  const { state, pathname, hash } = useLocation();
  const isCandidate = user?.role === 'candidate';
  const readRef = useRef(null);
  const back = isBackLink(state?.back) ? state.back : { to: isCandidate ? '/candidate/jobs' : '/jobs', label: 'Back to job results' };
  const hasMatch = isCandidate && job.match?.score !== null && job.match?.score !== undefined;
  const canApply = !user || isCandidate;

  // A card's "View accommodations", "+N more" or "See the full match" opens the job at that part:
  // scroll to it and start reading there (this runs after Page has focused the heading).
  useEffect(() => {
    const target = hash && document.getElementById(hash.slice(1));
    if (!target) return;
    target.scrollIntoView?.({ block: 'start' });
    target.focus({ preventScroll: true });
  }, [hash]);

  const contents = [
    ['overview', 'Job overview'],
    hasMatch && ['match', 'How this job fits you'],
    ['responsibilities', 'Responsibilities'],
    ['skills', 'Required skills'],
    ['qualifications', 'Qualifications'],
    ['salary', 'Salary and benefits'],
    ['location', 'Location, schedule and work setup'],
    ['accommodations', 'Workplace accommodations'],
    ['employer', 'About the employer'],
    ['requirements', 'Application requirements'],
    canApply && ['apply', 'Apply'],
  ].filter(Boolean);

  return (
    <Page
      title={job.title}
      back={back}
      actions={<ReadAloud targetRef={readRef} title={[job.title, job.employer?.company_name].filter(Boolean).join('. ')} label="Read this job aloud" />}
    >
      <div ref={readRef} className="od mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid min-w-0 gap-6">
          <nav aria-label="On this page" className={`${CARD} py-4 sm:py-4`} data-read-aloud="skip">
            <h2 className="font-bold">On this page</h2>
            <ul className="mt-1 flex flex-wrap gap-x-5 gap-y-0">
              {contents.map(([id, label]) => (
                <li key={id}>
                  <a href={`#${id}`} className="inline-flex min-h-11 items-center text-primary underline underline-offset-4 hover:no-underline">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <Overview job={job} />
          {hasMatch && (
            <div id="match" tabIndex={-1} className="scroll-mt-4 outline-none">
              <MatchDetails job={job} />
            </div>
          )}
          <Responsibilities job={job} />
          <Skills job={job} />
          <Qualifications job={job} />
          <SalaryAndBenefits job={job} />
          <Workplace job={job} />
          <OfferedAccommodations items={job.accommodations ?? []} />
          <AccessibilitySnapshot jobId={job.id} />
          <AboutEmployer job={job} backTo={{ to: pathname, label: `Back to ${job.title}` }} />
          <ApplicationRequirements job={job} />
        </div>
        <div className="grid gap-6 lg:sticky lg:top-4">
          <JobActions job={job} />
        </div>
      </div>
    </Page>
  );
}

/** A titled card that a link can open at (`#id`): it takes focus, so reading starts there. */
function Section({ id, title, className = '', children }) {
  return (
    <section id={id} tabIndex={-1} aria-labelledby={`${id}-title`} className={`${CARD} scroll-mt-4 focus-visible:outline-3 focus-visible:outline-focus ${className}`}>
      <h2 id={`${id}-title`} className={CARD_TITLE}>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Label + value pairs with an icon each. */
function Facts({ items }) {
  return (
    <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
      {items.map((fact) => (
        <div key={fact.label} className="grid grid-cols-[1.25rem_1fr] content-start gap-x-2">
          <fact.icon className="mt-0.5 size-5 text-accent" aria-hidden="true" focusable="false" />
          <dt className="font-bold">{fact.label}</dt>
          <dd className="col-start-2">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A list of the employer's lines, or a sentence when there are none. */
function Lines({ text, label, empty }) {
  const items = lines(text);
  if (items.length === 0) return <p className="mt-3 text-muted">{empty}</p>;
  return (
    <ul className="mt-3 grid list-disc gap-1.5 pl-6" aria-label={label}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/** The employer, the salary and the key facts at a glance, then the employer's overview text. */
function Overview({ job }) {
  return (
    <Section id="overview" title="Job overview">
      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span aria-hidden="true" className="grid size-10 place-items-center rounded-md border border-border bg-primary-soft font-display font-semibold text-accent">
          {companyInitials(job.employer?.company_name)}
        </span>
        <span className="font-display text-lg font-semibold">{job.employer?.company_name}</span>
        <VerifiedBadge verified={job.employer?.verified} />
        {job.status !== 'open' && <StatusBadge kind="posting" status={job.status} />}
      </p>
      <Facts
        items={[
          { icon: Banknote, label: 'Salary', value: salaryText(job.salary) },
          { icon: MapPin, label: 'Location', value: cityOf(job) },
          { icon: Building2, label: 'Work setup', value: WORK_SETUPS[job.work_setup] },
          { icon: Clock, label: 'Employment type', value: EMPLOYMENT_TYPES[job.employment_type] },
          { icon: Calendar, label: 'Apply by', value: formatDate(job.closes_at) },
          { icon: Briefcase, label: 'Category', value: job.category?.name },
        ]}
      />
      <h3 className="mt-5 font-bold">About the job</h3>
      <div className="mt-1 whitespace-pre-line">{job.description}</div>
    </Section>
  );
}

function Responsibilities({ job }) {
  return (
    <Section id="responsibilities" title="Responsibilities">
      <Lines text={job.responsibilities} label="Main responsibilities" empty="The employer did not list the responsibilities separately. See the job overview." />
    </Section>
  );
}

/** Every required skill; a candidate's matched ones are ticked. */
function Skills({ job }) {
  const skills = job.skills ?? [];
  const have = new Set(job.match?.skills?.matched ?? []);
  return (
    <Section id="skills" title="Required skills">
      {skills.length === 0 ? (
        <p className="mt-3">The employer did not list any skills.</p>
      ) : (
        <>
          {job.match?.skills && <p className="mt-2 text-muted">Ticked skills are in your profile.</p>}
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Skills this job needs">
            {skills.map((skill) => (
              <li key={skill} className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 ${have.has(skill) ? 'border-success bg-success-soft' : 'border-border bg-subtle'}`}>
                {have.has(skill) && <Check className="size-4 text-success" aria-hidden="true" focusable="false" />}
                {skill}
                {have.has(skill) && <span className="sr-only"> (in your profile)</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}

/** Minimum education and experience and the employer's other requirements (decision 2026-10-21). */
function Qualifications({ job }) {
  const years = job.experience_years;
  return (
    <Section id="qualifications" title="Qualifications">
      <dl className="details-list mt-4 mb-0">
        <dt>Minimum education</dt>
        <dd>{EDUCATION_LEVELS[job.education_level] ?? 'No minimum'}</dd>
        <dt>Minimum experience</dt>
        <dd>{years ? yearsText(years) : 'None needed'}</dd>
        {job.qualifications && (
          <>
            <dt>Other qualifications</dt>
            <dd className="prose whitespace-pre-line">{job.qualifications}</dd>
          </>
        )}
      </dl>
    </Section>
  );
}

function SalaryAndBenefits({ job }) {
  return (
    <Section id="salary" title="Salary and benefits">
      <p className={`mt-3 font-display text-xl font-bold ${job.salary ? '' : 'text-muted'}`}>{salaryText(job.salary)}</p>
      {!job.salary && <p className="mt-1 text-muted">You can ask about the salary when the employer contacts you.</p>}
      <h3 className="mt-4 font-bold">Benefits</h3>
      <Lines text={job.benefits} label="Benefits" empty="The employer did not list any benefits." />
    </Section>
  );
}

/** Where and when the work happens: the full address (cards show only the city). */
function Workplace({ job }) {
  return (
    <Section id="location" title="Location, schedule and work setup">
      <Facts
        items={[
          { icon: MapPin, label: 'Workplace address', value: [job.address, job.location?.label].filter(Boolean).join(', ') },
          { icon: Building2, label: 'Work setup', value: WORK_SETUPS[job.work_setup] },
          { icon: Clock, label: 'Employment type', value: EMPLOYMENT_TYPES[job.employment_type] },
          { icon: Calendar, label: 'Schedule', value: job.schedule || 'Not given' },
        ]}
      />
    </Section>
  );
}

/** The accommodations by group, each with a tick and the employer's note (IPT: a violet left edge). */
function OfferedAccommodations({ items }) {
  const groups = Object.keys(ACCOMMODATION_GROUPS)
    .map((group) => ({ group, items: items.filter((item) => item.group === group) }))
    .filter((entry) => entry.items.length > 0);
  const ungrouped = items.filter((item) => !ACCOMMODATION_GROUPS[item.group]);

  return (
    <Section id="accommodations" title="Workplace accommodations" className="border-l-4 border-l-primary">
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
    </Section>
  );
}

/** The employer's verification and trust score, with a link to its page and other jobs. */
function AboutEmployer({ job, backTo }) {
  const verified = job.employer?.verified;
  return (
    <Section id="employer" title="About the employer">
      <p className="mt-3">
        <Link to={`/employers/${job.employer?.id}`} state={{ back: backTo }} className="font-display text-lg font-semibold text-primary underline underline-offset-4 hover:no-underline">
          {job.employer?.company_name}
        </Link>
      </p>
      <p className="mt-1 text-muted">
        {verified ? 'OpenDoor checked this company against the business registry.' : 'OpenDoor has not verified this company yet.'} Its page shows what it does and its other open jobs.
      </p>
      <div className="mt-4">
        <TrustScoreCard trustScore={job.trust_score} headingLevel={3} explain />
      </div>
    </Section>
  );
}

/** What applying takes: OpenDoor's own requirements, the employer's, the interview and the deadline. */
function ApplicationRequirements({ job }) {
  const extra = lines(job.application_requirements);
  return (
    <Section id="requirements" title="Application requirements">
      <ul className="mt-3 grid list-disc gap-1.5 pl-6">
        <li>Your résumé (PDF). You can add it when you apply.</li>
        <li>A complete OpenDoor profile: where you live, at least 3 skills, your education and your work preferences.</li>
        {extra.map((item) => (
          <li key={item}>{item}</li>
        ))}
        <li>
          {INTERVIEW_FORMATS[job.interview_format] ?? 'Interview'}. You can ask for interview accommodations in your application.
        </li>
        <li>Apply by {formatDate(job.closes_at)}.</li>
      </ul>
    </Section>
  );
}

/** A back link handed over by the page that linked here (search, saved jobs, employer page). */
function isBackLink(back) {
  return typeof back?.to === 'string' && back.to.startsWith('/') && typeof back.label === 'string';
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
      <section id="apply" tabIndex={-1} className="card job-actions scroll-mt-4" aria-labelledby="apply-title" data-read-aloud="skip">
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
      <section id="apply" tabIndex={-1} className="card job-actions scroll-mt-4" aria-labelledby="apply-title">
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

/**
 * Applying needs a résumé (Decision 2026-10-22b): without one on the profile the form asks for a
 * PDF, uploads it to the profile first and then sends the application.
 */
function ApplyForm({ job, onApplied }) {
  const form = useApiForm({ coverNote: '', interviewRequest: '' });
  const profile = useAsync(() => getCandidateProfile().catch((error) => (error.status === 404 ? null : Promise.reject(error))), []);
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const needsResume = !profile.loading && !profile.data?.resume_url;
  const knownError = form.formError && APPLY_ERRORS[form.formError.code];

  function chooseResume(event) {
    const chosen = event.target.files?.[0] ?? null;
    setFileError(null);
    if (chosen && chosen.type !== 'application/pdf') setFileError('Choose a PDF file.');
    else if (chosen && chosen.size > RESUME_MAX_MB * 1024 * 1024) setFileError(`The file is larger than ${RESUME_MAX_MB} MB.`);
    setFile(chosen);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (needsResume && (!file || fileError)) {
      if (!file) setFileError('Choose your résumé (PDF) to apply.');
      document.getElementById('apply_resume')?.focus();
      return;
    }
    const result = await form.submit(async (values) => {
      if (needsResume) {
        const { resume_url: resumeUrl } = await uploadResume(file);
        profile.setData({ ...profile.data, resume_url: resumeUrl });
      }
      return applyToJob(job.id, values);
    });
    if (result) onApplied(result);
  }

  return (
    <>
      <ErrorSummary
        errors={form.fieldErrors}
        fields={{ resume: { id: 'apply_resume' }, cover_note: { id: 'cover_note' }, interview_request: { id: 'interview_request' } }}
      />
      {knownError ? (
        <Alert type="error" live="assertive">
          <p>{knownError}</p>
        </Alert>
      ) : (
        <ApiErrorAlert error={form.formError} title="Your application was not sent" />
      )}
      <form onSubmit={handleSubmit} noValidate>
        {needsResume && (
          <TextField
            label="Your résumé"
            id="apply_resume"
            name="resume"
            type="file"
            accept="application/pdf"
            required
            hint={`Employers need it to consider you. PDF only, up to ${RESUME_MAX_MB} MB. We also save it to your profile.`}
            error={fileError ?? form.fieldErrors.resume}
            onChange={chooseResume}
          />
        )}
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
