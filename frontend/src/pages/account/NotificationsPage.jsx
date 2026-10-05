import { Link, useSearchParams } from 'react-router-dom';
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '../../api/account.js';
import ActionFeedback from '../../components/ActionFeedback.jsx';
import AsyncContent from '../../components/AsyncContent.jsx';
import Button from '../../components/Button.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import Page from '../../components/Page.jsx';
import Pagination from '../../components/Pagination.jsx';
import { useAction } from '../../hooks/useAction.js';
import { useAsync } from '../../hooks/useAsync.js';
import { formatDateTime, plural } from '../../lib/format.js';

/** M9 notifications. `data.message` is the text, `data.url` an optional in-app link. */
export default function NotificationsPage() {
  const [params, setParams] = useSearchParams();
  const page = Number(params.get('page') ?? 1);
  const state = useAsync(() => getNotifications({ page }), [page]);
  const action = useAction();

  async function markRead(notification) {
    if (notification.read_at) return;
    const done = await action.run(() => markNotificationRead(notification.id));
    if (done) state.setData((current) => withRead(current, [notification.id]));
  }

  async function markAll() {
    const done = await action.run(() => markAllNotificationsRead(), 'All notifications are marked as read.');
    if (done) state.setData((current) => withRead(current, null));
  }

  return (
    <Page title="Notifications">
      <ActionFeedback action={action} errorTitle="The notification was not updated" />
      <AsyncContent state={state} label="Loading notifications">
        {({ data, meta }) =>
          data.length === 0 ? (
            <EmptyState title="No notifications yet">
              <p>You will be told here when an application or posting changes.</p>
            </EmptyState>
          ) : (
            <>
              <div className="notifications-header">
                <p aria-live="polite">{meta.unread_count ? `${plural(meta.unread_count, 'unread notification')}` : 'Everything is read.'}</p>
                {meta.unread_count > 0 && (
                  <Button type="button" className="button button--secondary button--small" disabled={action.busy} onClick={markAll}>
                    Mark all as read
                  </Button>
                )}
              </div>
              <ul className="notification-list">
                {data.map((notification) => (
                  <li key={notification.id} className={notification.read_at ? '' : 'notification--unread'}>
                    {!notification.read_at && <span className="badge badge--info">New</span>}
                    <p className="notification__text">
                      {notification.data?.url ? (
                        <Link to={notification.data.url} onClick={() => markRead(notification)}>
                          {notification.data?.message}
                        </Link>
                      ) : (
                        notification.data?.message
                      )}
                    </p>
                    <p className="field__hint">{formatDateTime(notification.created_at)}</p>
                    {!notification.read_at && !notification.data?.url && (
                      <button type="button" className="button button--link" onClick={() => markRead(notification)}>
                        Mark as read
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <Pagination meta={meta} onPageChange={(next) => setParams({ page: String(next) }, { replace: true })} />
            </>
          )
        }
      </AsyncContent>
    </Page>
  );
}

/** Marks `ids` (or every notification when null) as read in a page of results. */
function withRead(current, ids) {
  const readAt = new Date().toISOString();
  let newlyRead = 0;
  const data = current.data.map((item) => {
    if (item.read_at || (ids && !ids.includes(item.id))) return item;
    newlyRead += 1;
    return { ...item, read_at: readAt };
  });
  const unread = ids ? Math.max(0, (current.meta.unread_count ?? newlyRead) - newlyRead) : 0;
  return { ...current, data, meta: { ...current.meta, unread_count: unread } };
}
