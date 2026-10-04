import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';
import { tokenStore } from '../api/client.js';
import App from '../App.jsx';
import { fakeApi } from '../test/fakeApi.js';
import { AuthProvider } from './AuthContext.jsx';
import { homeFor } from './roles.js';

const users = {
  candidate: { id: 2, name: 'Maria Santos', email: 'candidate@opendoor.test', role: 'candidate', is_active: true },
  employer: { id: 4, name: 'Ana Reyes', email: 'employer@opendoor.test', role: 'employer', is_active: true },
};

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

function loggedInAs(user) {
  tokenStore.set('1|token');
  return fakeApi({ 'GET /me': () => [200, user] });
}

describe('role routing', () => {
  test('homeFor sends each role to its own dashboard', () => {
    expect(homeFor('candidate')).toBe('/candidate/dashboard');
    expect(homeFor('employer')).toBe('/employer/dashboard');
    expect(homeFor('admin')).toBe('/admin/dashboard');
    expect(homeFor(undefined)).toBe('/');
  });

  test('a guest opening a portal page is sent to log in', async () => {
    fakeApi({});
    renderAt('/employer/dashboard');

    expect(await screen.findByRole('heading', { level: 1, name: 'Log in' })).toBeInTheDocument();
  });

  test('a stored token restores the session and opens the portal', async () => {
    const calls = loggedInAs(users.candidate);
    renderAt('/candidate/dashboard');

    expect(screen.getByRole('status')).toHaveTextContent('Checking your session');
    expect(await screen.findByRole('heading', { level: 1, name: 'Welcome, Maria Santos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
    expect(calls.map((call) => call.key)).toEqual(['GET /me']);
  });

  test("a user opening another role's portal is sent to their own", async () => {
    loggedInAs(users.employer);
    renderAt('/candidate/dashboard');

    expect(await screen.findByRole('heading', { level: 1, name: 'Welcome, Ana Reyes' })).toBeInTheDocument();
    expect(screen.getByText(/logged in as employer/)).toBeInTheDocument();
  });

  test('an expired token is dropped and the guest view is shown', async () => {
    tokenStore.set('1|expired');
    fakeApi({ 'GET /me': () => [401, { error: { code: 'UNAUTHENTICATED', message: 'Unauthenticated.', request_id: 'r' } }] });
    renderAt('/admin/dashboard');

    expect(await screen.findByRole('heading', { level: 1, name: 'Log in' })).toBeInTheDocument();
    expect(tokenStore.get()).toBeNull();
    expect(screen.getByRole('link', { name: 'Create account' })).toBeInTheDocument();
  });

  test('logging out revokes the token and returns to the home page', async () => {
    tokenStore.set('1|token');
    const calls = fakeApi({ 'GET /me': () => [200, users.candidate], 'POST /logout': () => [204, ''] });
    renderAt('/candidate/dashboard');

    (await screen.findByRole('button', { name: 'Log out' })).click();

    expect(await screen.findByRole('heading', { level: 1, name: 'Find work that fits how you work' })).toBeInTheDocument();
    expect(tokenStore.get()).toBeNull();
    expect(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Log in' })).toBeInTheDocument();
    expect(calls.map((call) => call.key)).toEqual(['GET /me', 'POST /logout']);
  });

  test('every page has a skip link to the main content', async () => {
    fakeApi({});
    renderAt('/');

    const skip = screen.getByRole('link', { name: 'Skip to main content' });
    expect(skip).toHaveAttribute('href', '#main');
    expect(document.getElementById('main')).toBeInTheDocument();
  });

  test('unknown pages show a not-found message', async () => {
    fakeApi({});
    renderAt('/no-such-page');

    expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
  });
});
