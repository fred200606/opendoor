import { api } from './client.js';

// M5 Search and matching, M4 Job postings, M12 Saved jobs, M10 reports

/**
 * params: { q, category, accommodations: [ids], workSetups: [onsite|hybrid|remote], distance (km),
 * match: 0|1, sort, page } → { data: [JobPosting], meta: { current_page, last_page, total,
 * match_mode, distance } }; `distance` in meta is null when it could not be applied.
 */
export async function searchJobs({ q, category, accommodations = [], workSetups = [], distance, match, sort, page } = {}) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (category) params.set('category', category);
  accommodations.forEach((id) => params.append('accommodations[]', id));
  workSetups.forEach((setup) => params.append('work_setup[]', setup));
  if (distance) params.set('distance', distance);
  if (match) params.set('match', '1');
  if (sort) params.set('sort', sort);
  if (page > 1) params.set('page', page);

  const { data } = await api.get('/job-postings', { params });
  return data;
}

export async function getJob(id) {
  const { data } = await api.get(`/job-postings/${id}`);
  return data;
}

// Employer

export async function getMyPostings({ status, page } = {}) {
  const { data } = await api.get('/employer/job-postings', { params: { status: status || undefined, page } });
  return data;
}

/** posting: JobPostingInput (accommodations: [{ id, note }], submit: bool) */
export async function createPosting(posting) {
  const { data } = await api.post('/job-postings', posting);
  return data;
}

export async function updatePosting(id, posting) {
  const { data } = await api.put(`/job-postings/${id}`, posting);
  return data;
}

export async function deletePosting(id) {
  await api.delete(`/job-postings/${id}`);
}

/** status: 'open' | 'closed' */
export async function setPostingStatus(id, status) {
  const { data } = await api.patch(`/job-postings/${id}/status`, { status });
  return data;
}

// Reports and saved jobs

export async function reportPosting(id, reason) {
  const { data } = await api.post(`/job-postings/${id}/reports`, { reason });
  return data;
}

export async function getSavedJobs({ page } = {}) {
  const { data } = await api.get('/candidate/saved-jobs', { params: { page } });
  return data;
}

export async function saveJob(id) {
  await api.post(`/candidate/saved-jobs/${id}`);
}

export async function unsaveJob(id) {
  await api.delete(`/candidate/saved-jobs/${id}`);
}
