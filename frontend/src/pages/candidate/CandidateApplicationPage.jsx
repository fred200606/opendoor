import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getApplication, setApplicationStatus } from '../../api/applications.js';
import Alert, { ApiErrorAlert } from '../../components/Alert.jsx';
import AsyncContent from '../../components/AsyncContent.jsx';
import { ConfirmDialog } from '../../components/Dialog.jsx';
import Page from '../../components/Page.jsx';
import ReadAloud from '../../components/ReadAloud.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { formatDate, todayInManila } from '../../lib/format.js';

// Candidate actions allowed by the status workflow (business-rules.md).
const ACTIONS = {
  withdrawn: {
    from: ['pending', 'reviewed'],
    label: 'Withdraw application',
    title: 'Withdraw this application?',
    text: 'The employer will no longer consider you for this job. You cannot undo this.',
    danger: true,
  },
  hired: {
    from: ['reviewed'],
    label: 'I was hired',
    title: 'Confirm that you were hired?',
    text: '30 days after today you will be asked to rate whether the promised accommodations were provided.',
    danger: false,
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
      setMessage(pending === 'hired' ? 'Congratulations! Your hire is recorded.' : 'Your application was withdrawn.');
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
    <Page title={job.title ?? 'Application'}>
      <ReadAloud
        targetRef={readRef}
        title={[job.title, job.employer?.company_name].filter(Boolean).join(', ')}
        label="Read this application aloud"
      />
      <p>
        <Link to={`/candidate/jobs/${job.id}`}>View the job</Link> · {job.employer?.company_name}
      </p>
      <div ref={readRef}>
        <p>
          Status: <StatusBadge kind="application" status={application.status} />
        </p>
        {message && (
          <Alert type="success" live="polite">
            <p>{message}</p>
          </Alert>
        )}
        <ApiErrorAlert error={error} title="The status was not changed" />

        <dl className="details-list">
          <dt>Applied</dt>
          <dd>{formatDate(application.created_at)}</dd>
          {application.hired_at && (
            <>
              <dt>Hired</dt>
              <dd>{formatDate(application.hired_at)}</dd>
            </>
          )}
          <dt>Cover note</dt>
          <dd className="prose">{application.cover_note || 'None'}</dd>
          <dt>Interview request</dt>
          <dd className="prose">{application.interview_request || 'None'}</dd>
        </dl>

        {application.status === 'hired' && <FeedbackPrompt application={application} />}
      </div>

      {available.length > 0 && (
        <div className="actions">
          {available.map(([status, item]) => (
            <button key={status} type="button" className={`button ${item.danger ? 'button--secondary' : ''}`} onClick={() => setPending(status)}>
              {item.label}
            </button>
          ))}
        </div>
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
    <section className="card" aria-labelledby="feedback-title">
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
        <p>You can rate the accommodations from {formatDate(opensOn)} (30 days after your hire date).</p>
      )}
    </section>
  );
}
