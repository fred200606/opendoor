import { useId } from 'react';

/**
 * A prefix for the ids inside one mascot drawing, so two on a page never share a filter, mask or
 * part. `$(name)` finds a part by its unprefixed name inside `root`.
 */
export function useSvgPrefix() {
  return `m${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
}

export function partFinder(root, prefix) {
  return (name) => root.querySelector(`#${prefix}${name}`);
}

// Small helpers the drawings share.
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const ease = {
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t,
  outBack: (t, c = 1.7) => {
    const u = t - 1;
    return 1 + (c + 1) * u * u * u + c * u * u;
  },
};

/**
 * Runs `frame(seconds)` at `fps` while the drawing is on screen and the tab is visible; returns a
 * stop function. `onTick(seconds)` may return false to stop for good.
 */
export function runClock(svg, fps, frame) {
  let raf = 0;
  let last = -1;
  let onScreen = true;
  const t0 = performance.now();
  function loop(now) {
    const q = Math.floor(((now - t0) / 1000) * fps);
    if (q !== last) {
      last = q;
      if (frame(q / fps) === false) {
        raf = 0;
        return;
      }
    }
    raf = requestAnimationFrame(loop);
  }
  const start = () => {
    if (!raf && onScreen && !document.hidden) raf = requestAnimationFrame(loop);
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };
  let observer;
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      if (onScreen) start();
      else stop();
    });
    observer.observe(svg);
  }
  const onVisibility = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVisibility);
  start();
  return () => {
    stop();
    observer?.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
