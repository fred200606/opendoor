import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminListUsers, adminSetSuspended } from '../../api/admin.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { ROLE_LABELS } from '../../auth/roles.js';
import ActionFeedback from '../../components/ActionFeedback.jsx';
import AsyncContent from '../../components/AsyncContent.jsx';
import { ConfirmDialog } from '../../components/Dialog.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { SelectField, TextField } from '../../components/form/fields.jsx';
import Page from '../../components/Page.jsx';
import { BadgeIcon } from '../../components/StatusBadge.jsx';
import Pagination from '../../components/Pagination.jsx';
import ResultCount from '../../components/ResultCount.jsx';
import { useAction } from '../../hooks/useAction.js';
import { useAsync } from '../../hooks/useAsync.js';
import { toOptions } from '../../lib/labels.js';

export default function AdminUsersPage() {
  const { user: me } = useAuth();
  const [params, setParams] = useSearchParams();
  const role = params.get('role') ?? '';
  const q = params.get('q') ?? '';
  const page = Number(params.get('page') ?? 1);
  const [search, setSearch] = useState(q);
  const state = useAsync(() => adminListUsers({ role, q, page }), [role, q, page]);
  const action = useAction();
  const [confirm, setConfirm] = useState(null);

  function update(changes) {
    const next = { role, q, ...changes };
    setParams(Object.fromEntries(Object.entries(next).filter(([, value]) => value)), { replace: true });
  }

  async function toggle() {
    const target = confirm;
    const suspend = target.is_active;
    const updated = await action.run(
      () => adminSetSuspended(target.id, suspend),
      suspend ? `${target.name} is suspended and signed out everywhere.` : `${target.name} can log in again.`,
    );
    setConfirm(null);
    if (updated) state.setData((current) => ({ ...current, data: current.data.map((item) => (item.id === target.id ? { ...item, ...updated } : item)) }));
  }

  return (
    <Page title="Users" subtitle={<p className="page__subtitle">Find accounts. Suspend or reactivate them.</p>}>
      <form
        className="filter-bar filter-bar--fields"
        role="search"
        aria-label="Filter users"
        onSubmit={(event) => {
          event.preventDefault();
          update({ q: search.trim(), page: '' });
        }}
      >
        <SelectField label="Role" name="role" placeholder="All roles" options={toOptions(ROLE_LABELS)} value={role} onChange={(event) => update({ role: event.target.value, page: '' })} />
        <TextField label="Name or email" name="q" type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
        <button type="submit" className="button">
          Search
        </button>
      </form>
      <ActionFeedback action={action} errorTitle="The account was not changed" />

      <div className="result-count">
        <ResultCount state={state} one="user" />
      </div>
      <AsyncContent state={state} label="Loading users">
        {({ data, meta }) =>
          data.length === 0 ? (
            <EmptyState title="No users found" />
          ) : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <caption className="visually-hidden">Users</caption>
                  <thead>
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col">Email</th>
                      <th scope="col">Role</th>
                      <th scope="col">Status</th>
                      <th scope="col">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((user) => (
                      <tr key={user.id}>
                        <th scope="row">{user.name}</th>
                        <td>{user.email}</td>
                        <td>{ROLE_LABELS[user.role]}</td>
                        <td>
                          <span className={`badge ${user.is_active ? 'badge--success' : 'badge--danger'}`}>
                            <BadgeIcon tone={user.is_active ? 'success' : 'danger'} />
                            {user.is_active ? 'Active' : 'Suspended'}
                          </span>
                        </td>
                        <td>
                          {user.id === me.id ? (
                            <span className="muted">This is you</span>
                          ) : (
                            <button
                              type="button"
                              className={`button button--small ${user.is_active ? 'button--danger-outline' : 'button--secondary'}`}
                              aria-label={`${user.is_active ? 'Suspend' : 'Reactivate'} ${user.name}`}
                              onClick={() => setConfirm(user)}
                            >
                              {user.is_active ? 'Suspend' : 'Reactivate'}
                            </button>
                          )}
                        </td>
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

      {confirm && (
        <ConfirmDialog
          title={confirm.is_active ? `Suspend ${confirm.name}?` : `Reactivate ${confirm.name}?`}
          confirmLabel={confirm.is_active ? 'Suspend' : 'Reactivate'}
          danger={confirm.is_active}
          busy={action.busy}
          onConfirm={toggle}
          onClose={() => setConfirm(null)}
        >
          <p>
            {confirm.is_active
              ? 'They are signed out on every device and cannot log in until you reactivate the account.'
              : 'They will be able to log in again.'}
          </p>
          {confirm.role === 'employer' && (
            <p>
              {confirm.is_active
                ? 'Their job postings are hidden from candidates while the account is suspended. Nothing is deleted.'
                : 'Their open job postings will be shown to candidates again.'}
            </p>
          )}
        </ConfirmDialog>
      )}
    </Page>
  );
}
