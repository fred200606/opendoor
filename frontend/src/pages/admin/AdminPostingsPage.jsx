import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminListPostings, adminRemovePosting } from '../../api/admin.js';
import ActionFeedback from '../../components/ActionFeedback.jsx';
import AsyncContent from '../../components/AsyncContent.jsx';
import Button from '../../components/Button.jsx';
import { ReasonDialog } from '../../components/Dialog.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { SelectField } from '../../components/form/fields.jsx';
import Page from '../../components/Page.jsx';
import Pagination from '../../components/Pagination.jsx';
import ResultCount from '../../components/ResultCount.jsx';
import StatusBadge, { VerifiedBadge } from '../../components/StatusBadge.jsx';
import { useAction } from '../../hooks/useAction.js';
import { useAsync } from '../../hooks/useAsync.js';
import { formatDate } from '../../lib/format.js';
import { EMPLOYMENT_TYPES, POSTING_STATUSES, WORK_SETUPS, toOptions } from '../../lib/labels.js';

/**
 * Every posting, newest first. Verified companies publish without approval (decision 2026-10-21),
 * so admins only remove postings that break the rules (the employer is told why).
 */
export default function AdminPostingsPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const page = Number(params.get('page') ?? 1);
  const state = useAsync(() => adminListPostings({ status, page }), [status, page]);
  const action = useAction();
  const [removing, setRemoving] = useState(null);

  async function remove(reason) {
    const posting = removing;
    const result = await action.run(() => adminRemovePosting(posting.id, reason), `“${posting.title}” was removed. The employer was told why.`);
    setRemoving(null);
    if (result) state.reload();
  }

  return (
    <Page title="Postings" subtitle={<p className="page__subtitle">Jobs of verified companies go live without approval. Remove any posting that breaks the rules.</p>}>
      <div className="filter-bar">
        <SelectField
          label="Show"
          name="status"
          className="field--inline"
          options={[{ value: '', label: 'All postings' }, ...toOptions(POSTING_STATUSES)]}
          value={status}
          onChange={(event) => setParams(event.target.value ? { status: event.target.value } : {}, { replace: true })}
        />
        <ResultCount state={state} one="posting" />
      </div>
      <ActionFeedback action={action} />

      <AsyncContent state={state} label="Loading postings">
        {({ data, meta }) =>
          data.length === 0 ? (
            <EmptyState title="No postings here" />
          ) : (
            <>
              <ul className="result-list">
                {data.map((posting) => (
                  <li key={posting.id}>
                    <article className="card review-posting">
                      <h2 className="job-card__title">{posting.title}</h2>
                      <p className="job-card__employer">
                        {posting.employer?.company_name} <VerifiedBadge verified={posting.employer?.verified} />{' '}
                        <StatusBadge kind="posting" status={posting.status} />
                      </p>
                      <p className="job-card__meta">
                        {[posting.category?.name, EMPLOYMENT_TYPES[posting.employment_type], WORK_SETUPS[posting.work_setup], `closes ${formatDate(posting.closes_at)}`]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      <details className="filter-details">
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
                      <div className="actions">
                        <Button type="button" className="button button--danger-outline" disabled={action.busy} aria-label={`Remove ${posting.title}`} onClick={() => setRemoving(posting)}>
                          Remove
                        </Button>
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
              <Pagination meta={meta} onPageChange={(next) => setParams({ ...(status ? { status } : {}), page: String(next) }, { replace: true })} />
            </>
          )
        }
      </AsyncContent>

      {removing && (
        <ReasonDialog
          title={`Remove “${removing.title}”?`}
          label="Reason shown to the employer"
          hint="The posting disappears for everyone; applications are kept. For example: false accommodation claims or a duplicate posting."
          confirmLabel="Remove posting"
          busy={action.busy}
          onSubmit={remove}
          onClose={() => setRemoving(null)}
        />
      )}
    </Page>
  );
}
