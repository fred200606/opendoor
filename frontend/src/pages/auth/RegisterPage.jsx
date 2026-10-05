import { Link } from 'react-router-dom';
import { ApiErrorAlert } from '../../components/Alert.jsx';
import Button from '../../components/Button.jsx';
import ErrorSummary from '../../components/form/ErrorSummary.jsx';
import { CheckboxField, RadioGroup, TextField } from '../../components/form/fields.jsx';
import Page from '../../components/Page.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useApiForm } from '../../hooks/useApiForm.js';

const FIELDS = {
  name: { id: 'name' },
  email: { id: 'email' },
  password: { id: 'password' },
  role: { id: 'role' },
  consent: { id: 'consent' },
};

const ROLE_OPTIONS = [
  { value: 'candidate', label: 'I am looking for a job', hint: 'Find postings that offer the accommodations you need.' },
  { value: 'employer', label: 'I am hiring', hint: 'Post jobs and show the accommodations your workplace provides.' },
];

export default function RegisterPage() {
  const { register } = useAuth();
  const form = useApiForm({ name: '', email: '', password: '', passwordConfirmation: '', role: '', consent: false });

  async function handleSubmit(event) {
    event.preventDefault();
    // New employers start by describing their company; candidates by adding their needs.
    await form.submit((values) =>
      register(values, (user) => ({
        pathname: user.role === 'employer' ? '/employer/company' : '/candidate/profile',
        state: { welcome: true },
      })),
    );
  }

  return (
    <Page title="Create an account" className="page--narrow">
      <ErrorSummary errors={form.fieldErrors} fields={FIELDS} />
      <ApiErrorAlert error={form.formError} title="We could not create your account" />

      <form onSubmit={handleSubmit} noValidate>
        <RadioGroup
          legend="What brings you to OpenDoor?"
          name="role"
          required
          value={form.values.role}
          onChange={(value) => form.setValue('role', value)}
          options={ROLE_OPTIONS}
          error={form.fieldErrors.role}
        />
        <TextField label="Full name" autoComplete="name" required error={form.fieldErrors.name} {...form.bind('name')} />
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
          type="password"
          autoComplete="new-password"
          required
          hint="At least 8 characters."
          error={form.fieldErrors.password}
          {...form.bind('password')}
        />
        <TextField
          label="Confirm password"
          id="password_confirmation"
          type="password"
          autoComplete="new-password"
          required
          {...form.bind('passwordConfirmation')}
        />

        <section className="privacy-notice" aria-labelledby="privacy-title">
          <h2 id="privacy-title">Your privacy</h2>
          <p>
            OpenDoor stores your account details and, if you add them, the workplace accommodations you need. We use your
            accommodation needs only to match you with jobs. Employers see them only when you apply to their posting. Your
            disability type is optional, never used for matching, and hidden unless you choose to show it. This follows the
            Data Privacy Act of 2012 (RA 10173).
          </p>
        </section>
        <CheckboxField
          label="I agree that OpenDoor may process my personal data as described above."
          error={form.fieldErrors.consent}
          {...form.bindCheckbox('consent')}
        />

        <Button type="submit" className="button" disabled={form.submitting}>
          {form.submitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <p className="form-footer">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </Page>
  );
}
