import { useRef, useState } from 'react';
import { TEXT_SIZES } from '../lib/displayPrefs.js';

const MIN = Number(TEXT_SIZES[0]);
const MAX = Number(TEXT_SIZES.at(-1));
const STEP = 25;
const PRESETS = [
  { value: '100', label: 'Standard' },
  { value: '125', label: 'Large' },
  { value: '150', label: 'Extra large' },
];
const STEP_BUTTON =
  'grid size-11 shrink-0 place-items-center rounded-full border-2 border-input bg-surface font-display font-semibold text-accent transition-[background-color,scale] duration-200 ease-soft hover:bg-primary-soft active:scale-95 aria-disabled:cursor-not-allowed aria-disabled:opacity-40';
// The preview's size in pixels for the base 16 px body text, so it shows the chosen size without
// resizing the page (and the slider) while the thumb is still being dragged.
const BODY_PX = 16;

/**
 * Choose the text size on a slider (100, 125 or 150 % – the sizes the account saves), with
 * Smaller and Larger buttons for people who find dragging hard and the three sizes as quick
 * picks. From Francis Ruzgal's opendoor-ipt (decision 2026-10-21b).
 *
 * While the thumb is dragged only the preview line and the number change; the page takes the new
 * size when the thumb is let go (resizing the page under the pointer would also resize the
 * slider). Keys, buttons and quick picks apply at once. `onChange(value)` gets '100' | '125' | '150'.
 */
export default function TextSizeSlider({ id, value, onChange }) {
  const [draft, setDraft] = useState(null);
  const dragging = useRef(false);
  const current = Number(value);
  const shown = draft ?? current;
  const fill = ((shown - MIN) / (MAX - MIN)) * 100;

  function choose(next) {
    const clamped = Math.min(MAX, Math.max(MIN, next));
    setDraft(null);
    if (clamped !== current) onChange(String(clamped));
  }

  function commitDrag() {
    if (!dragging.current) return;
    dragging.current = false;
    if (draft !== null && draft !== current) onChange(String(draft));
    setDraft(null);
  }

  function handleChange(event) {
    const next = Number(event.target.value);
    if (dragging.current) setDraft(next);
    else choose(next);
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="font-display text-lg font-semibold">
          Text size
        </label>
        <output htmlFor={id} className="font-display text-2xl font-bold text-accent tabular-nums">
          {shown}%
        </output>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button type="button" onClick={() => current > MIN && choose(current - STEP)} aria-disabled={current <= MIN || undefined} aria-label="Smaller text" className={STEP_BUTTON}>
          <span aria-hidden="true" className="text-sm">
            A
          </span>
        </button>
        <input
          id={id}
          type="range"
          min={MIN}
          max={MAX}
          step={STEP}
          value={shown}
          aria-valuetext={`${shown}%`}
          onPointerDown={() => {
            dragging.current = true;
          }}
          onPointerUp={commitDrag}
          onPointerCancel={commitDrag}
          onLostPointerCapture={commitDrag}
          onBlur={commitDrag}
          onChange={handleChange}
          style={{ '--fill': `${fill}%` }}
          className="od-range min-w-0 flex-1"
        />
        <button type="button" onClick={() => current < MAX && choose(current + STEP)} aria-disabled={current >= MAX || undefined} aria-label="Larger text" className={STEP_BUTTON}>
          <span aria-hidden="true" className="text-xl">
            A
          </span>
        </button>
      </div>

      {/* A sample at the chosen size, drawn in pixels so it never moves the slider. */}
      <p
        aria-hidden="true"
        className="mt-3 h-16 overflow-hidden rounded-md bg-subtle px-3 leading-[4rem] text-ellipsis whitespace-nowrap text-text"
        style={{ fontSize: `${(BODY_PX * shown) / 100}px` }}
      >
        Find work that fits you
      </p>

      <div role="group" aria-label="Quick sizes" className="mt-3 flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            aria-pressed={value === preset.value}
            onClick={() => choose(Number(preset.value))}
            className="inline-flex min-h-11 items-center rounded-full border-2 border-input px-4 text-sm font-bold text-text transition-colors duration-200 ease-soft hover:bg-primary-soft aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-on-primary"
          >
            {preset.label} ({preset.value}%)
          </button>
        ))}
      </div>
    </div>
  );
}
