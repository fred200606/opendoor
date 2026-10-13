import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { adminGetEmployer, adminVerifyEmployer } from '../../api/admin.js';
import ActionFeedback from '../../components/ActionFeedback.jsx';
import Alert from '../../components/Alert.jsx';
import AsyncContent from '../../components/AsyncContent.jsx';
import Button from '../../components/Button.jsx';
import { ConfirmDialog, ReasonDialog } from '../../components/Dialog.jsx';
import Page from '../../components/Page.jsx';
import StatusBadge, { BadgeIcon, VerifiedBadge } from '../../components/StatusBadge.jsx';
import { useAction } from '../../hooks/useAction.js';
import { useAsync } from '../../hooks/useAsync.js';
import { formatDate, formatDateTime } from '../../lib/format.js';
import { REGISTRY_TYPES } from '../../lib/labels.js';

const NAME_MATCH_THRESHOLD = 0.8;

const REGISTRY_ERRORS = {
  REGISTRY_UNAVAILABLE: 'The business registry did not respond. You can try again later or decide manually.',
  REGISTRY_AUTH_FAILED: 'OpenDoor could not sign in to the business registry. Ask the system administrator to check the registry credentials.',
  REGISTRY_INVALID_REQUEST: 'The registry rejected the registration details. Check the registration number and type with the employer.',
};

/** Admin employer verification: SOAP registry check (never auto-approves) + approve / reject. */
export default function AdminEmployerPage() {
  const { id } = useParams();
  const state = useAsync(() => adminGetEmployer(id), [id]);

  return (
    <AsyncContent state={state} label="Loading the employer" errorTitle="This employer could not be loaded">
      {(employer) => <EmployerReview employer={employer} onChange={state.setData} />}
    </AsyncContent>
  );
}

function RegistryResult({ result, companyName }) {
  const weakName = result.name_match !== null && result.name_match !== undefined && result.name_match < NAME_MATCH_THRESHOLD;
  const problem = result.status !== 'ACTIVE' || weakName;

  return (
    <section className="card" aria-labelledby="registry-title">
      <h2 id="registry-title">Business registry result</h2>
      {problem && (
        <Alert type="warning" title="Check this carefully before approving">
          {result.status !== 'ACTIVE' && <p>The registration is not active ({result.status.toLowerCase().replace('_', ' ')}).</p>}
          {weakName && (
            <p>
              The registered name matches “{companyName}” only {Math.round(result.name_match * 100)}% (below{' '}
              {NAME_MATCH_THRESHOLD * 100}%).
            </p>
          )}
        </Alert>
      )}
      <p className="registry-status">
        <StatusBadge kind="registry" status={result.status} />
      </p>
      <dl className="details-list">
        <dt>Registered name</dt>
        <dd>{result.registered_name ?? 'Not found'}</dd>
        <dt>Name match</dt>
        <dd>{result.name_match === null || result.name_match === undefined ? '–' : `${Math.round(result.name_match * 100)}%`}</dd>
        <dt>Checked</dt>
        <dd>{formatDateTime(result.checked_at)}</dd>
      </dl>
    </section>
  );
}

function EmployerReview({ employer, onChange }) {
  const action = useAction();
  const [dialog, setDialog] = useState(null);
  const [registry, setRegistry] = useState(employer.latest_registry_check ?? null);

  async function check() {
    const result = await action.run(() => adminVerifyEmployer(employer.id, 'check'), 'The registry check is done.');
    if (result?.registry) setRegistry(result.registry);
  }

  async function approve() {
    const result = await action.run(() => adminVerifyEmployer(employer.id, 'approve'), `${employer.company_name} is now verified.`);
    setDialog(null);
    if (result) onChange({ ...employer, verified: true, verified_at: result.verified_at, verification_rejected_reason: null });
  }

  async function reject(reason) {
    const result = await action.run(() => adminVerifyEmployer(employer.id, 'reject', reason), `${employer.company_name} was not approved. The employer can see your reason.`);
    setDialog(null);
    if (result) onChange({ ...employer, verified: false, verified_at: null, verification_rejected_reason: reason });
  }

  const status = employer.verified_at ? (
    <VerifiedBadge verified />
  ) : employer.verification_rejected_reason ? (
    <>
      <span className="badge badge--danger">
        <BadgeIcon tone="danger" />
        Not approved
      </span>{' '}
      <span>{employer.verification_rejected_reason}</span>
    </>
  ) : (
    <span className="badge badge--warning">
      <BadgeIcon tone="warning" />
      Waiting for verification
    </span>
  );

  return (
    <Page
      title={employer.company_name}
      documentTitle={`${employer.company_name} – Employer verification`}
      back={{ to: '/admin/employers', label: 'Back to employers' }}
      subtitle={<p className="applicant-line">{status}</p>}
    >
      <ActionFeedback action={action} errorTitle="That did not work" errorMessages={REGISTRY_ERRORS} />

      <div className="review-layout">
        <section className="card" aria-labelledby="company-title">
          <h2 id="company-title">Company</h2>
          <dl className="details-list">
            <dt>Registered with</dt>
            <dd>{REGISTRY_TYPES[employer.registry_type] ?? employer.registry_type}</dd>
            <dt>Number</dt>
            <dd>{employer.business_reg_no}</dd>
            <dt>Industry</dt>
            <dd>{employer.industry}</dd>
            <dt>Address</dt>
            <dd>
              {employer.address}
              {employer.location?.label && `, ${employer.location.label}`}
            </dd>
            <dt>Account</dt>
            <dd>
              {employer.owner?.name} ({employer.owner?.email})
            </dd>
            {employer.verified_at && (
              <>
                <dt>Verified on</dt>
                <dd>{formatDate(employer.verified_at)}</dd>
              </>
            )}
          </dl>
        </section>

        <div className="review-layout__side">
          {registry ? (
            <RegistryResult result={registry} companyName={employer.company_name} />
          ) : (
            <section className="card" aria-labelledby="registry-title">
              <h2 id="registry-title">Business registry result</h2>
              <p>This employer has not been checked against the business registry yet.</p>
            </section>
          )}
          <p>
            <Button type="button" className="button button--secondary" disabled={action.busy} onClick={check}>
              {action.busy ? 'Checking…' : registry ? 'Check with the business registry again' : 'Check with the business registry'}
            </Button>
          </p>
          <Alert type="info" title="You decide">
            <p>The registry result is advice only. Approving lets this company post jobs.</p>
          </Alert>
          <div className="actions">
            {!employer.verified_at && (
              <Button type="button" className="button" disabled={action.busy} onClick={() => setDialog('approve')}>
                Approve
              </Button>
            )}
            <Button type="button" className="button button--danger-outline" disabled={action.busy} onClick={() => setDialog('reject')}>
              {employer.verified_at ? 'Remove verification' : 'Do not approve'}
            </Button>
          </div>
        </div>
      </div>

      {dialog === 'approve' && (
        <ConfirmDialog title={`Approve ${employer.company_name}?`} confirmLabel="Approve" busy={action.busy} onConfirm={approve} onClose={() => setDialog(null)}>
          <p>The employer gets the Verified badge on its jobs and company page.</p>
          {(!registry || registry.status !== 'ACTIVE') && <p>No active registry result is on file.</p>}
        </ConfirmDialog>
      )}
      {dialog === 'reject' && (
        <ReasonDialog
          title={`Do not approve ${employer.company_name}`}
          label="Reason shown to the employer"
          confirmLabel="Save decision"
          busy={action.busy}
          onSubmit={reject}
          onClose={() => setDialog(null)}
        />
      )}
    </Page>
  );
}
