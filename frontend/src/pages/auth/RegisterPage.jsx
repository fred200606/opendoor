import { useEffect, useMemo, useRef, useState } from 'react';
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
  password_confirmation: { id: 'password_confirmation' },
  role: { id: 'role' },
  consent: { id: 'consent' },
};

const ROLE_OPTIONS = [
  { value: 'candidate', label: 'I am looking for a job', hint: 'Find postings that offer the accommodations you need.' },
  { value: 'employer', label: 'I am hiring', hint: 'Post jobs and show the accommodations your workplace provides.' },
];

// Figma "3.6 Create account": three steps, one request at the end (the API is unchanged).
const STEPS = [
  { title: 'Your role', intro: 'Three short steps.', fields: ['role'] },
  { title: 'Your details', intro: 'Tell us how to reach you.', fields: ['name', 'email', 'password', 'password_confirmation'] },
  { title: 'Privacy and consent', intro: 'Almost done.', fields: ['consent'] },
];

/** The step that shows a field; errors for unknown fields stay on the last step. */
function stepOf(field) {
  const index = STEPS.findIndex((step) => step.fields.includes(field));
  return index === -1 ? STEPS.length - 1 : index;
}

/** Checks a step before moving on; the server checks everything again when the account is created. */
function checkStep(index, values) {
  const errors = {};
  if (index === 0 && !values.role) errors.role = ['Choose what brings you to OpenDoor.'];
  if (index === 1) {
    if (!values.name.trim()) errors.name = ['Enter your full name.'];
    if (!values.email.trim()) errors.email = ['Enter your email address.'];
    else if (!/^\S+@\S+\.\S+$/.test(values.email.trim())) errors.email = ['Enter an email address like name@example.com.'];
    if (values.password.length < 8) errors.password = ['The password must be at least 8 characters.'];
    else if (values.passwordConfirmation !== values.password) errors.password_confirmation = ['The two passwords do not match.'];
  }
  return errors;
}

export default function RegisterPage() {
  const { register } = useAuth();
  const form = useApiForm({ name: '', email: '', password: '', passwordConfirmation: '', role: '', consent: false });
  const [step, setStep] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const stepRef = useRef(null);
  const moved = useRef(false);
  const { fieldErrors, setFieldErrors } = form;

  // Only this step's messages are shown; the others wait until their step is open again.
  const stepErrors = useMemo(
    () => Object.fromEntries(Object.entries(fieldErrors).filter(([field]) => stepOf(field) === step)),
    [fieldErrors, step],
  );
  const hasStepErrors = Object.keys(stepErrors).length > 0;

  // After Next or Back, focus goes to the new step's heading (the error summary takes it instead when shown).
  useEffect(() => {
    if (moved.current && !hasStepErrors) stepRef.current?.focus();
    moved.current = false;
  }, [step, hasStepErrors]);

  function goTo(index) {
    moved.current = true;
    setStep(index);
  }

  function next(event) {
    event.preventDefault();
    const errors = checkStep(step, form.values);
    const others = Object.fromEntries(Object.entries(fieldErrors).filter(([field]) => stepOf(field) !== step));
    setFieldErrors({ ...others, ...errors });
    if (Object.keys(errors).length === 0) goTo(step + 1);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    // New employers start by describing their company; candidates by adding their needs.
    await form.submit(async (values) => {
      try {
        return await register(values, (user) => ({
          pathname: user.role === 'employer' ? '/employer/company' : '/candidate/profile',
          state: { welcome: true },
        }));
      } catch (error) {
        const fields = Object.keys(error?.fieldErrors ?? {});
        if (fields.length > 0) {
          const first = Math.min(...fields.map(stepOf));
          if (first !== step) goTo(first);
        }
        throw error;
      }
    });
  }

  const last = step === STEPS.length - 1;

  return (
    <Page
      title="Create account"
      documentTitle={`Create account (step ${step + 1} of ${STEPS.length})`}
      className="page--narrow register"
      subtitle={<p className="page__subtitle">{STEPS[step].intro}</p>}
    >
      <h2 ref={stepRef} tabIndex={-1} className="wizard__step">
        Step {step + 1} of {STEPS.length} · {STEPS[step].title}
      </h2>
      <div className="wizard__progress" aria-hidden="true">
        {STEPS.map((item, index) => (
          <span key={item.title} className={index <= step ? 'wizard__bar wizard__bar--done' : 'wizard__bar'} />
        ))}
      </div>

      <ErrorSummary errors={stepErrors} fields={FIELDS} />
      <ApiErrorAlert error={form.formError} title="We could not create your account" />

      <form onSubmit={last ? handleSubmit : next} noValidate>
        {step === 0 && (
          <RadioGroup
            legend="What brings you to OpenDoor?"
            name="role"
            required
            className="radio-cards"
            value={form.values.role}
            onChange={(value) => form.setValue('role', value)}
            options={ROLE_OPTIONS}
            error={stepErrors.role}
          />
        )}

        {step === 1 && (
          <>
            <TextField label="Full name" autoComplete="name" required error={stepErrors.name} {...form.bind('name')} />
            <TextField
              label="Email address"
              type="email"
              autoComplete="email"
              required
              hint="We never share it."
              error={stepErrors.email}
              {...form.bind('email')}
            />
            <TextField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              hint="At least 8 characters."
              error={stepErrors.password}
              {...form.bind('password')}
            />
            <TextField
              label="Confirm password"
              id="password_confirmation"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              error={stepErrors.password_confirmation}
              {...form.bind('passwordConfirmation')}
            />
            <CheckboxField id="show-password" label="Show password" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} />
          </>
        )}

        {step === 2 && (
          <>
            <section className="privacy-notice" aria-labelledby="privacy-title">
              <h3 id="privacy-title">Your privacy</h3>
              <p>
                OpenDoor stores your account details and, if you add them, the workplace accommodations you need. We use your
                accommodation needs only to match you with jobs. Employers see them only when you apply to their posting. Your
                disability type is optional, never used for matching, and hidden unless you choose to show it.
              </p>
              <p className="privacy-notice__law">This follows the Data Privacy Act of 2012 (RA 10173).</p>
            </section>
            <CheckboxField
              label="I agree that OpenDoor may process my personal data as described above."
              error={stepErrors.consent}
              {...form.bindCheckbox('consent')}
            />
          </>
        )}

        <div className="actions wizard__actions">
          {step > 0 && (
            <button type="button" className="button button--secondary" onClick={() => goTo(step - 1)}>
              Back
            </button>
          )}
          <Button type="submit" className="button" disabled={form.submitting}>
            {last ? (form.submitting ? 'Creating account…' : 'Create account') : 'Next'}
          </Button>
        </div>
      </form>

      {step === 0 && (
        <p className="form-footer">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      )}
    </Page>
  );
}
