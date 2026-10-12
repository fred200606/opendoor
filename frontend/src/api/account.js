import { api } from './client.js';

// M8 Dashboards, M9 Notifications

/** role: 'candidate' | 'employer' | 'admin' */
export async function getDashboard(role) {
  const { data } = await api.get(`/${role}/dashboard`);
  return data;
}

/** → { data: [Notification], meta: { ..., unread_count } } */
export async function getNotifications({ page } = {}) {
  const { data } = await api.get('/notifications', { params: { page } });
  return data;
}

export async function markNotificationRead(id) {
  await api.patch(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead() {
  await api.patch('/notifications/read-all');
}

// M13 Display settings

/** prefs in the API shape `{ text_size, contrast, motion }` → the saved settings */
export async function updateDisplayPrefs(prefs) {
  const { data } = await api.put('/me/display-prefs', prefs);
  return data;
}

// M13 Email notifications (job seekers and employers)

/** → { enabled } */
export async function updateEmailNotifications(enabled) {
  const { data } = await api.put('/me/email-notifications', { enabled });
  return data;
}
