import { api } from './client.js';

// M1 Auth – see docs/openapi.yaml

export async function register({ name, email, password, passwordConfirmation, role, consent }) {
  const { data } = await api.post('/register', {
    name,
    email,
    password,
    password_confirmation: passwordConfirmation,
    role,
    consent,
  });
  return data; // { token, user }
}

export async function login({ email, password }) {
  const { data } = await api.post('/login', { email, password });
  return data; // { token, user }
}

export async function logout() {
  await api.post('/logout');
}

export async function me() {
  const { data } = await api.get('/me');
  return data;
}

export async function changePassword({ currentPassword, password, passwordConfirmation }) {
  await api.put('/me/password', {
    current_password: currentPassword,
    password,
    password_confirmation: passwordConfirmation,
  });
}

// Forgot password (decision 2026-10-13)

/** The same answer for every email, so it never tells whether an account exists. */
export async function forgotPassword(email) {
  const { data } = await api.post('/forgot-password', { email });
  return data; // { message }
}

/** token and email come from the emailed link. */
export async function resetPassword({ token, email, password, passwordConfirmation }) {
  const { data } = await api.post('/reset-password', { token, email, password, password_confirmation: passwordConfirmation });
  return data; // { message }
}
