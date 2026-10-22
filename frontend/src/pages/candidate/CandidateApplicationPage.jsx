import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getApplication, setApplicationStatus } from '../../api/applications.js';
import Alert, { ApiErrorAlert } from '../../components/Alert.jsx';
import AsyncContent from '../../components/AsyncContent.jsx';
import { ConfirmDialog } from '../../components/Dialog.jsx';
import Page from '../../components/Page.jsx';
import ReadAloud from '../../components/ReadAloud.jsx';
import HiringSection from '../../components/HiringSection.jsx';
import { ApplicationStatusBadge } from '../../components/StatusBadge.jsx';
import StatusTimeline from '../../components/StatusTimeline.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { formatDate, todayInManila } from '../../lib/format.js';

// Candidate status actions allowed by the workflow (business-rules.md); a hire is reported in HiringSection.
const ACTIONS = {
  withdrawn: {
    from: ['pending', 'reviewed', 'shortlisted', 'contacted'],
    label: 'Withdraw application',
    title: 'Withdraw this application?',
    text: 'The employer will no longer consider you for this job, and an open hiring report is cancelled. You cannot undo this.',
    danger: true,
  },
};

export default function CandidateApplicationPage() {
  const { id } = useParams();
  const state = useAsync(() => getApplication(id), [id]);

  return (
    <AsyncContent state={state} label="Loading the application" errorTitle="This application could not be loaded">
      {(application) => <ApplicationDetails application={application} onChange={state.setData} />}
    </AsyncContent>
  );
}

function ApplicationDetails({ application, onChange }) {
  const job = application.job_posting ?? {};
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const readRef = useRef(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const updated = await setApplicationStatus(application.id, pending);
      onChange(updated);
      setMessage('Your application was withdrawn.');
      setPending(null);
    } catch (apiError) {
      setError(apiError);
      setPending(null);
    } finally {
      setBusy(false);
    }
  }

  const available = Object.entries(ACTIONS).filter(([, action]) => action.from.includes(application.status));
  const action = pending && ACTIONS[pending];

  return (
    <Page
      title={job.title ?? 'Application'}
      className="application-page"
      back={{ to: '/candidate/applications', label: 'Back to my applications' }}
      subtitle={
        <p className="job-employer">
          <Link to={`/candidate/jobs/${job.id}`}>
            View the job{job.employer?.company_name && ` · ${job.employer.company_name}`}
          </Link>{' '}
          <ApplicationStatusBadge application={application} />
        </p>
      }
      actions={
        <ReadAloud
          targetRef={readRef}
          title={[job.title, job.employer?.company_name].filter(Boolean).join(', ')}
          label="Read this application aloud"
        />
      }
    >
      {message && <Alert type="success" live="polite" title={message} />}
      <ApiErrorAlert error={error} title="The status was not changed" />

      <div ref={readRef} className="application-page__body">
        {application.job_closed && (
          <Alert type="info" title="Job closed">
            <p>The employer closed this job. Your application stays at its stage, and a hire can still be reported.</p>
          </Alert>
        )}
        <StatusTimeline application={application} />

        <dl className="card details-list">
          <dt>Applied</dt>
          <dd>{formatDate(application.created_at)}</dd>
          {application.contacted_at && (
            <>
              <dt>Contacted</dt>
              <dd>{formatDate(application.contacted_at)}</dd>
            </>
          )}
          {application.hire_start_date && (
            <>
              <dt>Start date</dt>
              <dd>{formatDate(application.hire_start_date)}</dd>
            </>
          )}
          <dt>Cover note</dt>
          <dd className="prose">{application.cover_note || 'None'}</dd>
          <dt>Interview request</dt>
          <dd className="prose">{application.interview_request || 'None'}</dd>
        </dl>

        <HiringSection application={application} party="candidate" onChange={onChange} />
        {application.status === 'hired' && <FeedbackPrompt application={application} />}
      </div>

      {available.length > 0 && (
        <div className="actions application-page__actions">
          {available.map(([status, item]) => (
            <button key={status} type="button" className={`button ${item.danger ? 'button--danger-outline' : ''}`} onClick={() => setPending(status)}>
              {item.label}
            </button>
          ))}
        </div>
      )}
      {['pending', 'reviewed', 'shortlisted', 'contacted'].includes(application.status) && (
        <p className="field__hint">Once you and the employer confirm a hire, you can rate the accommodations 30 days after your start date.</p>
      )}

      {action && (
        <ConfirmDialog
          title={action.title}
          confirmLabel={action.label}
          danger={action.danger}
          busy={busy}
          onConfirm={confirm}
          onClose={() => setPending(null)}
        >
          <p>{action.text}</p>
        </ConfirmDialog>
      )}
    </Page>
  );
}

function FeedbackPrompt({ application }) {
  const opensOn = application.feedback_opens_on;
  const isOpen = opensOn && opensOn <= todayInManila();

  return (
    <section className={`card ${application.feedback_submitted ? '' : 'card--tint'}`.trim()} aria-labelledby="feedback-title">
      <h2 id="feedback-title">Rate your accommodations</h2>
      {application.feedback_submitted ? (
        <p>You have rated the accommodations for this job. Thank you – your answers are anonymous.</p>
      ) : isOpen ? (
        <>
          <p>Tell other job seekers whether the employer provided the accommodations it promised. Your answers are anonymous.</p>
          <Link className="button" to={`/candidate/applications/${application.id}/feedback`}>
            Rate accommodations
          </Link>
        </>
      ) : (
        <p>You can rate the accommodations from {formatDate(opensOn)} (30 days after your start date).</p>
      )}
    </section>
  );
}
