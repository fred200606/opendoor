import { Flag } from 'lucide-react';
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
import MatchBadge from '../../components/MatchBadge.jsx';
import Page from '../../components/Page.jsx';
import ReadAloud from '../../components/ReadAloud.jsx';
import SaveJobButton from '../../components/SaveJobButton.jsx';
import StatusBadge, { VerifiedBadge } from '../../components/StatusBadge.jsx';
import TrustScoreCard from '../../components/TrustScoreCard.jsx';
import { useApiForm } from '../../hooks/useApiForm.js';
import { useAsync } from '../../hooks/useAsync.js';
import { formatDate } from '../../lib/format.js';
import { EDUCATION_LEVELS, EMPLOYMENT_TYPES, INTERVIEW_FORMATS, WORK_SETUPS } from '../../lib/labels.js';

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

  const details = (
    <section key="details" className="card">
      <h2>Details</h2>
      <dl className="details-list">
        <dt>Category</dt>
        <dd>{job.category?.name}</dd>
        <dt>Employment</dt>
        <dd>{EMPLOYMENT_TYPES[job.employment_type]}</dd>
        <dt>Work setup</dt>
        <dd>{WORK_SETUPS[job.work_setup]}</dd>
        <dt>Interview</dt>
        <dd>{INTERVIEW_FORMATS[job.interview_format]}</dd>
        <dt>Address</dt>
        <dd>
          {job.address}
          {job.location?.label && `, ${job.location.label}`}
        </dd>
        <dt>Apply by</dt>
        <dd>{formatDate(job.closes_at)}</dd>
      </dl>
    </section>
  );
  const about = (
    <section key="about" className="card">
      <h2>About the job</h2>
      <div className="prose">{job.description}</div>
    </section>
  );
  const accommodations = <OfferedAccommodations key="accommodations" items={job.accommodations ?? []} />;
  const requirements = <Requirements key="requirements" job={job} />;

  return (
    <Page
      title={job.title}
      className="job-page"
      back={back}
      subtitle={
        <p className="job-employer">
          <Link to={`/employers/${job.employer?.id}`} state={{ back: { to: pathname, label: `Back to ${job.title}` } }}>
            {job.employer?.company_name}
          </Link> <VerifiedBadge verified={job.employer?.verified} />
          {job.status !== 'open' && <StatusBadge kind="posting" status={job.status} />}
        </p>
      }
      actions={<ReadAloud targetRef={readRef} title={[job.title, job.employer?.company_name].filter(Boolean).join('. ')} label="Read this job aloud" />}
    >
      <div ref={readRef} className="job-layout">
        <div className="job-layout__main">
          {isCandidate && <MatchBadge match={job.match} detailed />}
          {/* Job seekers see the accommodations first (Figma 5:1901); everyone else starts with the details. */}
          {isCandidate ? [accommodations, requirements, details, about] : [details, requirements, about, accommodations]}
          <AccessibilitySnapshot jobId={job.id} />
        </div>
        <div className="job-layout__side">
          {!isCandidate && trustScore}
          <JobActions job={job} />
          {isCandidate && trustScore}
        </div>
      </div>
    </Page>
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
    <section className="card">
      <h2>Skills and qualifications</h2>
      {skills.length === 0 ? (
        <p>The employer did not list any skills.</p>
      ) : (
        <ul className="tag-list" aria-label="Skills this job needs">
          {skills.map((skill) => (
            <li key={skill} className="tag">
              {skill}
            </li>
          ))}
        </ul>
      )}
      <dl className="details-list">
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

function OfferedAccommodations({ items }) {
  const notes = items.filter((item) => item.note);

  return (
    <section className="card">
      <h2>Accommodations offered</h2>
      {items.length === 0 ? (
        <p>The employer did not list any accommodations.</p>
      ) : (
        <>
          <ul className="tag-list">
            {items.map((item) => (
              <li key={item.id} className="tag">
                {item.name}
              </li>
            ))}
          </ul>
          {notes.length > 0 && (
            <ul className="job-notes">
              {notes.map((item) => (
                <li key={item.id}>
                  {item.name}: {item.note}
                </li>
              ))}
            </ul>
          )}
        </>
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
        <div ref={sentRef} tabIndex={-1} className="focus-target">
          <Alert type="success" live="polite" title="Application sent">
            <p>
              The employer will review it. You can follow its status in <Link to="/candidate/applications">My applications</Link>.
            </p>
          </Alert>
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
