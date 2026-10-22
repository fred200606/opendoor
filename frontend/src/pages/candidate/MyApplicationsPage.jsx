import { Link, useSearchParams } from 'react-router-dom';
import { getApplications } from '../../api/applications.js';
import AsyncContent from '../../components/AsyncContent.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { SelectField } from '../../components/form/fields.jsx';
import Page from '../../components/Page.jsx';
import Pagination from '../../components/Pagination.jsx';
import ResultCount from '../../components/ResultCount.jsx';
import { ApplicationStatusBadge } from '../../components/StatusBadge.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { formatDate } from '../../lib/format.js';
import { APPLICATION_STATUSES, toOptions } from '../../lib/labels.js';

export default function MyApplicationsPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const page = Number(params.get('page') ?? 1);
  const state = useAsync(() => getApplications({ status, page }), [status, page]);

  return (
    <Page title="My applications" subtitle={<p className="page__subtitle">Every job you applied to and where it stands.</p>}>
      <div className="filter-bar">
        <SelectField
          label="Show"
          name="status"
          className="field--inline"
          placeholder="All applications"
          options={toOptions(APPLICATION_STATUSES)}
          value={status}
          onChange={(event) => setParams(event.target.value ? { status: event.target.value } : {}, { replace: true })}
        />
        <ResultCount state={state} one="application" />
      </div>
      <AsyncContent state={state} label="Loading your applications">
        {({ data, meta }) => (
          <>
            {data.length === 0 ? (
              <EmptyState title={status ? 'No applications with this status' : 'You have not applied to any jobs yet'} mascot>
                <p>
                  <Link to="/candidate/jobs">Find jobs that match your needs</Link>
                </p>
              </EmptyState>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <caption className="visually-hidden">Your applications</caption>
                  <thead>
                    <tr>
                      <th scope="col">Job</th>
                      <th scope="col">Employer</th>
                      <th scope="col">Applied</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((application) => (
                      <tr key={application.id}>
                        <th scope="row">
                          <Link to={`/candidate/applications/${application.id}`}>{application.job_posting?.title}</Link>
                        </th>
                        <td>{application.job_posting?.employer?.company_name}</td>
                        <td>{formatDate(application.created_at)}</td>
                        <td>
                          <ApplicationStatusBadge application={application} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination
              meta={meta}
              onPageChange={(next) => setParams({ ...(status ? { status } : {}), page: String(next) }, { replace: true })}
            />
          </>
        )}
      </AsyncContent>
    </Page>
  );
}
