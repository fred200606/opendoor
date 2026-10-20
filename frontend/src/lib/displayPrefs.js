// Display settings. Kept in this browser (applied before the first render, also for guests).
// Text size, contrast and motion (M13) are also saved with the account (PUT /me/display-prefs) so
// they follow a signed-in user to other devices; the account's settings are applied after login.
// Quiet mode, the compact menu (Figma design, 2026-10-13) and keeping the display bar open (IPT look,
// decision 2026-10-21b) stay in this browser only.

import { updateDisplayPrefs } from '../api/account.js';

const KEY = 'opendoor.display';
export const DISPLAY_CHANGED = 'opendoor:display-changed';

export const DEFAULT_PREFS = { textSize: '100', contrast: 'normal', motion: 'normal', quiet: 'off', menu: 'full', bar: 'auto' };
export const TEXT_SIZES = ['100', '125', '150'];
export const TEXT_SIZE_LABELS = { 100: 'Standard', 125: 'Large (125%)', 150: 'Extra large (150%)' };
const ACCOUNT_KEYS = ['textSize', 'contrast', 'motion'];

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
  root.dataset.quiet = prefs.quiet;
  root.dataset.menu = prefs.menu;
  root.dataset.bar = prefs.bar;
}

/** Stores and applies the settings, and tells every open control (utility bar, Account settings). */
export function saveDisplayPrefs(prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* applied for this visit only */
  }
  applyDisplayPrefs(prefs);
  window.dispatchEvent(new CustomEvent(DISPLAY_CHANGED, { detail: prefs }));
}

/**
 * Changes some settings now; when signed in and an account setting changed, saves the account
 * copy too. Resolves to true when the account was saved (or nothing needed saving).
 */
export async function changeDisplayPrefs(changes, { signedIn = false } = {}) {
  const next = { ...loadDisplayPrefs(), ...changes };
  saveDisplayPrefs(next);
  if (!signedIn || !ACCOUNT_KEYS.some((key) => key in changes)) return true;
  try {
    await updateDisplayPrefs(toApi(next));
    return true;
  } catch {
    return false;
  }
}

/** API shape `{ text_size, contrast, motion }` ↔ the app's `{ textSize, contrast, motion }`. */
export const fromApi = ({ text_size: textSize, contrast, motion }) => ({ textSize, contrast, motion });
export const toApi = ({ textSize, contrast, motion }) => ({ text_size: textSize, contrast, motion });
