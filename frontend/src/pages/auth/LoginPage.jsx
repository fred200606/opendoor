import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Alert, { ApiErrorAlert } from '../../components/Alert.jsx';
import Button from '../../components/Button.jsx';
import ErrorSummary from '../../components/form/ErrorSummary.jsx';
import { CheckboxField, TextField } from '../../components/form/fields.jsx';
import Page from '../../components/Page.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { homeFor } from '../../auth/roles.js';
import { useApiForm } from '../../hooks/useApiForm.js';

const FIELDS = { email: { id: 'email' }, password: { id: 'password' } };

const MESSAGES = {
  ACCOUNT_SUSPENDED: {
    title: 'Your account is suspended',
    text: 'Please contact the OpenDoor administrator if you think this is a mistake.',
  },
  RATE_LIMITED: {
    title: 'Too many login attempts',
    text: 'For your security, please wait one minute and try again.',
  },
};

/** Return to the page the user was sent away from, but only within their own portal. */
function destinationFor(user, from) {
  const home = homeFor(user.role);
  const path = from?.pathname;
  if (!path || path === '/login') return { pathname: home };
  const otherPortal = /^\/(candidate|employer|admin)\//.test(path) && !path.startsWith(`/${user.role}/`);
  return { pathname: otherPortal ? home : path + (from.search ?? '') };
}

export default function LoginPage() {
  const { login } = useAuth();
  const location = useLocation();
  const form = useApiForm({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const expired = location.state?.reason === 'expired';
  const passwordReset = location.state?.reason === 'reset';
  const known = form.formError && MESSAGES[form.formError.code];

  async function handleSubmit(event) {
    event.preventDefault();
    await form.submit((values) => login(values, (user) => destinationFor(user, location.state?.from)));
  }

  return (
    <Page title="Log in" className="page--narrow" subtitle={<p className="page__subtitle">Use your email and password.</p>}>
      {expired && !form.formError && (
        <Alert type="info" title="Your session has ended">
          <p>Please log in again to continue.</p>
        </Alert>
      )}
      {passwordReset && !form.formError && (
        <Alert type="success" live="polite" title="Your password is changed">
          <p>Log in with your new password.</p>
        </Alert>
      )}

      <ErrorSummary errors={form.fieldErrors} fields={FIELDS} />
      {known ? (
        <Alert type="error" live="assertive" title={known.title}>
          <p>{known.text}</p>
        </Alert>
      ) : (
        <ApiErrorAlert error={form.formError} title="We could not log you in" />
      )}

      <form className="card form-card" onSubmit={handleSubmit} noValidate>
        <TextField
          label="Email address"
          type="email"
          autoComplete="email"
          required
          error={form.fieldErrors.email}
          {...form.bind('email')}
        />
        <TextField
          label="Password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          required
          error={form.fieldErrors.password}
          {...form.bind('password')}
        />
        <div className="form-row">
          <CheckboxField id="show-password" label="Show password" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} />
          <Link to="/forgot-password" className="form-row__link">
            Forgot your password?
          </Link>
        </div>
        <Button type="submit" className="button button--block" disabled={form.submitting}>
          {form.submitting ? 'Logging in…' : 'Log in'}
        </Button>
        <p className="form-card__footer">
          New to OpenDoor? <Link to="/register">Create an account</Link>
        </p>
      </form>
    </Page>
  );
}
