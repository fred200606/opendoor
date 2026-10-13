import { useEffect, useState } from 'react';
import { DISPLAY_CHANGED, loadDisplayPrefs } from '../lib/displayPrefs.js';

/** The current display settings, updated when the utility bar or Account settings change them. */
export function useDisplayPrefs() {
  const [prefs, setPrefs] = useState(loadDisplayPrefs);

  useEffect(() => {
    const update = (event) => setPrefs(event.detail ?? loadDisplayPrefs());
    window.addEventListener(DISPLAY_CHANGED, update);
    return () => window.removeEventListener(DISPLAY_CHANGED, update);
  }, []);

  return prefs;
}
