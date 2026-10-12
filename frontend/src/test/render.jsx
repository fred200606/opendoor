import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { tokenStore } from '../api/client.js';
import App from '../App.jsx';
import { AuthProvider } from '../auth/AuthContext.jsx';
import { fakeApi } from './fakeApi.js';

export const users = {
  candidate: { id: 2, name: 'Maria Santos', email: 'candidate@opendoor.test', role: 'candidate', is_active: true, email_notifications: true },
  employer: { id: 4, name: 'Ana Reyes', email: 'employer@opendoor.test', role: 'employer', is_active: true, email_notifications: true },
  admin: { id: 1, name: 'OpenDoor Admin', email: 'admin@opendoor.test', role: 'admin', is_active: true, email_notifications: true },
};

/** Shows the current path so tests can assert navigation. */
function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="location" hidden>
      {location.pathname + location.search}
    </output>
  );
}

/**
 * Renders the whole app at `path`. `as` logs in a user from `users` (GET /me answered automatically);
 * `routes` are extra fake API routes.
 */
export function renderApp(path, { as, routes = {} } = {}) {
  if (as) tokenStore.set('1|test-token');
  const calls = fakeApi({ ...(as ? { 'GET /me': () => [200, users[as]] } : {}), ...routes });

  const user = userEvent.setup();
  const utils = render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
        <Routes>
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );

  return { ...utils, user, calls, location: () => utils.getByTestId('location').textContent };
}

export const paged = (data, meta = {}) => ({
  data,
  meta: { current_page: 1, per_page: 12, total: data.length, last_page: 1, ...meta },
});

export const validationError = (errors) => [
  422,
  { message: 'The given data was invalid.', error: { code: 'VALIDATION_FAILED', request_id: 'req-422' }, errors },
];

export const apiError = (status, code, message = 'Error') => [status, { error: { code, message, request_id: `req-${status}` } }];
