import { api } from './client.js';

// Insights Service (through the gateway at /api/insights/*)

/** Workplace Accessibility Snapshot – 200 even when some sources fail (see `sources`). */
export async function getSnapshot(jobId) {
  const { data } = await api.get(`/insights/job-postings/${jobId}`);
  return data;
}

/** level: 'regions' | 'provinces' | 'cities' → [{ code, name, level }] */
export async function getLocations(level, parent) {
  const { data } = await api.get(`/insights/locations/${level}`, { params: parent ? { parent } : undefined });
  return data;
}
