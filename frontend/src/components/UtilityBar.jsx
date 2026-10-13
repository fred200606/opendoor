import { Contrast, Leaf, PanelLeft, Type } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { useDisplayPrefs } from '../hooks/useDisplayPrefs.js';
import { changeDisplayPrefs, TEXT_SIZE_LABELS, TEXT_SIZES } from '../lib/displayPrefs.js';

/**
 * Figma "Utility bar": display shortcuts at the top of every page. "Skip to main content" is the
 * first focusable element. Text size and contrast are also saved to the account when signed in;
 * Quiet mode and the compact menu stay in this browser. Each change is announced.
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

  return (
    <div className="utility-bar">
      <div className="utility-bar__inner">
        <a className="utility-bar__skip" href="#main">
          Skip to main content
        </a>
        <button type="button" className="utility-bar__button" onClick={() => change({ textSize: nextSize }, `Text size: ${TEXT_SIZE_LABELS[nextSize]}.`)}>
          <Type aria-hidden="true" focusable="false" />
          Text size <span className="visually-hidden">(now {TEXT_SIZE_LABELS[prefs.textSize]})</span>
        </button>
        <button
          type="button"
          className="utility-bar__button"
          aria-pressed={highContrast}
          onClick={() => change({ contrast: highContrast ? 'normal' : 'high' }, highContrast ? 'High contrast is off.' : 'High contrast is on.')}
        >
          <Contrast aria-hidden="true" focusable="false" />
          High contrast
        </button>
        <button
          type="button"
          className="utility-bar__button"
          aria-pressed={quiet}
          onClick={() => change({ quiet: quiet ? 'off' : 'on' }, quiet ? 'Quiet mode is off.' : 'Quiet mode is on.')}
        >
          <Leaf aria-hidden="true" focusable="false" />
          Quiet mode
        </button>
        <button
          type="button"
          className="utility-bar__button"
          onClick={() => change({ menu: compact ? 'full' : 'compact' }, compact ? 'All links are shown.' : 'The top menu is compact. Use the Menu button.')}
        >
          <PanelLeft aria-hidden="true" focusable="false" />
          {compact ? 'Show all links' : 'Compact menu'}
        </button>
        {/* A polite live region without role="status": the page's own status messages stay the only ones. */}
        <p className="visually-hidden" aria-live="polite">
          {announcement}
        </p>
      </div>
    </div>
  );
}
