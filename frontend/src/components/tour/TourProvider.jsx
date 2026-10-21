import { useCallback, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { homeFor } from '../../auth/roles.js';
import { useOnboarding } from '../../hooks/useOnboarding.js';
import { TourContext } from './tourContext.js';
import TourGuide from './TourGuide.jsx';
import { TOUR_STEPS } from './tourSteps.js';

// "Finish later" keeps the step in this browser, so the tour can continue there.
const savedKey = (userId) => `opendoor.tour.${userId}`;

function readSaved(userId) {
  try {
    const value = Number(localStorage.getItem(savedKey(userId)));
    return Number.isInteger(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function writeSaved(userId, index) {
  try {
    if (index > 0) localStorage.setItem(savedKey(userId), String(index));
    else localStorage.removeItem(savedKey(userId));
  } catch {
    // Storage blocked: the tour just starts from the beginning next time.
  }
}

/**
 * The welcome tour (decision 2026-10-21f, after opendoor-ipt's coachmark tour): steps across the
 * role's pages that each point at one part of the screen, the rest of the page dimmed. It starts
 * by itself on the dashboard after the first sign-in (job seekers after their profile setup), and
 * the "Get started" list and Account settings start it again.
 *
 * Close, "Finish later" and Escape stop it where it is (the next start continues there); after the
 * first sign-in any of these, or finishing, saves the tour as done. Going to another page yourself
 * also stops it, without saving. `children` is the page frame; the guide comes after it, so its
 * heading takes focus after the new page's <h1> does.
 */
export default function TourProvider({ children }) {
  const { user } = useAuth();
  const { onboarding, finishTour } = useOnboarding();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const steps = TOUR_STEPS[user?.role] ?? null;
  const userId = user?.id;

  // run: null (not running) or { index, first, done }.
  const [run, setRun] = useState(null);
  const [stopped, setStopped] = useState(false);
  const [shownPath, setShownPath] = useState(pathname);
  const launcher = useRef(null);

  // After the first sign-in it opens by itself on the dashboard, until stopped in this visit.
  const firstRun = Boolean(steps) && onboarding?.tour_done === false && user?.profile_complete !== false;
  const auto = !run && !stopped && firstRun && pathname === homeFor(user?.role);
  const current = run ?? (auto ? { index: 0, first: true, done: false } : null);

  // A page the tour did not open stops it (and closes the last card), without saving anything.
  if (shownPath !== pathname) {
    setShownPath(pathname);
    if (run && (run.done || pathname !== steps?.[run.index]?.route)) {
      setRun(null);
      setStopped(true);
    }
  }

  const goTo = useCallback(
    (index, base) => {
      setRun({ ...base, index, done: false });
      writeSaved(userId, index);
      // The card keeps focus: the new page does not move it to its <h1> (Page).
      if (pathname !== steps[index].route) navigate(steps[index].route, { state: { tour: true } });
    },
    [navigate, pathname, steps, userId],
  );

  const returnFocus = useCallback(() => {
    requestAnimationFrame(() => {
      const target = launcher.current?.isConnected ? launcher.current : document.querySelector('main h1');
      target?.focus();
    });
  }, []);

  function close() {
    // Finishing has saved it already.
    if (current?.first && !current.done) finishTour();
    setRun(null);
    setStopped(true);
    returnFocus();
  }

  const start = useCallback(() => {
    if (!steps) return;
    launcher.current = document.activeElement;
    setStopped(false);
    goTo(Math.min(readSaved(userId), steps.length - 1), { first: false });
  }, [goTo, steps, userId]);

  // Read on every render: the saved step changes as the tour moves.
  const value = { start, canResume: Boolean(steps) && readSaved(userId) > 0 };

  function next() {
    if (current.index < steps.length - 1) {
      goTo(current.index + 1, current);
      return;
    }
    writeSaved(userId, 0);
    if (current.first) finishTour();
    setRun({ ...current, done: true });
  }

  return (
    <TourContext.Provider value={value}>
      {children}
      {current && (
        <TourGuide
          role={user.role}
          steps={steps}
          index={current.index}
          done={current.done}
          onNext={next}
          onBack={() => goTo(current.index - 1, current)}
          onClose={close}
        />
      )}
    </TourContext.Provider>
  );
}
