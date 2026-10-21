import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { deletePosting, getMyPostings, setPostingStatus } from '../../api/jobs.js';
import Alert, { ApiErrorAlert } from '../../components/Alert.jsx';
import AsyncContent from '../../components/AsyncContent.jsx';
import { ConfirmDialog } from '../../components/Dialog.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { SelectField } from '../../components/form/fields.jsx';
import Page from '../../components/Page.jsx';
import Pagination from '../../components/Pagination.jsx';
import ResultCount from '../../components/ResultCount.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { formatDate, plural } from '../../lib/format.js';
import { POSTING_STATUSES, toOptions } from '../../lib/labels.js';

export default function PostingsPage() {
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const page = Number(params.get('page') ?? 1);
  const state = useAsync(() => getMyPostings({ status, page }), [status, page]);

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(location.state?.message ?? '');

  async function changeStatus(posting, next) {
    setError(null);
    try {
      const updated = await setPostingStatus(posting.id, next);
      state.setData((current) => ({ ...current, data: current.data.map((item) => (item.id === posting.id ? { ...item, ...updated } : item)) }));
      setMessage(next === 'closed' ? `“${posting.title}” is closed to new applications.` : `“${posting.title}” is open again.`);
    } catch (apiError) {
      setError(apiError);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await deletePosting(confirmDelete.id);
      setMessage(`“${confirmDelete.title}” was deleted.`);
      setConfirmDelete(null);
      state.reload();
    } catch (apiError) {
      setError(apiError);
      setConfirmDelete(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page title="Job postings" subtitle={<p className="page__subtitle">All your postings and their state.</p>}>
      {message && (
        <Alert type="success" live="polite">
          <p>{message}</p>
        </Alert>
      )}
      <ApiErrorAlert error={error} title="The posting was not changed" />

      <div className="filter-bar">
        <SelectField
          label="Show"
          name="status"
          className="field--inline"
          placeholder="All postings"
          options={toOptions(POSTING_STATUSES)}
          value={status}
          onChange={(event) => setParams(event.target.value ? { status: event.target.value } : {}, { replace: true })}
        />
        <ResultCount state={state} one="posting" />
        <Link to="/employer/jobs/new" className="button filter-bar__end">
          <Plus aria-hidden="true" focusable="false" />
          Post a new job
        </Link>
      </div>
      <AsyncContent state={state} label="Loading your postings">
        {({ data, meta }) =>
          data.length === 0 ? (
            <EmptyState title={status ? 'No postings with this status' : 'You have not posted any jobs yet'} mascot>
              {!status && (
                <p>
                  <Link to="/employer/jobs/new">Post your first job</Link>
                </p>
              )}
            </EmptyState>
          ) : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <caption className="visually-hidden">Your job postings</caption>
                  <thead>
                    <tr>
                      <th scope="col">Job</th>
                      <th scope="col">Status</th>
                      <th scope="col">Applicants</th>
                      <th scope="col">Closes</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((posting) => (
                      <tr key={posting.id}>
                        <th scope="row">
                          <Link to={`/employer/jobs/${posting.id}/edit`}>{posting.title}</Link>
                        </th>
                        <td>
                          <StatusBadge kind="posting" status={posting.status} />
                        </td>
                        <td>
                          {posting.applicants_count > 0 ? (
                            <Link to={`/employer/jobs/${posting.id}/applicants`} aria-label={`${plural(posting.applicants_count, 'applicant')} for ${posting.title}`}>
                              {posting.applicants_count}
                            </Link>
                          ) : (
                            0
                          )}
                        </td>
                        <td>{formatDate(posting.closes_at)}</td>
                        <td className="table-actions">
                          <Link to={`/employer/jobs/${posting.id}/edit`} className="table-actions__link" aria-label={`Edit ${posting.title}`}>
                            Edit
                          </Link>
                          {posting.status === 'open' && (
                            <button type="button" className="button button--secondary button--small" aria-label={`Close ${posting.title}`} onClick={() => changeStatus(posting, 'closed')}>
                              Close
                            </button>
                          )}
                          {posting.status === 'closed' && (
                            <button type="button" className="button button--secondary button--small" aria-label={`Reopen ${posting.title}`} onClick={() => changeStatus(posting, 'open')}>
                              Reopen
                            </button>
                          )}
                          <button type="button" className="button button--danger-outline button--small" aria-label={`Delete ${posting.title}`} onClick={() => setConfirmDelete(posting)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="field__hint">
                Delete asks you to confirm: the job disappears from search, and applications already received stay available to you and the
                applicants.
              </p>
              <Pagination meta={meta} onPageChange={(next) => setParams({ ...(status ? { status } : {}), page: String(next) }, { replace: true })} />
            </>
          )
        }
      </AsyncContent>

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete “${confirmDelete.title}”?`}
          confirmLabel="Delete posting"
          danger
          busy={busy}
          onConfirm={remove}
          onClose={() => setConfirmDelete(null)}
        >
          <p>The job disappears from search. Applications already received stay available to you and the applicants.</p>
        </ConfirmDialog>
      )}
    </Page>
  );
}
