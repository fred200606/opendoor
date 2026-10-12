import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../../api/auth.js';
import Alert, { ApiErrorAlert } from '../../components/Alert.jsx';
import Button from '../../components/Button.jsx';
import ErrorSummary from '../../components/form/ErrorSummary.jsx';
import { TextField } from '../../components/form/fields.jsx';
import Page from '../../components/Page.jsx';
import { useApiForm } from '../../hooks/useApiForm.js';
import { errorText } from '../../lib/errors.js';

const FIELDS = { email: { id: 'email' }, password: { id: 'password' } };

/** Opened from the emailed link: /reset-password?token=…&email=… */
export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  const form = useApiForm({ email: params.get('email') ?? '', password: '', passwordConfirmation: '' });
  // A wrong or expired link is not a field the user can fix: it gets its own message with a way out.
  const { token: linkError, ...fieldErrors } = form.fieldErrors;
  const limited = form.formError?.code === 'RATE_LIMITED';

  async function handleSubmit(event) {
    event.preventDefault();
    const result = await form.submit((values) => resetPassword({ token, ...values }));
    if (result) navigate('/login', { replace: true, state: { reason: 'reset' } });
  }

  if (!token) {
    return (
      <Page title="Choose a new password" className="page--narrow">
        <Alert type="error" title="This link is incomplete">
          <p>
            Open the link from the email again, or <Link to="/forgot-password">ask for a new link</Link>.
          </p>
        </Alert>
      </Page>
    );
  }

  return (
    <Page title="Choose a new password" className="page--narrow">
      {linkError && (
        <Alert type="error" live="assertive" title="This link cannot be used">
          <p>
            {errorText(linkError)} <Link to="/forgot-password">Ask for a new link</Link>
          </p>
        </Alert>
      )}
      <ErrorSummary errors={fieldErrors} fields={FIELDS} />
      {limited ? (
        <Alert type="error" live="assertive" title="Too many attempts">
          <p>For your security, please wait one minute and try again.</p>
        </Alert>
      ) : (
        <ApiErrorAlert error={form.formError} title="Your password was not changed" />
      )}

      <p>Choose a new password for your OpenDoor account. You will be signed out on all devices.</p>
      <form onSubmit={handleSubmit} noValidate>
        <TextField label="Email address" type="email" autoComplete="email" required error={fieldErrors.email} {...form.bind('email')} />
        <TextField
          label="New password"
          id="password"
          type="password"
          autoComplete="new-password"
          required
          hint="At least 8 characters."
          error={fieldErrors.password}
          {...form.bind('password')}
        />
        <TextField label="Confirm new password" id="password_confirmation" type="password" autoComplete="new-password" required {...form.bind('passwordConfirmation')} />
        <Button type="submit" className="button" disabled={form.submitting}>
          {form.submitting ? 'Saving…' : 'Save new password'}
        </Button>
      </form>
    </Page>
  );
}
