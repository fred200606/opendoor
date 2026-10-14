import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { updateEmailNotifications } from '../../api/account.js';
import { changePassword } from '../../api/auth.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { ROLE_LABELS } from '../../auth/roles.js';
import Alert, { ApiErrorAlert } from '../../components/Alert.jsx';
import Button from '../../components/Button.jsx';
import ErrorSummary from '../../components/form/ErrorSummary.jsx';
import { CheckboxField, RadioGroup, TextField } from '../../components/form/fields.jsx';
import Page from '../../components/Page.jsx';
import Tabs from '../../components/Tabs.jsx';
import WelcomeTour from '../../components/WelcomeTour.jsx';
import { useApiForm } from '../../hooks/useApiForm.js';
import { useDisplayPrefs } from '../../hooks/useDisplayPrefs.js';
import { useOnboarding } from '../../hooks/useOnboarding.js';
import { changeDisplayPrefs } from '../../lib/displayPrefs.js';

/** Figma 8:4194: one tab per kind of setting; ?tab= keeps the open tab on reload. */
export default function AccountPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tabs = [
    { id: 'display', label: 'Display', content: <DisplaySettings /> },
    { id: 'password', label: 'Password', content: <PasswordSection /> },
    // Administrators receive no notices, so there is nothing to email.
    ...(user.role !== 'admin' ? [{ id: 'email', label: 'Email notifications', content: <EmailSettings /> }] : []),
    // Onboarding is for job seekers and employers (null for administrators).
    ...(user.onboarding ? [{ id: 'onboarding', label: 'Getting started', content: <OnboardingSettings /> }] : []),
  ];

  return (
    <Page
      title="Account"
      subtitle={
        <p className="page__subtitle">
          {user.name} · {user.email} · {ROLE_LABELS[user.role]}
        </p>
      }
    >
      <Tabs
        label="Account settings"
        tabs={tabs}
        selected={params.get('tab') ?? 'display'}
        onSelect={(tab) => setParams(tab === 'display' ? {} : { tab }, { replace: true })}
      />
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

// Browser-only settings from the utility bar (decision 2026-10-13).
const QUIET = [
  { value: 'off', label: 'Show sparkles and colours' },
  { value: 'on', label: 'Quiet: plain and calm' },
];

const MENU = [
  { value: 'full', label: 'Show all links' },
  { value: 'compact', label: 'Compact: one Menu button' },
];

function DisplaySettings() {
  const prefs = useDisplayPrefs(); // also follows the utility bar
  const [message, setMessage] = useState(null); // { type, text }
  // Saves run one after another, so the account ends with the last choice even on a slow network;
  // only the last one reports.
  const saving = useRef(Promise.resolve());
  const latest = useRef(0);

  function change(key, value) {
    const id = ++latest.current;
    // Applies at once, also if the account cannot be reached.
    const saved = changeDisplayPrefs({ [key]: value }, { signedIn: true });
    saving.current = saving.current.then(async () => {
      const ok = await saved;
      if (id !== latest.current) return;
      if (key === 'quiet' || key === 'menu') {
        setMessage({ type: 'success', text: 'Applied on this device.' });
      } else if (ok) {
        setMessage({ type: 'success', text: 'Display settings applied and saved to your account.' });
      } else {
        setMessage({ type: 'warning', text: 'Display settings applied on this device, but not saved to your account. Change a setting to try again.' });
      }
    });
  }

  return (
    <section className="card" aria-labelledby="display-title">
      <h2 id="display-title" className="visually-hidden">
        Display
      </h2>
      <p className="muted">
        Changes apply right away and are saved to your account. Decoration and the top menu are kept on this device only.
      </p>
      <div className="display-grid">
        <RadioGroup legend="Text size" name="textSize" options={TEXT_SIZES} value={prefs.textSize} onChange={(value) => change('textSize', value)} />
        <RadioGroup legend="Colours" name="contrast" options={CONTRAST} value={prefs.contrast} onChange={(value) => change('contrast', value)} />
        <RadioGroup legend="Motion" name="motion" options={MOTION} value={prefs.motion} onChange={(value) => change('motion', value)} />
        <RadioGroup legend="Decoration" name="quiet" options={QUIET} value={prefs.quiet} onChange={(value) => change('quiet', value)} />
        <RadioGroup legend="Top menu" name="menu" options={MENU} value={prefs.menu} onChange={(value) => change('menu', value)} />
      </div>
      <div role="status">{message && <Alert type={message.type} title={message.text} />}</div>
    </section>
  );
}

/** M13: emails for the in-app notices. On by default; administrators receive no notices. */
function EmailSettings() {
  const { user, updateUser } = useAuth();
  const [enabled, setEnabled] = useState(user.email_notifications !== false);
  const [message, setMessage] = useState(null); // { type, text }
  // Same as the display settings: saves run in order and only the last one reports.
  const saving = useRef(Promise.resolve());
  const latest = useRef(0);

  function change(event) {
    const next = event.target.checked;
    setEnabled(next);
    const id = ++latest.current;
    saving.current = saving.current.then(async () => {
      try {
        await updateEmailNotifications(next);
        updateUser({ email_notifications: next });
        if (id === latest.current) {
          setMessage({ type: 'success', text: next ? 'Email notifications are on.' : 'Email notifications are off. You still see every notice under Notifications.' });
        }
      } catch {
        if (id === latest.current) {
          setEnabled(!next);
          setMessage({ type: 'error', text: 'Your choice was not saved. Please try again.' });
        }
      }
    });
  }

  return (
    <section className="card card--form" aria-labelledby="email-title">
      <h2 id="email-title" className="visually-hidden">
        Email notifications
      </h2>
      <CheckboxField
        name="email_notifications"
        label="Send me an email for each notification"
        hint="On by default. The email repeats the notice and links to OpenDoor. It never includes disability or accommodation details."
        checked={enabled}
        onChange={change}
      />
      <div role="status" className="account-result">
        {message && <Alert type={message.type} title={message.text} />}
      </div>

      {/* Figma 8:4487: what such an email looks like (a picture of one, not a working link). */}
      <figure className="email-example">
        <figcaption>Example email</figcaption>
        <div className="email-example__body">
          <p className="email-example__subject">Subject: Your application for Data Encoder is being reviewed</p>
          <p>Hello {user.name.split(' ')[0]}, Bayanihan Tech Solutions is reviewing your application.</p>
          <p>
            <span className="email-example__button">Open in OpenDoor</span>
          </p>
          <p className="email-example__footer">You can turn these emails off in Account settings. No disability or accommodation details are ever included.</p>
        </div>
      </figure>
    </section>
  );
}

/** Onboarding: the welcome tour again, and the dashboard's "Get started" list on or off. */
function OnboardingSettings() {
  const { user } = useAuth();
  const { onboarding, save } = useOnboarding();
  const [shown, setShown] = useState(!onboarding.checklist_hidden);
  const [message, setMessage] = useState(null); // { type, text }
  const [tour, setTour] = useState(false);
  // Same as the email switch: saves run in order and only the last one reports.
  const saving = useRef(Promise.resolve());
  const latest = useRef(0);

  function change(event) {
    const next = event.target.checked;
    setShown(next);
    const id = ++latest.current;
    saving.current = saving.current.then(async () => {
      try {
        await save({ checklist_hidden: !next });
        if (id === latest.current) {
          setMessage({ type: 'success', text: next ? 'The “Get started” list is on your dashboard until every step is done.' : 'The “Get started” list is hidden.' });
        }
      } catch {
        if (id === latest.current) {
          setShown(!next);
          setMessage({ type: 'error', text: 'Your choice was not saved. Please try again.' });
        }
      }
    });
  }

  return (
    <section className="card card--form" aria-labelledby="onboarding-title">
      <h2 id="onboarding-title" className="visually-hidden">
        Getting started
      </h2>
      <CheckboxField
        name="get_started"
        label="Show the “Get started” list on my dashboard"
        hint="It lists your first steps and goes away by itself when they are all done."
        checked={shown}
        onChange={change}
      />
      <div role="status" className="account-result">
        {message && <Alert type={message.type} title={message.text} />}
      </div>

      <p className="muted">The welcome tour explains in three short steps how OpenDoor works.</p>
      <Button className="button button--secondary" onClick={() => setTour(true)}>
        Show the welcome tour
      </Button>
      {tour && <WelcomeTour role={user.role} onClose={() => setTour(false)} />}
    </section>
  );
}

const PASSWORD_FIELDS ={ current_password: { id: 'current_password' }, password: { id: 'new_password' } };

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
    <section className="card card--form" aria-labelledby="password-title">
      <h2 id="password-title">Change password</h2>
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
      <div role="status" className="account-result">
        {done && (
          <Alert type="success" title="Your password is changed.">
            <p>You were signed out on your other devices.</p>
          </Alert>
        )}
      </div>
    </section>
  );
}
