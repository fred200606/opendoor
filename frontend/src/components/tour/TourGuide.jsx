import { X } from 'lucide-react';
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Button from '../Button.jsx';
import useMascotStill from '../mascot/useMascotStill.js';
import { backdropPath, tourGeometry } from './tourGeometry.js';
import { TOUR_TITLE } from './tourSteps.js';

const MascotDoor = lazy(() => import('../mascot/MascotDoor.jsx'));
const MascotHappy = lazy(() => import('../mascot/MascotHappy.jsx'));

const LINK_BUTTON = 'inline-flex min-h-11 items-center text-sm font-bold text-primary underline underline-offset-4 hover:no-underline';
// Below this width the guide docks at the bottom of the screen instead of beside the part.
const DOCK_BELOW = 640;
// How long to look for a part before saying it is not on screen.
const FIND_FOR_MS = 5000;

const NEXT_STEP = {
  candidate: {
    text: 'A good next step: add the accommodations you need to your profile, so “Recommended for me” puts the right jobs first.',
    action: { to: '/candidate/profile', label: 'Go to my profile' },
  },
  employer: {
    text: 'A good next step: set up your company, so an administrator can verify it.',
    action: { to: '/employer/company', label: 'Set up company' },
  },
};

/** The first on-screen element named by data-tour (not inside a closed menu or hidden part). */
function findTarget(names) {
  for (const name of [names].flat()) {
    for (const node of document.querySelectorAll(`[data-tour="${name}"]`)) {
      if (!node.closest('[inert], [aria-hidden="true"]') && node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden') return node;
    }
  }
  return null;
}

/** The mascot beside the step: a short greeting on the first step and a cheer at the end, else still. */
function TourMascot({ happy, greet }) {
  const prefersStill = useMascotStill();
  const [finished, setFinished] = useState(false);
  useEffect(() => {
    if (!greet || prefersStill) return undefined;
    const timer = setTimeout(() => setFinished(true), happy ? 3200 : 4500);
    return () => clearTimeout(timer);
  }, [greet, happy, prefersStill]);
  const still = !greet || finished || prefersStill;
  return (
    <div aria-hidden="true" className={`od-tour-mascot shrink-0 overflow-hidden ${happy ? 'w-20' : 'w-12'}`}>
      <Suspense fallback={null}>
        {happy ? <MascotHappy forceStill={still} noConfetti className="w-full" /> : <MascotDoor forceStill={still} className="w-full" />}
      </Suspense>
    </div>
  );
}

/**
 * The welcome tour's card and spotlight (TourProvider runs it). The step's part of the screen is
 * outlined and the rest of the page is dimmed and blurred (index.css, .od-tour-*), with the card
 * beside it. The card is a labelled region, not a modal: the page stays usable, and "Go to this
 * section" moves focus into the part. Each step's heading takes focus; the arrow keys move through
 * the steps while focus is in the card.
 */
export default function TourGuide({ role, steps, index, done, onNext, onBack, onClose }) {
  const { pathname } = useLocation();
  const panel = useRef(null);
  const heading = useRef(null);
  const target = useRef(null);
  const [spotlight, setSpotlight] = useState(null);
  const [placement, setPlacement] = useState(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [compact, setCompact] = useState(false);
  const [status, setStatus] = useState('finding'); // finding | shown | missing
  const [retry, setRetry] = useState(0);
  const step = steps[index];
  const last = index === steps.length - 1;
  const here = !done && pathname === step.route;

  // A new step looks for its part again; a new page drops the old page's spotlight at once.
  const stepKey = `${index}:${done}:${pathname}:${retry}`;
  const [shownKey, setShownKey] = useState({ stepKey, pathname });
  if (shownKey.stepKey !== stepKey) {
    if (shownKey.pathname !== pathname || done) {
      setSpotlight(null);
      setPlacement(null);
    }
    setShownKey({ stepKey, pathname });
    setStatus('finding');
  }

  // After the page's own focus move (the guide comes after <main>, so this effect runs later).
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [index, done]);

  useLayoutEffect(() => {
    if (!here) return undefined;
    let stopped = false;
    let frame = 0;
    let scrolled = false;
    let timedOut = false;
    let marked = null;
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);

    function measure() {
      frame = 0;
      if (stopped) return;
      const found = findTarget(step.target);
      if (found !== marked) {
        marked?.classList.remove('od-tour-target');
        if (marked) resize?.unobserve(marked);
        marked = found;
        found?.classList.add('od-tour-target');
        if (found) resize?.observe(found);
      }
      target.current = found;
      if (!found) {
        setSpotlight(null);
        setPlacement(null);
        if (timedOut) setStatus('missing');
        return;
      }
      setStatus('shown');
      setCompact(found.getAttribute('data-tour') === 'compact-menu');
      const rect = found.getBoundingClientRect();
      if (!scrolled) {
        scrolled = true;
        if (rect.bottom < 0 || rect.top > window.innerHeight) {
          found.scrollIntoView?.({ block: 'center', behavior: 'instant' });
          schedule();
          return;
        }
      }
      const width = window.innerWidth;
      const height = window.innerHeight;
      const geometry = tourGeometry(rect, panel.current?.offsetWidth || 352, panel.current?.offsetHeight || 360, width, height);
      const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      setViewport((old) => (old.width === width && old.height === height ? old : { width, height }));
      setSpotlight((old) => (same(old, geometry.spotlight) ? old : geometry.spotlight));
      const docked = width < DOCK_BELOW ? null : geometry.placement;
      setPlacement((old) => (same(old, docked) ? old : docked));
    }
    function schedule() {
      if (!stopped && !frame) frame = requestAnimationFrame(measure);
    }

    // Parts that load late, open menus and the folding display bar move things: measure again.
    const mutations = new MutationObserver(schedule);
    mutations.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-expanded', 'data-open', 'inert', 'data-menu', 'data-text-size'],
    });
    if (panel.current) resize?.observe(panel.current);
    const timer = setTimeout(() => {
      timedOut = true;
      schedule();
    }, FIND_FOR_MS);
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    document.addEventListener('transitionend', schedule);
    measure();
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      resize?.disconnect();
      mutations.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
      document.removeEventListener('transitionend', schedule);
      marked?.classList.remove('od-tour-target');
      target.current = null;
    };
  }, [here, step, retry]);

  // Escape stops the tour, unless a menu or dialog uses it first.
  useEffect(() => {
    function onKeyDown(event) {
      if (event.key !== 'Escape' || event.defaultPrevented || event.target.closest?.('header, .od-utility, dialog')) return;
      onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // The arrow keys move through the steps while focus is in the card (not in a text field).
  useEffect(() => {
    const node = panel.current;
    if (!node || done) return undefined;
    function onKeyDown(event) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        onNext();
      } else if (event.key === 'ArrowLeft' && index > 0) {
        event.preventDefault();
        onBack();
      }
    }
    node.addEventListener('keydown', onKeyDown);
    return () => node.removeEventListener('keydown', onKeyDown);
  }, [done, index, onNext, onBack]);

  function goToSection() {
    const node = target.current;
    if (!node) return;
    const control = node.matches('a, button, input, select, textarea') ? node : node.querySelector('button, input, select, textarea, a[href]');
    const focus = control ?? node.querySelector('h1') ?? node;
    if (!focus.matches('a, button, input, select, textarea') && !focus.hasAttribute('tabindex')) focus.setAttribute('tabindex', '-1');
    focus.focus();
    focus.scrollIntoView?.({ block: 'center', behavior: 'instant' });
  }

  const nextStep = NEXT_STEP[role] ?? NEXT_STEP.candidate;
  const showSpotlight = here && spotlight && status === 'shown';

  return (
    <>
      {showSpotlight && (
        <>
          <div
            aria-hidden="true"
            className="od-tour-dim"
            style={{
              clipPath: backdropPath(spotlight, viewport.width, viewport.height),
            }}
          />
          <div aria-hidden="true" className="od-tour-ring" style={spotlight} />
        </>
      )}
      <aside
        ref={panel}
        aria-label="Welcome tour"
        className="od od-tour-card rounded-lg border-2 border-primary bg-surface p-5 text-text shadow-[0_18px_40px_rgba(36,27,58,0.28)] print:hidden"
        data-side={placement?.side}
        style={
          placement && !done
            ? {
                top: placement.top,
                left: placement.left,
                right: 'auto',
                bottom: 'auto',
              }
            : undefined
        }
      >
        <div className="flex items-start gap-3">
          <TourMascot key={done ? 'happy' : 'guide'} happy={done} greet={done || index === 0} />
          <div className="min-w-0 flex-1">
            {done ? (
              <p className="text-sm font-bold text-muted">{TOUR_TITLE}</p>
            ) : (
              <>
                <p aria-hidden="true" className="flex flex-wrap justify-between gap-x-3 text-sm font-bold text-muted">
                  <span>{TOUR_TITLE}</span>
                  <span>
                    Step {index + 1} of {steps.length}
                  </span>
                </p>
                <div aria-hidden="true" className="mt-2 flex gap-1">
                  {steps.map((item, itemIndex) => (
                    <span key={item.id} className={`h-1.5 flex-1 rounded-full ${itemIndex <= index ? 'bg-primary' : 'bg-primary-soft'}`} />
                  ))}
                </div>
              </>
            )}
            <h2 id="tour-heading" ref={heading} tabIndex={-1} className="mt-2 text-xl font-bold outline-none">
              {done ? (
                'That’s the quick tour!'
              ) : (
                <>
                  <span className="sr-only">
                    {TOUR_TITLE}, step {index + 1} of {steps.length}:
                  </span>{' '}
                  {step.title}
                </>
              )}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={done ? 'Close' : 'Close the tour'}
            className="grid size-11 shrink-0 place-items-center rounded-md border border-border text-text transition-colors duration-200 ease-soft hover:bg-primary-soft"
          >
            <X className="size-5" aria-hidden="true" focusable="false" />
          </button>
        </div>

        {done ? (
          <>
            <p className="mt-3">{nextStep.text}</p>
            <p className="mt-2 text-sm text-muted">You can take this tour again from your dashboard or Account settings.</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link to={nextStep.action.to} className="button">
                {nextStep.action.label}
              </Link>
              <Button className="button button--secondary" onClick={onClose}>
                Done
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-3">{compact && step.compactText ? step.compactText : step.text}</p>
            {here && status === 'finding' && <p className="mt-3 text-sm text-muted">Finding this part of the page…</p>}
            {here && status === 'missing' && (
              <div className="mt-3 rounded-md border border-border bg-subtle p-3">
                <p className="font-bold">This part is not on the screen right now.</p>
                <p className="mt-1 text-sm">You can look again, read on, or finish later.</p>
                <button type="button" className={LINK_BUTTON} onClick={() => setRetry((value) => value + 1)}>
                  Look again
                </button>
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {index > 0 && (
                <Button className="button button--secondary" aria-keyshortcuts="ArrowLeft" onClick={onBack}>
                  Back
                </Button>
              )}
              <Button className="button ml-auto" aria-keyshortcuts="ArrowRight" onClick={onNext}>
                {last ? 'Finish' : 'Next'}
              </Button>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4">
              {status === 'shown' && (
                <button type="button" className={LINK_BUTTON} onClick={goToSection}>
                  Go to this section
                </button>
              )}
              <button type="button" className={LINK_BUTTON} onClick={onClose}>
                Finish later
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
