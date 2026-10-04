import { api } from './client.js';

// M2 Candidate profile

export async function getCandidateProfile() {
  const { data } = await api.get('/candidate/profile');
  return data;
}

/** profile: { headline, skills: [], experience, location_psgc, disability_type, show_disability } */
export async function updateCandidateProfile(profile) {
  const { data } = await api.put('/candidate/profile', profile);
  return data;
}

/** Replaces all needs. → [Accommodation] */
export async function updateNeeds(accommodationIds) {
  const { data } = await api.put('/candidate/accommodations', { accommodation_ids: accommodationIds });
  return data.data;
}

/** file: a PDF File → { resume_url } */
export async function uploadResume(file) {
  const body = new FormData();
  body.append('resume', file);
  const { data } = await api.post('/candidate/resume', body);
  return data;
}

// M3 Company

export async function getCompany() {
  const { data } = await api.get('/employer/company');
  return data;
}

/**
 * company: CompanyInput. With a logo File the request is multipart; Laravel needs
 * POST + _method=PUT for multipart bodies.
 */
export async function saveCompany({ logo, ...company }) {
  if (!logo) {
    const { data } = await api.put('/employer/company', company);
    return data;
  }

  const body = new FormData();
  Object.entries(company).forEach(([key, value]) => {
    if (value !== null && value !== undefined) body.append(key, value);
  });
  body.append('logo', logo);
  body.append('_method', 'PUT');
  const { data } = await api.post('/employer/company', body);
  return data;
}

/** Public employer page: EmployerPublic + open_postings */
export async function getEmployer(id) {
  const { data } = await api.get(`/employers/${id}`);
  return data;
}

/** { published, score, based_on, breakdown: [...] } */
export async function getTrustScore(employerId) {
  const { data } = await api.get(`/employers/${employerId}/trust-score`);
  return data;
}
