import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { adminListEmployers } from '../../api/admin.js';
import AsyncContent from '../../components/AsyncContent.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { SelectField, TextField } from '../../components/form/fields.jsx';
import Page from '../../components/Page.jsx';
import Pagination from '../../components/Pagination.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { plural } from '../../lib/format.js';

const STATUSES = [
  { value: 'pending', label: 'Waiting for verification' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Not approved' },
];

export default function AdminEmployersPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'pending';
  const q = params.get('q') ?? '';
  const page = Number(params.get('page') ?? 1);
  const [search, setSearch] = useState(q);
  const state = useAsync(() => adminListEmployers({ status, q, page }), [status, q, page]);

  function update(changes) {
    const next = { status, q, ...changes };
    setParams(Object.fromEntries(Object.entries(next).filter(([, value]) => value)), { replace: true });
  }

  return (
    <Page title="Employers">
      <form
        className="filter-bar"
        role="search"
        aria-label="Filter employers"
        onSubmit={(event) => {
          event.preventDefault();
          update({ q: search.trim() });
        }}
      >
        <SelectField label="Show" name="status" options={STATUSES} value={status} onChange={(event) => update({ status: event.target.value })} />
        <TextField label="Company or registration number" name="q" type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
        <button type="submit" className="button button--secondary">
          Search
        </button>
      </form>

      <AsyncContent state={state} label="Loading employers">
        {({ data, meta }) =>
          data.length === 0 ? (
            <EmptyState title="No employers here" />
          ) : (
            <>
              <p aria-live="polite">{plural(meta.total, 'employer')}</p>
              <div className="table-wrap">
                <table className="table">
                  <caption className="visually-hidden">Employers</caption>
                  <thead>
                    <tr>
                      <th scope="col">Company</th>
                      <th scope="col">Registration</th>
                      <th scope="col">Latest registry check</th>
                      <th scope="col">Account</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((employer) => (
                      <tr key={employer.id}>
                        <th scope="row">
                          <Link to={`/admin/employers/${employer.id}`}>{employer.company_name}</Link>
                        </th>
                        <td>
                          {employer.registry_type} {employer.business_reg_no}
                        </td>
                        <td>
                          {employer.latest_registry_check ? (
                            <StatusBadge kind="registry" status={employer.latest_registry_check.status} />
                          ) : (
                            'Not checked yet'
                          )}
                        </td>
                        <td>{employer.owner?.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination meta={meta} onPageChange={(next) => update({ page: String(next) })} />
            </>
          )
        }
      </AsyncContent>
    </Page>
  );
}
