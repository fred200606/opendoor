import { Link, useParams, useSearchParams } from 'react-router-dom';
import { getApplications } from '../../api/applications.js';
import { getJob } from '../../api/jobs.js';
import AsyncContent from '../../components/AsyncContent.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { SelectField } from '../../components/form/fields.jsx';
import Page from '../../components/Page.jsx';
import Pagination from '../../components/Pagination.jsx';
import ResultCount from '../../components/ResultCount.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { formatDate } from '../../lib/format.js';
import { APPLICATION_STATUSES, toOptions } from '../../lib/labels.js';

/** Applicants for one of the employer's own postings. */
export default function ApplicantsPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const page = Number(params.get('page') ?? 1);
  const job = useAsync(() => getJob(id), [id]);
  const state = useAsync(() => getApplications({ jobPostingId: id, status, page }), [id, status, page]);

  return (
    <Page title={job.data ? `Applicants for “${job.data.title}”` : 'Applicants'}>
      <p>
        <Link to="/employer/jobs">Back to job postings</Link>
      </p>
      <SelectField
        label="Show"
        name="status"
        className="filter-inline"
        placeholder="All applicants"
        options={toOptions(APPLICATION_STATUSES)}
        value={status}
        onChange={(event) => setParams(event.target.value ? { status: event.target.value } : {}, { replace: true })}
      />
      <ResultCount state={state} one="applicant" />
      <AsyncContent state={state} label="Loading applicants">
        {({ data, meta }) =>
          data.length === 0 ? (
            <EmptyState title="No applicants yet" />
          ) : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <caption className="visually-hidden">Applicants</caption>
                  <thead>
                    <tr>
                      <th scope="col">Applicant</th>
                      <th scope="col">Headline</th>
                      <th scope="col">Applied</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((application) => (
                      <tr key={application.id}>
                        <th scope="row">
                          <Link to={`/employer/applications/${application.id}`}>{application.candidate?.name}</Link>
                        </th>
                        <td>{application.candidate?.headline}</td>
                        <td>{formatDate(application.created_at)}</td>
                        <td>
                          <StatusBadge kind="application" status={application.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination meta={meta} onPageChange={(next) => setParams({ ...(status ? { status } : {}), page: String(next) }, { replace: true })} />
            </>
          )
        }
      </AsyncContent>
    </Page>
  );
}
