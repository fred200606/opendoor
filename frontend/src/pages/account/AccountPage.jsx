import { useRef, useState } from 'react';
import { updateDisplayPrefs } from '../../api/account.js';
import { changePassword } from '../../api/auth.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { ROLE_LABELS } from '../../auth/roles.js';
import Alert, { ApiErrorAlert } from '../../components/Alert.jsx';
import Button from '../../components/Button.jsx';
import ErrorSummary from '../../components/form/ErrorSummary.jsx';
import { RadioGroup, TextField } from '../../components/form/fields.jsx';
import Page from '../../components/Page.jsx';
import { useApiForm } from '../../hooks/useApiForm.js';
import { loadDisplayPrefs, saveDisplayPrefs, toApi } from '../../lib/displayPrefs.js';

export default function AccountPage() {
  const { user } = useAuth();

  return (
    <Page title="Account settings">
      <p>
        {user.name} · {user.email} · {ROLE_LABELS[user.role]}
      </p>
      <DisplaySettings />
      <PasswordSection />
    </Page>
  );
}

const TEXT_SIZES = [
  { value: '100', label: 'Standard' },
  { value: '125', label: 'Large (125%)' },
  { value: '150', label: 'Extra large (150%)' },
];

const CONTRAST = [
  { value: 'normal', label: 'Standard colours' },
  { value: 'high', label: 'High contrast' },
];

const MOTION = [
  { value: 'normal', label: 'Allow animations' },
  { value: 'reduce', label: 'Reduce motion' },
];

function DisplaySettings() {
  const [prefs, setPrefs] = useState(loadDisplayPrefs);
  const [message, setMessage] = useState('');
  // Saves run one after another, so the account ends with the last choice even on a slow network;
  // only the last one reports.
  const saving = useRef(Promise.resolve());
  const latest = useRef(0);

  function change(key, value) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    saveDisplayPrefs(next); // applies at once, also if the account cannot be reached
    const id = ++latest.current;
    saving.current = saving.current.then(async () => {
      let saved = true;
      try {
        await updateDisplayPrefs(toApi(next));
      } catch {
        saved = false;
      }
      if (id !== latest.current) return;
      setMessage(
        saved
          ? 'Display settings applied and saved to your account.'
          : 'Display settings applied on this device, but not saved to your account. Change a setting to try again.',
      );
    });
  }

  return (
    <section className="card" aria-labelledby="display-title">
      <h2 id="display-title">Display</h2>
      <p className="field__hint">Changes apply immediately and are saved to your account, so they also apply when you log in on another device.</p>
      <RadioGroup legend="Text size" name="textSize" options={TEXT_SIZES} value={prefs.textSize} onChange={(value) => change('textSize', value)} />
      <RadioGroup legend="Colours" name="contrast" options={CONTRAST} value={prefs.contrast} onChange={(value) => change('contrast', value)} />
      <RadioGroup legend="Motion" name="motion" options={MOTION} value={prefs.motion} onChange={(value) => change('motion', value)} />
      <p role="status" className="save-status">
        {message}
      </p>
    </section>
  );
}

const PASSWORD_FIELDS = { current_password: { id: 'current_password' }, password: { id: 'new_password' } };

function PasswordSection() {
  const form = useApiForm({ currentPassword: '', password: '', passwordConfirmation: '' });
  const [done, setDone] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setDone(false);
    const result = await form.submit(async (values) => {
      await changePassword(values);
      return true;
    });
    if (result) {
      form.setValues({ currentPassword: '', password: '', passwordConfirmation: '' });
      setDone(true);
    }
  }

  return (
    <section className="card" aria-labelledby="password-title">
      <h2 id="password-title">Change password</h2>
      {done && (
        <Alert type="success" live="polite">
          <p>Your password is changed. You were signed out on your other devices.</p>
        </Alert>
      )}
      <ErrorSummary errors={form.fieldErrors} fields={PASSWORD_FIELDS} />
      <ApiErrorAlert error={form.formError} title="Your password was not changed" />
      <form onSubmit={handleSubmit} noValidate>
        <TextField label="Current password" id="current_password" type="password" autoComplete="current-password" required error={form.fieldErrors.current_password} {...form.bind('currentPassword')} />
        <TextField label="New password" id="new_password" type="password" autoComplete="new-password" required hint="At least 8 characters, different from the current one." error={form.fieldErrors.password} {...form.bind('password')} />
        <TextField label="Confirm new password" id="new_password_confirmation" type="password" autoComplete="new-password" required {...form.bind('passwordConfirmation')} />
        <Button type="submit" className="button" disabled={form.submitting}>
          {form.submitting ? 'Changing…' : 'Change password'}
        </Button>
      </form>
    </section>
  );
}
