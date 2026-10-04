import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getApplication, setApplicationStatus } from '../../api/applications.js';
import Alert, { ApiErrorAlert } from '../../components/Alert.jsx';
import AsyncContent from '../../components/AsyncContent.jsx';
import { ConfirmDialog } from '../../components/Dialog.jsx';
import Page from '../../components/Page.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { formatDate } from '../../lib/format.js';

// Employer decisions allowed by the status workflow (pending → reviewed happens on opening).
const DECISIONS = {
  hired: {
    label: 'Mark as hired',
    title: 'Mark this applicant as hired?',
    text: 'This is final. After 30 days the employee can rate whether you provided the promised accommodations.',
  },
  rejected: {
    label: 'Not selected',
    title: 'Mark this application as not selected?',
    text: 'This is final. The applicant is notified.',
    danger: true,
  },
};

export default function EmployerApplicationPage() {
  const { id } = useParams();
  const state = useAsync(() => getApplication(id), [id]);

  return (
    <AsyncContent state={state} label="Loading the application" errorTitle="This application could not be loaded">
      {(application) => <ApplicationReview application={application} onChange={state.setData} />}
    </AsyncContent>
  );
}

function ApplicationReview({ application, onChange }) {
  const job = application.job_posting ?? {};
  const candidate = application.candidate ?? {};
  const offered = new Set((job.accommodations ?? []).map((item) => item.id));
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');

  async function decide() {
    setBusy(true);
    setError(null);
    try {
      onChange(await setApplicationStatus(application.id, pending));
      setMessage(pending === 'hired' ? 'The applicant is marked as hired.' : 'The applicant is marked as not selected.');
    } catch (apiError) {
      setError(apiError);
    } finally {
      setPending(null);
      setBusy(false);
    }
  }

  const decision = pending && DECISIONS[pending];

  return (
    <Page title={candidate.name ?? 'Applicant'}>
      <p>
        Applied for <Link to={`/employer/jobs/${job.id}/applicants`}>{job.title}</Link> on {formatDate(application.created_at)}
      </p>
      <p>
        Status: <StatusBadge kind="application" status={application.status} />
      </p>
      {message && (
        <Alert type="success" live="polite">
          <p>{message}</p>
        </Alert>
      )}
      <ApiErrorAlert error={error} title="The status was not changed" />

      {candidate.headline && <p className="lead">{candidate.headline}</p>}

      {application.interview_request && (
        <Alert type="warning" title="Interview accommodation requested">
          <p className="prose">{application.interview_request}</p>
        </Alert>
      )}

      <h2>Accommodations this applicant needs</h2>
      {(candidate.accommodations ?? []).length === 0 ? (
        <p>The applicant has not listed any accommodation needs.</p>
      ) : (
        <ul className="needs-list">
          {candidate.accommodations.map((item) => (
            <li key={item.id}>
              {item.name} –{' '}
              {offered.has(item.id) ? (
                <span className="needs-list__ok">
                  <span aria-hidden="true">✓ </span>offered in your posting
                </span>
              ) : (
                <span className="needs-list__missing">
                  <span aria-hidden="true">! </span>not listed in your posting
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <h2>Cover note</h2>
      <p className="prose">{application.cover_note || 'The applicant did not write a cover note.'}</p>

      {application.status === 'reviewed' && (
        <div className="actions">
          {Object.entries(DECISIONS).map(([status, item]) => (
            <button key={status} type="button" className={`button ${item.danger ? 'button--secondary' : ''}`} onClick={() => setPending(status)}>
              {item.label}
            </button>
          ))}
        </div>
      )}

      {decision && (
        <ConfirmDialog title={decision.title} confirmLabel={decision.label} danger={decision.danger} busy={busy} onConfirm={decide} onClose={() => setPending(null)}>
          <p>{decision.text}</p>
        </ConfirmDialog>
      )}
    </Page>
  );
}
