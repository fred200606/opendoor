// M13 display settings. Stored in this browser only until the API exposes users.display_prefs.

const KEY = 'opendoor.display';

export const DEFAULT_PREFS = { textSize: '100', contrast: 'normal', motion: 'normal' };

export function loadDisplayPrefs() {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

/** Applies the settings as data attributes on <html>; index.css reacts to them. */
export function applyDisplayPrefs(prefs) {
  const root = document.documentElement;
  root.dataset.textSize = prefs.textSize;
  root.dataset.contrast = prefs.contrast;
  root.dataset.motion = prefs.motion;
}

export function saveDisplayPrefs(prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* applied for this visit only */
  }
  applyDisplayPrefs(prefs);
}
