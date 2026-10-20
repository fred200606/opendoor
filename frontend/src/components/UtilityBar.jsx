import { ChevronDown, Contrast, Leaf, PanelLeft, Pin, Type } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { useDisplayPrefs } from '../hooks/useDisplayPrefs.js';
import { changeDisplayPrefs, TEXT_SIZE_LABELS, TEXT_SIZES } from '../lib/displayPrefs.js';

const BUTTON =
  'inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-xs font-bold text-accent transition-colors duration-200 ease-soft hover:bg-primary-soft aria-pressed:bg-selected sm:px-3';
const ICON = 'size-4 shrink-0';

/**
 * The strip above the header on every page, in the IPT look (Francis Ruzgal's opendoor-ipt,
 * decision 2026-10-21b): the skip link first, then the display settings one click away. Text size
 * steps through 100 → 125 → 150 %; the others are toggle buttons that say their state. Text size
 * and contrast are also saved to the account when signed in; Quiet mode, the compact menu and
 * "Keep open" stay in this browser. Each change is announced without moving focus.
 *
 * On screens with a mouse it folds into a thin line until pointed at, and opens whenever anything
 * in it has keyboard focus, so the skip link and every button stay reachable (index.css,
 * .od-utility). "Keep open" pins it; phones and tablets always show it.
 */
export default function UtilityBar() {
  const { user } = useAuth();
  const prefs = useDisplayPrefs();
  const [announcement, setAnnouncement] = useState('');

  function change(changes, message) {
    changeDisplayPrefs(changes, { signedIn: Boolean(user) });
    setAnnouncement(message);
  }

  const nextSize = TEXT_SIZES[(TEXT_SIZES.indexOf(prefs.textSize) + 1) % TEXT_SIZES.length];
  const highContrast = prefs.contrast === 'high';
  const quiet = prefs.quiet === 'on';
  const compact = prefs.menu === 'compact';
  const pinned = prefs.bar === 'pinned';

  return (
    <div className="od-utility relative z-30 print:hidden">
      <div className="od-utility-bar border-b border-border bg-yellow-soft">
        <p aria-hidden="true" className="od-utility-hint">
          <ChevronDown className="size-3.5" focusable="false" />
          Text size, contrast and more
        </p>
        <div className="od-utility-row mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 px-4 sm:px-6">
          {/* On phones the skip link shows only when focused, so the bar stays one line. */}
          <a
            href="#main"
            className="sr-only min-h-11 items-center text-xs font-bold text-text underline-offset-4 hover:underline focus:not-sr-only focus:inline-flex sm:not-sr-only sm:inline-flex"
          >
            Skip to main content
          </a>
          <div role="group" aria-label="Display settings" className="-mx-2 flex flex-wrap items-center justify-end sm:mx-0">
            <button type="button" className={BUTTON} onClick={() => change({ textSize: nextSize }, `Text size: ${TEXT_SIZE_LABELS[nextSize]}.`)}>
              <Type className={ICON} aria-hidden="true" focusable="false" />
              Text size <span className="sr-only">(now {TEXT_SIZE_LABELS[prefs.textSize]})</span>
            </button>
            <button
              type="button"
              className={BUTTON}
              aria-pressed={highContrast}
              onClick={() => change({ contrast: highContrast ? 'normal' : 'high' }, highContrast ? 'High contrast is off.' : 'High contrast is on.')}
            >
              <Contrast className={ICON} aria-hidden="true" focusable="false" />
              High contrast
            </button>
            <button
              type="button"
              className={BUTTON}
              aria-pressed={quiet}
              onClick={() => change({ quiet: quiet ? 'off' : 'on' }, quiet ? 'Quiet mode is off.' : 'Quiet mode is on.')}
            >
              <Leaf className={ICON} aria-hidden="true" focusable="false" />
              Quiet mode
            </button>
            <button
              type="button"
              className={BUTTON}
              onClick={() => change({ menu: compact ? 'full' : 'compact' }, compact ? 'All links are shown.' : 'The top menu is compact. Use the Menu button.')}
            >
              <PanelLeft className={ICON} aria-hidden="true" focusable="false" />
              {compact ? 'Show all links' : 'Compact menu'}
            </button>
            <button
              type="button"
              className={`${BUTTON.replace('inline-flex ', '')} od-pointer-only`}
              aria-pressed={pinned}
              onClick={() => change({ bar: pinned ? 'auto' : 'pinned' }, pinned ? 'The display bar folds away again.' : 'The display bar stays open.')}
            >
              <Pin className={ICON} aria-hidden="true" focusable="false" />
              Keep open
            </button>
          </div>
        </div>
        {/* A polite live region without role="status": the page's own status messages stay the only ones. */}
        <p className="sr-only" aria-live="polite">
          {announcement}
        </p>
      </div>
    </div>
  );
}
