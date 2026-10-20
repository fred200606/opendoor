import { Check } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { useAction } from '../hooks/useAction.js';
import { showsGetStarted, useOnboarding } from '../hooks/useOnboarding.js';
import Alert from './Alert.jsx';
import Button from './Button.jsx';
import WelcomeTour from './WelcomeTour.jsx';

/**
 * Onboarding "Get started" list on the dashboard (decision 2026-10-14). The steps come from the
 * user's own data, so they tick themselves: [{ id, title, done, hint?, link?: { to, label } }].
 * It goes away when every step is done or the user hides it (saved with the account; Account
 * settings can show it again).
 */
export default function GetStarted({ steps }) {
  const { user } = useAuth();
  const { onboarding, save } = useOnboarding();
  const hiding = useAction();
  const [justHidden, setJustHidden] = useState(false);
  const [tour, setTour] = useState(false);
  const message = useRef(null);
  const focusMessage = useRef(false);

  // The focused "Hide this list" button is gone: keep focus here, before the page's focus rescue moves it to the h1.
  useLayoutEffect(() => {
    if (justHidden && focusMessage.current) {
      focusMessage.current = false;
      message.current?.focus();
    }
  }, [justHidden]);

  if (onboarding?.checklist_hidden && justHidden) {
    return (
      <p ref={message} tabIndex={-1} className="get-started__hidden" role="status">
        The “Get started” list is hidden. You can show it again in <Link to="/account?tab=onboarding">Account settings</Link>.
      </p>
    );
  }
  if (!showsGetStarted(onboarding, steps)) return null;

  const done = steps.filter((step) => step.done).length;

  async function hide(event) {
    const hadFocus = document.activeElement === event.currentTarget;
    const saved = await hiding.run(() => save({ checklist_hidden: true }));
    if (saved) {
      focusMessage.current = hadFocus;
      setJustHidden(true);
    }
  }

  return (
    <section className="card get-started" aria-labelledby="get-started-title">
      <div className="get-started__header">
        <h2 id="get-started-title">Get started</h2>
        <p className="get-started__count">
          {done} of {steps.length} done
        </p>
      </div>
      <div className="wizard__progress get-started__progress" aria-hidden="true">
        {steps.map((step) => (
          <span key={step.id} className={step.done ? 'wizard__bar wizard__bar--done' : 'wizard__bar'} />
        ))}
      </div>

      <ol className="get-started__list">
        {steps.map((step) => (
          <li key={step.id} className={step.done ? 'get-started__step get-started__step--done' : 'get-started__step'}>
            <span className="get-started__mark" aria-hidden="true">
              {step.done && <Check focusable="false" />}
            </span>
            <div className="get-started__text">
              <p className="get-started__title">
                <span className="visually-hidden">{step.done ? 'Done: ' : 'To do: '}</span>
                {step.title}
              </p>
              {step.hint && !step.done && <p className="get-started__hint">{step.hint}</p>}
            </div>
            {!step.done && step.link && (
              <Link className="button button--small get-started__link" to={step.link.to}>
                {step.link.label}
              </Link>
            )}
          </li>
        ))}
      </ol>

      <div className="get-started__actions">
        <Button className="button button--link" onClick={() => setTour(true)}>
          Show the welcome tour
        </Button>
        <Button className="button button--link" disabled={hiding.busy} onClick={hide}>
          Hide this list
        </Button>
      </div>
      <div role="status">{hiding.error && <Alert type="error" title="The list was not hidden. Please try again." />}</div>

      {tour && <WelcomeTour role={user.role} listHint={false} onClose={() => setTour(false)} />}
    </section>
  );
}

/** The welcome tour on the first page after the first sign-in (AppLayout). */
export function FirstSignInTour() {
  const { user } = useAuth();
  const { onboarding, finishTour } = useOnboarding();
  // Job seekers first complete their profile (decision 2026-10-21); the tour waits for the dashboard.
  if (!user || onboarding?.tour_done !== false || user.profile_complete === false) return null;

  return <WelcomeTour role={user.role} listHint={!onboarding.checklist_hidden} onClose={finishTour} />;
}
