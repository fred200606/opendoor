import { api } from './client.js';

// Administration: verification (M3), posting approval (M4), moderation (M10)

/** status: 'pending' | 'verified' | 'rejected' */
export async function adminListEmployers({ status, q, page } = {}) {
  const { data } = await api.get('/admin/employers', { params: { status: status || undefined, q: q || undefined, page } });
  return data;
}

export async function adminGetEmployer(id) {
  const { data } = await api.get(`/admin/employers/${id}`);
  return data;
}

/** action: 'check' (SOAP registry) | 'approve' | 'reject' (reason required) */
export async function adminVerifyEmployer(id, action, reason) {
  const { data } = await api.patch(`/admin/employers/${id}/verify`, { action, reason: reason || undefined });
  return data;
}

export async function adminListPostings({ status = 'pending_approval', page } = {}) {
  const { data } = await api.get('/admin/job-postings', { params: { status, page } });
  return data;
}

/** action: 'approve' | 'reject' */
export async function adminReviewPosting(id, action, reason) {
  const { data } = await api.patch(`/admin/job-postings/${id}/approve`, { action, reason: reason || undefined });
  return data;
}

/** Soft-deletes a posting in any status; the employer is told the reason. */
export async function adminRemovePosting(id, reason) {
  await api.delete(`/admin/job-postings/${id}`, { data: { reason } });
  return true;
}

export async function adminListUsers({ role, q, page } = {}) {
  const { data } = await api.get('/admin/users', { params: { role: role || undefined, q: q || undefined, page } });
  return data;
}

export async function adminSetSuspended(id, suspended) {
  const { data } = await api.patch(`/admin/users/${id}/suspend`, { suspended });
  return data;
}

export async function adminListReports({ status, page } = {}) {
  const { data } = await api.get('/admin/reports', { params: { status: status || undefined, page } });
  return data;
}

/** status: 'dismissed' | 'actioned' */
export async function adminResolveReport(id, status, note) {
  const { data } = await api.patch(`/admin/reports/${id}`, { status, note: note || undefined });
  return data;
}

export async function adminListFeedback({ employerId, hidden, page } = {}) {
  const { data } = await api.get('/admin/feedback', {
    params: { employer_id: employerId || undefined, hidden: hidden === undefined ? undefined : Number(hidden), page },
  });
  return data;
}

export async function adminSetFeedbackHidden(id, hidden) {
  await api.patch(`/admin/feedback/${id}/hide`, { hidden });
}
