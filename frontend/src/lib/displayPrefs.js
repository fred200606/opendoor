// M13 display settings. Kept in this browser (applied before the first render, also for guests)
// and, for a signed-in user, saved with the account (PUT /me/display-prefs) so they follow the
// user to other devices; the account's settings are applied after login.

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

/** API shape `{ text_size, contrast, motion }` ↔ the app's `{ textSize, contrast, motion }`. */
export const fromApi = ({ text_size: textSize, contrast, motion }) => ({ textSize, contrast, motion });
export const toApi = ({ textSize, contrast, motion }) => ({ text_size: textSize, contrast, motion });
