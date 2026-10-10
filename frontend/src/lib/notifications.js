/** Fired after notifications are marked as read so the header count follows without a page change. */
export const NOTIFICATIONS_CHANGED = 'opendoor:notifications-changed';

export function notificationsChanged() {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
}
