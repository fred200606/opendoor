import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { applyToJob } from '../../api/applications.js';
import { getJob, reportPosting, saveJob, unsaveJob } from '../../api/jobs.js';
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
import StatusBadge, { VerifiedBadge } from '../../components/StatusBadge.jsx';
import TrustScoreCard from '../../components/TrustScoreCard.jsx';
import { useApiForm } from '../../hooks/useApiForm.js';
import { useAsync } from '../../hooks/useAsync.js';
import { formatDate } from '../../lib/format.js';
import { ACCOMMODATION_GROUPS, EMPLOYMENT_TYPES, INTERVIEW_FORMATS, WORK_SETUPS } from '../../lib/labels.js';

const APPLY_ERRORS = {
  ALREADY_APPLIED: 'You have already applied to this job. You can follow it in My applications.',
  POSTING_CLOSED: 'This job is no longer accepting applications.',
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
  const isCandidate = user?.role === 'candidate';
  const accommodationsByGroup = Object.groupBy(job.accommodations ?? [], (item) => item.group);

  return (
    <Page title={job.title}>
      <p className="job-employer">
        <Link to={`/employers/${job.employer?.id}`}>{job.employer?.company_name}</Link> <VerifiedBadge verified={job.employer?.verified} />
      </p>
      {job.status !== 'open' && (
        <p>
          <StatusBadge kind="posting" status={job.status} />
        </p>
      )}

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

      {isCandidate && <MatchBadge match={job.match} detailed />}

      <h2>About the job</h2>
      <div className="prose">{job.description}</div>

      <h2>Accommodations offered</h2>
      {(job.accommodations ?? []).length === 0 ? (
        <p>The employer did not list any accommodations.</p>
      ) : (
        Object.entries(accommodationsByGroup).map(([group, items]) => (
          <div key={group}>
            <h3 className="snapshot__group">{ACCOMMODATION_GROUPS[group] ?? group}</h3>
            <ul>
              {items.map((item) => (
                <li key={item.id}>
                  {item.name}
                  {item.note && <span className="field__hint"> – {item.note}</span>}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}

      <TrustScoreCard trustScore={job.trust_score} />

      <JobActions job={job} />

      <AccessibilitySnapshot jobId={job.id} />
    </Page>
  );
}

function JobActions({ job }) {
  const { user } = useAuth();

  if (!user) {
    return (
      <section className="card" aria-labelledby="apply-title">
        <h2 id="apply-title">Interested?</h2>
        <p>
          <Link to="/login" state={{ from: { pathname: `/candidate/jobs/${job.id}` } }} className="button">
            Log in to apply
          </Link>{' '}
          or <Link to="/register">create an account</Link>.
        </p>
      </section>
    );
  }
  if (user.role !== 'candidate') return null;

  const mine = job.my_application;

  return (
    <section className="card" aria-labelledby="apply-title">
      <h2 id="apply-title">{mine ? 'Your application' : 'Apply for this job'}</h2>
      {mine ? (
        <p>
          You applied on {formatDate(mine.created_at)}. Status: <StatusBadge kind="application" status={mine.status} />{' '}
          <Link to={`/candidate/applications/${mine.id}`}>View your application</Link>
        </p>
      ) : job.status === 'open' ? (
        <ApplyForm job={job} />
      ) : (
        <p>This job is no longer accepting applications.</p>
      )}
      <div className="actions">
        <SaveButton jobId={job.id} />
        <ReportButton jobId={job.id} />
      </div>
    </section>
  );
}

function ApplyForm({ job }) {
  const form = useApiForm({ coverNote: '', interviewRequest: '' });
  const [applied, setApplied] = useState(null);
  const knownError = form.formError && APPLY_ERRORS[form.formError.code];

  async function handleSubmit(event) {
    event.preventDefault();
    const result = await form.submit((values) => applyToJob(job.id, values));
    if (result) setApplied(result);
  }

  if (applied) {
    return (
      <Alert type="success" live="polite" title="Application sent">
        <p>
          The employer will review it. You can follow its status in <Link to="/candidate/applications">My applications</Link>.
        </p>
      </Alert>
    );
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
          id="cover_note"
          hint="Optional. Tell the employer why you are a good fit."
          maxLength={2000}
          error={form.fieldErrors.cover_note}
          {...form.bind('coverNote')}
        />
        <TextArea
          label="Interview accommodation request"
          id="interview_request"
          hint={`Optional. This job uses an ${job.interview_format === 'online' ? 'online' : 'on-site'} interview. For example: sign language interpreter, extra time, captions.`}
          maxLength={1000}
          error={form.fieldErrors.interview_request}
          {...form.bind('interviewRequest')}
        />
        <Button type="submit" className="button" disabled={form.submitting}>
          {form.submitting ? 'Sending…' : 'Send application'}
        </Button>
      </form>
    </>
  );
}

function SaveButton({ jobId }) {
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function toggle() {
    setBusy(true);
    try {
      if (saved) await unsaveJob(jobId);
      else await saveJob(jobId);
      setSaved(!saved);
      setMessage(saved ? 'Removed from saved jobs.' : 'Saved. Find it under Saved jobs.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button type="button" className="button button--secondary" aria-pressed={saved} disabled={busy} onClick={toggle}>
        {saved ? 'Saved' : 'Save job'}
      </Button>
      <p className="visually-hidden" role="status">
        {message}
      </p>
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
      <Button type="button" className="button button--link" onClick={() => setOpen(true)} disabled={done}>
        {done ? 'Reported – thank you' : 'Report this job'}
      </Button>
      {open && (
        <Dialog title="Report this job" onClose={() => setOpen(false)}>
          <ApiErrorAlert error={form.formError} title="The report was not sent" />
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
