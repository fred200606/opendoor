import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminListPostings, adminReviewPosting } from '../../api/admin.js';
import ActionFeedback from '../../components/ActionFeedback.jsx';
import AsyncContent from '../../components/AsyncContent.jsx';
import Button from '../../components/Button.jsx';
import { ReasonDialog } from '../../components/Dialog.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { SelectField } from '../../components/form/fields.jsx';
import Page from '../../components/Page.jsx';
import Pagination from '../../components/Pagination.jsx';
import StatusBadge, { VerifiedBadge } from '../../components/StatusBadge.jsx';
import { useAction } from '../../hooks/useAction.js';
import { useAsync } from '../../hooks/useAsync.js';
import { formatDate, plural } from '../../lib/format.js';
import { EMPLOYMENT_TYPES, POSTING_STATUSES, WORK_SETUPS, toOptions } from '../../lib/labels.js';

/** Posting approval queue (pending_approval → open, or rejected with a reason). */
export default function AdminPostingsPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'pending_approval';
  const page = Number(params.get('page') ?? 1);
  const state = useAsync(() => adminListPostings({ status, page }), [status, page]);
  const action = useAction();
  const [rejecting, setRejecting] = useState(null);

  async function approve(posting) {
    const result = await action.run(() => adminReviewPosting(posting.id, 'approve'), `“${posting.title}” is approved and now open.`);
    if (result) state.reload();
  }

  async function reject(reason) {
    const posting = rejecting;
    const result = await action.run(() => adminReviewPosting(posting.id, 'reject', reason), `“${posting.title}” was not approved. The employer can see your reason.`);
    setRejecting(null);
    if (result) state.reload();
  }

  return (
    <Page title="Job postings">
      <SelectField
        label="Show"
        name="status"
        className="filter-inline"
        options={toOptions(POSTING_STATUSES)}
        value={status}
        onChange={(event) => setParams({ status: event.target.value }, { replace: true })}
      />
      <ActionFeedback action={action} />

      <AsyncContent state={state} label="Loading postings">
        {({ data, meta }) =>
          data.length === 0 ? (
            <EmptyState title={status === 'pending_approval' ? 'No postings are waiting for approval' : 'No postings here'} />
          ) : (
            <>
              <p aria-live="polite">{plural(meta.total, 'posting')}</p>
              <ul className="result-list">
                {data.map((posting) => (
                  <li key={posting.id}>
                    <article className="card">
                      <h2 className="job-card__title">{posting.title}</h2>
                      <p>
                        {posting.employer?.company_name} <VerifiedBadge verified={posting.employer?.verified} />{' '}
                        <StatusBadge kind="posting" status={posting.status} />
                      </p>
                      <p className="job-card__meta">
                        {[posting.category?.name, EMPLOYMENT_TYPES[posting.employment_type], WORK_SETUPS[posting.work_setup], `closes ${formatDate(posting.closes_at)}`]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      <details>
                        <summary>Description and accommodations</summary>
                        <div className="prose">{posting.description}</div>
                        <ul>
                          {(posting.accommodations ?? []).map((item) => (
                            <li key={item.id}>
                              {item.name}
                              {item.note && ` – ${item.note}`}
                            </li>
                          ))}
                        </ul>
                      </details>
                      {posting.status === 'pending_approval' && (
                        <div className="actions">
                          <Button type="button" className="button" disabled={action.busy} aria-label={`Approve ${posting.title}`} onClick={() => approve(posting)}>
                            Approve
                          </Button>
                          <Button type="button" className="button button--secondary" disabled={action.busy} aria-label={`Do not approve ${posting.title}`} onClick={() => setRejecting(posting)}>
                            Do not approve
                          </Button>
                        </div>
                      )}
                    </article>
                  </li>
                ))}
              </ul>
              <Pagination meta={meta} onPageChange={(next) => setParams({ status, page: String(next) }, { replace: true })} />
            </>
          )
        }
      </AsyncContent>

      {rejecting && (
        <ReasonDialog
          title={`Do not approve “${rejecting.title}”`}
          label="Reason shown to the employer"
          hint="Explain what to change, for example: unclear working hours or a missing accommodation detail."
          confirmLabel="Save decision"
          busy={action.busy}
          onSubmit={reject}
          onClose={() => setRejecting(null)}
        />
      )}
    </Page>
  );
}
