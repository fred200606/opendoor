import { useSyncExternalStore } from 'react';
import { useDisplayPrefs } from '../../hooks/useDisplayPrefs.js';

// From opendoor-ipt by Francis Ruzgal (Decision 2026-10-21b), on our display settings.

const QUERY = '(prefers-reduced-motion: reduce)';
const subscribe = (onChange) => {
  if (typeof window.matchMedia !== 'function') return () => {};
  const list = window.matchMedia(QUERY);
  list.addEventListener?.('change', onChange);
  return () => list.removeEventListener?.('change', onChange);
};
const systemReduces = () => typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches;

/**
 * Whether the mascot animations hold still: Reduce motion (the system setting or the display
 * settings) or Quiet mode. They then show one calm frame instead of moving.
 */
export default function useMascotStill() {
  const prefs = useDisplayPrefs();
  const system = useSyncExternalStore(subscribe, systemReduces, () => false);
  return system || prefs.motion === 'reduce' || prefs.quiet === 'on';
}
