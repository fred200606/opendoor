import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { adminListReports, adminResolveReport } from '../../api/admin.js';
import ActionFeedback from '../../components/ActionFeedback.jsx';
import AsyncContent from '../../components/AsyncContent.jsx';
import { ReasonDialog } from '../../components/Dialog.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { SelectField } from '../../components/form/fields.jsx';
import Page from '../../components/Page.jsx';
import Pagination from '../../components/Pagination.jsx';
import ResultCount from '../../components/ResultCount.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { useAction } from '../../hooks/useAction.js';
import { useAsync } from '../../hooks/useAsync.js';
import { formatDate } from '../../lib/format.js';
import { REPORT_STATUSES, toOptions } from '../../lib/labels.js';

const RESOLUTIONS = {
  dismissed: { label: 'Dismiss', title: 'Dismiss this report?', done: 'The report was dismissed.' },
  actioned: { label: 'Take action', title: 'Record the action taken', done: 'The report is marked as actioned.' },
};

export default function AdminReportsPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'open';
  const page = Number(params.get('page') ?? 1);
  const state = useAsync(() => adminListReports({ status, page }), [status, page]);
  const action = useAction();
  const [resolving, setResolving] = useState(null);

  async function resolve(note) {
    const { report, resolution } = resolving;
    const result = await action.run(() => adminResolveReport(report.id, resolution, note), RESOLUTIONS[resolution].done);
    setResolving(null);
    if (result) state.reload();
  }

  return (
    <Page title="Reports" subtitle={<p className="page__subtitle">Postings that job seekers reported.</p>}>
      <div className="filter-bar">
        <SelectField
          label="Show"
          name="status"
          className="field--inline"
          options={toOptions(REPORT_STATUSES)}
          value={status}
          onChange={(event) => setParams({ status: event.target.value }, { replace: true })}
        />
        <ResultCount state={state} one="report" />
      </div>
      <ActionFeedback action={action} errorTitle="The report was not updated" />

      <AsyncContent state={state} label="Loading reports">
        {({ data, meta }) =>
          data.length === 0 ? (
            <EmptyState title="No reports here" />
          ) : (
            <>
              <ul className="result-list">
                {data.map((report) => (
                  <li key={report.id}>
                    <article className="card review-posting">
                      <h2 className="job-card__title">
                        <Link to={`/jobs/${report.job_posting_id}`}>{report.job_posting?.title ?? `Posting #${report.job_posting_id}`}</Link>
                      </h2>
                      <p className="report-line">
                        {report.job_posting?.employer?.company_name && <strong>{report.job_posting.employer.company_name}</strong>}
                        <span className="muted">Reported {formatDate(report.created_at)}</span>
                        <StatusBadge kind="report" status={report.status} />
                      </p>
                      <blockquote className="quote">{report.reason}</blockquote>
                      {report.status !== 'open' && report.resolved_at && (
                        <p>
                          Resolved {formatDate(report.resolved_at)}
                          {report.note ? ` – note: ${report.note}` : ' – no note'}
                        </p>
                      )}
                      {report.status === 'open' && (
                        <div className="actions">
                          {Object.entries(RESOLUTIONS).map(([resolution, item]) => (
                            <button
                              key={resolution}
                              type="button"
                              className={`button ${resolution === 'dismissed' ? 'button--secondary' : ''}`}
                              aria-label={`${item.label}: report on ${report.job_posting?.title ?? `posting #${report.job_posting_id}`}, ${formatDate(report.created_at)}`}
                              onClick={() => setResolving({ report, resolution })}
                            >
                              {item.label}
                            </button>
                          ))}
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

      {resolving && (
        <ReasonDialog
          title={RESOLUTIONS[resolving.resolution].title}
          label="Note"
          hint={resolving.resolution === 'actioned' ? 'For example: posting closed, employer contacted.' : undefined}
          required={false}
          confirmLabel={RESOLUTIONS[resolving.resolution].label}
          busy={action.busy}
          onSubmit={resolve}
          onClose={() => setResolving(null)}
        />
      )}
    </Page>
  );
}
