// From Francis Ruzgal's opendoor-ipt (onboarding/tourGeometry.js). Viewport pixels throughout,
// for position: fixed, so measuring never changes the page's layout.
const GAP = 16;
const PAD = 8;
export const SPOTLIGHT_RADIUS = 10;

const clamp = (value, min, max) => Math.max(min, Math.min(value, Math.max(min, max)));

/**
 * rect (the target's bounding box), the panel's size and the viewport → { spotlight, placement }.
 * The spotlight is the target plus 8 px, kept on screen; the panel goes beside it where it fits
 * (right, left, below, above), else it docks at the end of the viewport away from the target.
 */
export function tourGeometry(rect, width, height, viewportWidth, viewportHeight) {
  const left = clamp(rect.left - PAD, 0, viewportWidth);
  const top = clamp(rect.top - PAD, 0, viewportHeight);
  const right = clamp(rect.right + PAD, left, viewportWidth);
  const bottom = clamp(rect.bottom + PAD, top, viewportHeight);
  const spotlight = { left, top, width: right - left, height: bottom - top };
  const x = clamp(rect.left, GAP, viewportWidth - width - GAP);
  const y = clamp(rect.top, GAP, viewportHeight - height - GAP);
  const candidates = [
    { left: right + GAP, top: y, side: 'right' },
    { left: left - width - GAP, top: y, side: 'left' },
    { left: x, top: bottom + GAP, side: 'below' },
    { left: x, top: top - height - GAP, side: 'above' },
  ];
  const fits = (pos) => pos.left >= GAP && pos.top >= GAP && pos.left + width <= viewportWidth - GAP && pos.top + height <= viewportHeight - GAP;
  const placement = candidates.find(fits) ?? {
    left: viewportWidth - width - GAP,
    top: rect.top > viewportHeight / 2 ? GAP : viewportHeight - height - GAP,
    side: 'docked',
  };
  return { spotlight, placement };
}

/**
 * The dimmed backdrop as an SVG path for clip-path: the whole viewport with a rounded hole over
 * the spotlight (even-odd fill). Always the same commands, so the hole can glide between steps.
 */
export function backdropPath({ left, top, width, height }, viewportWidth, viewportHeight, radius = SPOTLIGHT_RADIUS) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const right = left + width;
  const bottom = top + height;
  const n = (value) => Math.round(value * 10) / 10;
  return (
    `path(evenodd, "M0 0H${n(viewportWidth)}V${n(viewportHeight)}H0Z` +
    `M${n(left + r)} ${n(top)}H${n(right - r)}A${n(r)} ${n(r)} 0 0 1 ${n(right)} ${n(top + r)}` +
    `V${n(bottom - r)}A${n(r)} ${n(r)} 0 0 1 ${n(right - r)} ${n(bottom)}` +
    `H${n(left + r)}A${n(r)} ${n(r)} 0 0 1 ${n(left)} ${n(bottom - r)}` +
    `V${n(top + r)}A${n(r)} ${n(r)} 0 0 1 ${n(left + r)} ${n(top)}Z")`
  );
}
