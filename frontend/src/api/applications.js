import { api } from './client.js';

// M6 Applications, M7 Feedback

/** → { id, job_posting_id, status, created_at } */
export async function applyToJob(jobId, { coverNote, interviewRequest }) {
  const { data } = await api.post(`/job-postings/${jobId}/applications`, {
    cover_note: coverNote || undefined,
    interview_request: interviewRequest || undefined,
  });
  return data;
}

/** Candidate: own applications. Employer: applications to own postings (filter by job_posting_id). */
export async function getApplications({ status, jobPostingId, page } = {}) {
  const { data } = await api.get('/applications', {
    params: { status: status || undefined, job_posting_id: jobPostingId || undefined, page },
  });
  return data;
}

/** Opening a pending application as the employer marks it reviewed (server side). */
export async function getApplication(id) {
  const { data } = await api.get(`/applications/${id}`);
  return data;
}

/** status: 'reviewed' | 'shortlisted' | 'contacted' | 'rejected' | 'withdrawn' (hired only through a hiring report) */
export async function setApplicationStatus(id, status) {
  const { data } = await api.patch(`/applications/${id}/status`, { status });
  return data;
}

/** Either party reports the hire (Decision 2026-10-22b); startDate 'YYYY-MM-DD'. → the Application */
export async function reportHiring(applicationId, startDate) {
  const { data } = await api.post(`/applications/${applicationId}/hiring-reports`, { start_date: startDate });
  return data;
}

/** The other party answers: 'confirm' | 'not_yet' | 'incorrect'; only not_yet takes a new startDate. → the Application */
export async function answerHiringReport(applicationId, reportId, answer, startDate) {
  const { data } = await api.post(`/applications/${applicationId}/hiring-reports/${reportId}/response`, {
    answer,
    start_date: startDate || undefined,
  });
  return data;
}

/** → { opens_on, is_open, items: [{ accommodation_id, name }] } */
export async function getFeedbackForm(applicationId) {
  const { data } = await api.get(`/applications/${applicationId}/feedback-form`);
  return data;
}

/** items: [{ accommodation_id, rating }] */
export async function submitFeedback(applicationId, { items, comments }) {
  const { data } = await api.post(`/applications/${applicationId}/feedback`, { items, comments: comments || undefined });
  return data;
}
