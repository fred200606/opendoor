import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminListFeedback, adminSetFeedbackHidden } from '../../api/admin.js';
import ActionFeedback from '../../components/ActionFeedback.jsx';
import AsyncContent from '../../components/AsyncContent.jsx';
import { ConfirmDialog } from '../../components/Dialog.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { SelectField } from '../../components/form/fields.jsx';
import Page from '../../components/Page.jsx';
import Pagination from '../../components/Pagination.jsx';
import ResultCount from '../../components/ResultCount.jsx';
import { useAction } from '../../hooks/useAction.js';
import { useAsync } from '../../hooks/useAsync.js';
import { formatDate } from '../../lib/format.js';
import { FEEDBACK_RATINGS } from '../../lib/labels.js';

const VISIBILITY = [
  { value: '', label: 'All responses' },
  { value: '0', label: 'Counted in the score' },
  { value: '1', label: 'Hidden' },
];

/** Feedback moderation: hiding a response removes it from the trust score (recomputed by Core). */
export default function AdminFeedbackPage() {
  const [params, setParams] = useSearchParams();
  const hidden = params.get('hidden') ?? '';
  const page = Number(params.get('page') ?? 1);
  const state = useAsync(() => adminListFeedback({ hidden: hidden === '' ? undefined : hidden === '1', page }), [hidden, page]);
  const action = useAction();
  const [confirm, setConfirm] = useState(null);

  async function toggle() {
    const feedback = confirm;
    const result = await action.run(
      () => adminSetFeedbackHidden(feedback.id, !feedback.is_hidden),
      feedback.is_hidden ? 'The response counts in the trust score again.' : 'The response is hidden and no longer counts in the trust score.',
    );
    setConfirm(null);
    if (result) state.setData((current) => ({ ...current, data: current.data.map((item) => (item.id === feedback.id ? { ...item, is_hidden: !item.is_hidden } : item)) }));
  }

  return (
    <Page title="Feedback responses">
      <p>Responses are anonymous. Hide a response only if it is abusive, off-topic or clearly false; the trust score is recalculated.</p>
      <SelectField label="Show" name="hidden" className="filter-inline" options={VISIBILITY} value={hidden} onChange={(event) => setParams(event.target.value ? { hidden: event.target.value } : {}, { replace: true })} />
      <ActionFeedback action={action} errorTitle="The response was not changed" />

      <ResultCount state={state} one="response" />
      <AsyncContent state={state} label="Loading feedback">
        {({ data, meta }) =>
          data.length === 0 ? (
            <EmptyState title="No feedback responses here" />
          ) : (
            <>
              <ul className="result-list">
                {data.map((feedback) => (
                  <li key={feedback.id}>
                    <article className="card">
                      <h2 className="job-card__title">
                        {feedback.employer?.company_name} – {feedback.job_title}
                      </h2>
                      <p>
                        Submitted {formatDate(feedback.created_at)}
                        {feedback.is_hidden && (
                          <>
                            {' '}
                            <span className="badge badge--muted">Hidden</span>
                          </>
                        )}
                      </p>
                      <ul>
                        {(feedback.items ?? []).map((item) => (
                          <li key={item.accommodation_id}>
                            {item.name}: <strong>{FEEDBACK_RATINGS[item.rating]}</strong>
                          </li>
                        ))}
                      </ul>
                      {feedback.comments && <blockquote className="quote">{feedback.comments}</blockquote>}
                      <button
                        type="button"
                        className="button button--secondary button--small"
                        aria-label={`${feedback.is_hidden ? 'Show again' : 'Hide response'}: ${feedback.job_title} at ${feedback.employer?.company_name}, ${formatDate(feedback.created_at)}`}
                        onClick={() => setConfirm(feedback)}
                      >
                        {feedback.is_hidden ? 'Show again' : 'Hide response'}
                      </button>
                    </article>
                  </li>
                ))}
              </ul>
              <Pagination meta={meta} onPageChange={(next) => setParams({ ...(hidden ? { hidden } : {}), page: String(next) }, { replace: true })} />
            </>
          )
        }
      </AsyncContent>

      {confirm && (
        <ConfirmDialog
          title={confirm.is_hidden ? 'Count this response again?' : 'Hide this response?'}
          confirmLabel={confirm.is_hidden ? 'Show again' : 'Hide response'}
          danger={!confirm.is_hidden}
          busy={action.busy}
          onConfirm={toggle}
          onClose={() => setConfirm(null)}
        >
          <p>The employer’s trust score will be recalculated.</p>
        </ConfirmDialog>
      )}
    </Page>
  );
}
