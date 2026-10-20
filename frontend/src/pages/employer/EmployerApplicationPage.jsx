import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getApplication, setApplicationStatus } from '../../api/applications.js';
import Alert, { ApiErrorAlert } from '../../components/Alert.jsx';
import AsyncContent from '../../components/AsyncContent.jsx';
import { ConfirmDialog } from '../../components/Dialog.jsx';
import Page from '../../components/Page.jsx';
import StatusBadge, { BadgeIcon } from '../../components/StatusBadge.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { formatDate } from '../../lib/format.js';
import { EDUCATION_LEVELS } from '../../lib/labels.js';

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
    <Page
      title={candidate.name ?? 'Applicant'}
      back={{ to: `/employer/jobs/${job.id}/applicants`, label: 'Back to applicants' }}
      subtitle={
        <p className="applicant-line">
          <StatusBadge kind="application" status={application.status} />
          <span>
            Applied for <Link to={`/employer/jobs/${job.id}/applicants`}>{job.title}</Link> on {formatDate(application.created_at)}
            {candidate.headline && ` · ${candidate.headline}`}
          </span>
        </p>
      }
    >
      <div className="application-page__body">
        {message && <Alert type="success" live="polite" title={message} />}
        <ApiErrorAlert error={error} title="The status was not changed" />

        {application.interview_request && (
          <Alert type="warning" title="Interview accommodation requested">
            <p className="prose">{application.interview_request}</p>
          </Alert>
        )}

        <section className="card" aria-labelledby="needs-title">
          <h2 id="needs-title">Accommodations this applicant needs</h2>
          {(candidate.accommodations ?? []).length === 0 ? (
            <p>The applicant has not listed any accommodation needs.</p>
          ) : (
            <ul className="needs-badges">
              {candidate.accommodations.map((item) => {
                const ok = offered.has(item.id);
                return (
                  <li key={item.id}>
                    <span className={`badge badge--${ok ? 'success' : 'warning'}`}>
                      <BadgeIcon tone={ok ? 'success' : 'warning'} />
                      {item.name} · {ok ? 'offered in your posting' : 'not listed in your posting'}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card" aria-labelledby="cover-title">
          <h2 id="cover-title">Cover note</h2>
          <p className="prose">{application.cover_note || 'The applicant did not write a cover note.'}</p>
        </section>

        <section className="card" aria-labelledby="about-title">
          <h2 id="about-title">About the applicant</h2>
          <dl className="details-list">
            <dt>Skills</dt>
            <dd>{(candidate.skills ?? []).length > 0 ? candidate.skills.join(', ') : 'Not listed'}</dd>
            <dt>Highest education</dt>
            <dd>{EDUCATION_LEVELS[candidate.education_level] ?? 'Not listed'}</dd>
            <dt>Years of experience</dt>
            <dd>{candidate.experience_years ?? 'Not listed'}</dd>
            <dt>Work experience</dt>
            <dd className="prose">{candidate.experience || 'Not listed'}</dd>
            {candidate.disability_type && (
              <>
                <dt>Disability (shared by the applicant)</dt>
                <dd>{candidate.disability_type}</dd>
              </>
            )}
            <dt>Résumé</dt>
            <dd>
              {candidate.resume_url ? (
                <a href={candidate.resume_url} target="_blank" rel="noreferrer">
                  Open the résumé (PDF, opens in a new tab)
                </a>
              ) : (
                'No résumé uploaded'
              )}
            </dd>
          </dl>
        </section>
      </div>

      {application.status === 'reviewed' && (
        <>
          <div className="actions application-page__actions">
            {Object.entries(DECISIONS).map(([status, item]) => (
              <button key={status} type="button" className={`button ${item.danger ? 'button--danger-outline' : ''}`} onClick={() => setPending(status)}>
                {item.label}
              </button>
            ))}
          </div>
          <p className="field__hint">“Mark as hired” and “Not selected” are final and ask you to confirm. The applicant is notified.</p>
        </>
      )}

      {decision && (
        <ConfirmDialog title={decision.title} confirmLabel={decision.label} danger={decision.danger} busy={busy} onConfirm={decide} onClose={() => setPending(null)}>
          <p>{decision.text}</p>
        </ConfirmDialog>
      )}
    </Page>
  );
}
