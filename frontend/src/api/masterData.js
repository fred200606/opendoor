import { api } from './client.js';

// M11 Master data

/** [{ id, name }] sorted by name */
export async function getCategories() {
  const { data } = await api.get('/categories');
  return data.data;
}

/** [{ group, label, items: [Accommodation] }] – active types only */
export async function getAccommodationGroups() {
  const { data } = await api.get('/accommodations');
  return data.data;
}

// Admin

export async function adminListAccommodations() {
  const { data } = await api.get('/admin/accommodations');
  return data.data;
}

export async function adminCreateCategory(category) {
  const { data } = await api.post('/admin/categories', category);
  return data;
}

export async function adminUpdateCategory(id, category) {
  const { data } = await api.put(`/admin/categories/${id}`, category);
  return data;
}

export async function adminDeleteCategory(id) {
  await api.delete(`/admin/categories/${id}`);
}

export async function adminCreateAccommodation(accommodation) {
  const { data } = await api.post('/admin/accommodations', accommodation);
  return data;
}

export async function adminUpdateAccommodation(id, accommodation) {
  const { data } = await api.put(`/admin/accommodations/${id}`, accommodation);
  return data;
}

/** Returns { deleted: true } or { deleted: false, accommodation } when it was retired (in use). */
export async function adminDeleteAccommodation(id) {
  const response = await api.delete(`/admin/accommodations/${id}`);
  return response.status === 204 ? { deleted: true } : { deleted: false, accommodation: response.data };
}
