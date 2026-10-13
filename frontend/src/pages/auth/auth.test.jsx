import { screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { tokenStore } from '../../api/client.js';
import { apiError, renderApp, users, validationError } from '../../test/render.jsx';

describe('LoginPage', () => {
  test('logs in and opens the role portal', async () => {
    const { user, calls, location } = renderApp('/login', {
      routes: { 'POST /login': () => [200, { token: '5|new', user: users.employer }] },
    });

    await user.type(screen.getByLabelText(/Email address/), 'employer@opendoor.test');
    await user.type(screen.getByLabelText(/Password/), 'secret-password');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Welcome, Ana Reyes' })).toBeInTheDocument();
    expect(location()).toBe('/employer/dashboard');
    expect(tokenStore.get()).toBe('5|new');
    expect(calls.find((call) => call.key === 'POST /login').data).toEqual({ email: 'employer@opendoor.test', password: 'secret-password' });
  });

  test('Show password reveals the password and hides it again', async () => {
    const { user } = renderApp('/login');

    const password = screen.getByLabelText(/Password/);
    expect(password).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('checkbox', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('checkbox', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'password');
  });

  test('returns to the page the guest originally asked for', async () => {
    const { user, location } = renderApp('/candidate/dashboard', {
      routes: { 'POST /login': () => [200, { token: '5|new', user: users.candidate }] },
    });

    await user.type(await screen.findByLabelText(/Email address/), 'candidate@opendoor.test');
    await user.type(screen.getByLabelText(/Password/), 'secret-password');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    await screen.findByRole('heading', { level: 1, name: 'Welcome, Maria Santos' });
    expect(location()).toBe('/candidate/dashboard');
  });

  test('wrong credentials: error summary takes focus and the field is marked invalid', async () => {
    const { user } = renderApp('/login', {
      routes: { 'POST /login': () => validationError({ email: ['These credentials do not match our records.'] }) },
    });

    await user.type(screen.getByLabelText(/Email address/), 'x@example.com');
    await user.type(screen.getByLabelText(/Password/), 'nope');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    const summary = await screen.findByRole('alert');
    expect(summary).toHaveFocus();
    expect(summary).toHaveTextContent('These credentials do not match our records.');
    const email = screen.getByLabelText(/Email address/);
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveAccessibleDescription(/These credentials do not match our records/);
  });

  test.each([
    ['ACCOUNT_SUSPENDED', 403, 'Your account is suspended'],
    ['RATE_LIMITED', 429, 'Too many login attempts'],
  ])('%s gets a plain-language message', async (code, status, title) => {
    const { user } = renderApp('/login', { routes: { 'POST /login': () => apiError(status, code) } });

    await user.type(screen.getByLabelText(/Email address/), 'x@example.com');
    await user.type(screen.getByLabelText(/Password/), 'password');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(title);
  });

  test('a logged-in user visiting /login goes to their portal', async () => {
    const { location } = renderApp('/login', { as: 'admin' });

    await screen.findByRole('heading', { level: 1, name: 'Administration' });
    expect(location()).toBe('/admin/dashboard');
  });
});

describe('RegisterPage', () => {
  async function fillIn(user, { role = 'I am looking for a job', consent = true } = {}) {
    await user.click(screen.getByLabelText(role));
    await user.type(screen.getByLabelText(/Full name/), 'Juan Dela Cruz');
    await user.type(screen.getByLabelText(/Email address/), 'juan@example.com');
    await user.type(screen.getByLabelText(/^Password/), 'long-password-1');
    await user.type(screen.getByLabelText(/Confirm password/), 'long-password-1');
    if (consent) await user.click(screen.getByLabelText(/I agree/));
  }

  test('sends the contract fields and opens the candidate profile', async () => {
    const { user, calls, location } = renderApp('/register', {
      routes: { 'POST /register': () => [201, { token: '9|t', user: { ...users.candidate, name: 'Juan Dela Cruz' } }] },
    });

    await fillIn(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await screen.findByTestId('location');
    await vi.waitFor(() => expect(location()).toBe('/candidate/profile'));
    expect(calls.find((call) => call.key === 'POST /register').data).toEqual({
      name: 'Juan Dela Cruz',
      email: 'juan@example.com',
      password: 'long-password-1',
      password_confirmation: 'long-password-1',
      role: 'candidate',
      consent: true,
    });
  });

  test('employers start on the company page', async () => {
    const { user, location } = renderApp('/register', {
      routes: { 'POST /register': () => [201, { token: '9|t', user: users.employer }] },
    });

    await fillIn(user, { role: 'I am hiring' });
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await vi.waitFor(() => expect(location()).toBe('/employer/company'));
  });

  test('server errors are listed and linked to their fields', async () => {
    const { user } = renderApp('/register', {
      routes: {
        'POST /register': () =>
          validationError({
            email: ['The email has already been taken.'],
            consent: ['You must agree to the data privacy notice to create an account.'],
          }),
      },
    });

    await fillIn(user, { consent: false });
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    const summary = await screen.findByRole('alert');
    expect(summary).toHaveFocus();
    await user.click(screen.getByRole('link', { name: 'The email has already been taken.' }));
    expect(screen.getByLabelText(/Email address/)).toHaveFocus();
    expect(screen.getByLabelText(/I agree/)).toHaveAccessibleDescription(/must agree/);
  });
});

describe('Forgot and reset password', () => {
  const SENT = { message: 'If an account exists for this email, we sent a link to reset the password.' };

  test('Log in links to the form, which gives the same answer for every email', async () => {
    const { user, calls, location } = renderApp('/login', { routes: { 'POST /forgot-password': () => [200, SENT] } });

    await user.click(screen.getByRole('link', { name: 'Forgot your password?' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Reset your password' })).toBeInTheDocument();
    expect(location()).toBe('/forgot-password');

    await user.type(screen.getByLabelText(/Email address/), 'maria@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByText(/If an OpenDoor account exists for maria@example.com/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Check your email');
    expect(calls.find((call) => call.key === 'POST /forgot-password').data).toEqual({ email: 'maria@example.com' });
    expect(screen.getByRole('link', { name: 'Back to log in' })).toHaveAttribute('href', '/login');
  });

  test('too many requests and a wrong email format get plain messages', async () => {
    let answer = validationError({ email: ['The email field must be a valid email address.'] });
    const { user } = renderApp('/forgot-password', { routes: { 'POST /forgot-password': () => answer } });

    await user.type(await screen.findByLabelText(/Email address/), 'maria');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    await user.click(await screen.findByRole('link', { name: 'The email field must be a valid email address.' }));
    expect(screen.getByLabelText(/Email address/)).toHaveFocus();

    answer = apiError(429, 'RATE_LIMITED');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByText('Too many requests')).toBeInTheDocument();
  });

  test('the emailed link sets a new password and returns to Log in', async () => {
    const { user, calls, location } = renderApp('/reset-password?token=abc123&email=maria%40example.com', {
      routes: { 'POST /reset-password': () => [200, { message: 'Your password is changed. Log in with your new password.' }] },
    });

    expect(await screen.findByRole('heading', { level: 1, name: 'Choose a new password' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Email address/)).toHaveValue('maria@example.com');
    expect(screen.getByLabelText(/^New password/)).toHaveAttribute('autocomplete', 'new-password');
    await user.type(screen.getByLabelText(/^New password/), 'a-new-password');
    await user.type(screen.getByLabelText(/Confirm new password/), 'a-new-password');
    await user.click(screen.getByRole('button', { name: 'Save new password' }));

    expect(await screen.findByText('Your password is changed')).toBeInTheDocument();
    expect(location()).toBe('/login');
    expect(calls.find((call) => call.key === 'POST /reset-password').data).toEqual({
      token: 'abc123',
      email: 'maria@example.com',
      password: 'a-new-password',
      password_confirmation: 'a-new-password',
    });
  });

  test('an expired link offers a new one; a weak password is linked to its field', async () => {
    let answer = validationError({ password: ['The password field must be at least 8 characters.'] });
    const { user } = renderApp('/reset-password?token=old&email=maria%40example.com', { routes: { 'POST /reset-password': () => answer } });

    await user.type(await screen.findByLabelText(/^New password/), 'short');
    await user.type(screen.getByLabelText(/Confirm new password/), 'short');
    await user.click(screen.getByRole('button', { name: 'Save new password' }));
    expect(await screen.findByRole('link', { name: 'The password field must be at least 8 characters.' })).toBeInTheDocument();
    expect(screen.getByLabelText(/^New password/)).toHaveAttribute('aria-invalid', 'true');

    answer = validationError({ token: ['This reset link is invalid or has expired. Ask for a new one.'] });
    await user.click(screen.getByRole('button', { name: 'Save new password' }));
    expect(await screen.findByText('This link cannot be used')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ask for a new link' })).toHaveAttribute('href', '/forgot-password');
  });

  test('a link without a token says so', async () => {
    renderApp('/reset-password');

    expect(await screen.findByText('This link is incomplete')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ask for a new link' })).toHaveAttribute('href', '/forgot-password');
  });
});
