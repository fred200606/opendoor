import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../../api/auth.js';
import Alert, { ApiErrorAlert } from '../../components/Alert.jsx';
import Button from '../../components/Button.jsx';
import ErrorSummary from '../../components/form/ErrorSummary.jsx';
import { TextField } from '../../components/form/fields.jsx';
import Page from '../../components/Page.jsx';
import { useApiForm } from '../../hooks/useApiForm.js';

/** Forgot password: asks for the account's email. The answer never says whether the account exists. */
export default function ForgotPasswordPage() {
  const form = useApiForm({ email: '' });
  const [sentTo, setSentTo] = useState(null);
  const limited = form.formError?.code === 'RATE_LIMITED';

  async function handleSubmit(event) {
    event.preventDefault();
    const result = await form.submit((values) => forgotPassword(values.email));
    if (result) setSentTo(form.values.email.trim());
  }

  return (
    <Page title="Reset your password" className="page--narrow">
      {sentTo ? (
        <>
          <Alert type="success" live="polite" title="Check your email">
            <p>
              If an OpenDoor account exists for {sentTo}, we sent it a link to choose a new password. The link works for 60
              minutes.
            </p>
            <p>No email after a few minutes? Check your spam folder, or ask for a new link after a minute.</p>
          </Alert>
          <p className="actions">
            <Link to="/login" className="button">
              Back to log in
            </Link>
            <button type="button" className="button button--secondary" onClick={() => setSentTo(null)}>
              Send another link
            </button>
          </p>
        </>
      ) : (
        <>
          <p>Enter the email address of your OpenDoor account. We will send you a link to choose a new password.</p>
          <ErrorSummary errors={form.fieldErrors} fields={{ email: { id: 'email' } }} />
          {limited ? (
            <Alert type="error" live="assertive" title="Too many requests">
              <p>For your security, please wait one minute and try again.</p>
            </Alert>
          ) : (
            <ApiErrorAlert error={form.formError} title="The link was not sent" />
          )}
          <form onSubmit={handleSubmit} noValidate>
            <TextField label="Email address" type="email" autoComplete="email" required error={form.fieldErrors.email} {...form.bind('email')} />
            <Button type="submit" className="button" disabled={form.submitting}>
              {form.submitting ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>
          <p className="form-footer">
            Remembered it? <Link to="/login">Back to log in</Link>
          </p>
        </>
      )}
    </Page>
  );
}
