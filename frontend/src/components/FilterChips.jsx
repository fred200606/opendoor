import { Check, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import AccommodationPicker from './AccommodationPicker.jsx';
import Button from './Button.jsx';
import Dialog from './Dialog.jsx';

const CHIP = 'inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 font-display text-sm font-semibold transition-colors duration-200 ease-soft';
const CHIP_IDLE = 'border-input bg-surface text-text hover:bg-primary-soft';
const CHIP_ON = 'border-primary bg-primary text-on-primary hover:bg-primary-hover';
const OPTION = 'flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-primary-soft';
const INPUT = 'size-5 accent-primary';

/** "Remote", "Remote +1": what a chip shows once something is chosen. */
function chosenText(labels) {
  if (labels.length === 0) return null;
  return labels.length === 1 ? labels[0] : `${labels[0]} +${labels.length - 1}`;
}

/**
 * Find jobs' filters as a row of chips, in the IPT look (Francis Ruzgal's opendoor-ipt, decision
 * 2026-10-21b). Each chip names what is picked ("Remote +1") and opens a small panel; changes apply
 * at once. Accommodations open a dialog, since there are many. Screen readers hear the filter's
 * name before the value ("Work setup: Remote +1").
 *
 * `options`: { workSetups, categories, distances (null for guests), sorts, groups } as
 * { value: label } maps (categories and groups as from the API).
 */
export default function FilterChips({ filters, options, isCandidate, onChange, onClear, activeCount }) {
  const [accommodationsOpen, setAccommodationsOpen] = useState(false);
  const toggle = (list, value, on) => (on ? [...list, value] : list.filter((item) => item !== value));
  const category = options.categories.find((item) => String(item.id) === filters.category);
  const accommodationCount = filters.accommodations.length;

  return (
    <section aria-labelledby="job-filters-heading" className="od mt-6">
      <h2 id="job-filters-heading" className="sr-only">
        Filters
      </h2>
      <ul className="flex flex-wrap items-center gap-2">
        {isCandidate && (
          <li>
            <button
              type="button"
              aria-pressed={filters.match}
              onClick={() => onChange({ match: filters.match ? '0' : '' })}
              className={`${CHIP} ${filters.match ? CHIP_ON : CHIP_IDLE}`}
            >
              {filters.match && <Check className="size-4" aria-hidden="true" focusable="false" />}
              Recommended for me
            </button>
          </li>
        )}

        <ChipPanel name="Work setup" chosen={chosenText(filters.workSetups.map((value) => options.workSetups[value]))}>
          {Object.entries(options.workSetups).map(([value, label]) => (
            <label key={value} className={OPTION}>
              <input
                type="checkbox"
                className={INPUT}
                checked={filters.workSetups.includes(value)}
                onChange={(event) => onChange({ setup: toggle(filters.workSetups, value, event.target.checked) })}
              />
              {label}
            </label>
          ))}
        </ChipPanel>

        {options.distances && (
          <ChipPanel name="Distance" chosen={filters.distance ? options.distances[filters.distance] : null}>
            {Object.entries(options.distances).map(([value, label]) => (
              <label key={value || 'any'} className={OPTION}>
                <input type="radio" name="filter-distance" className={INPUT} checked={filters.distance === value} onChange={() => onChange({ dist: value })} />
                {label}
              </label>
            ))}
            <p className="px-2 pb-1 text-sm text-muted">Remote jobs are always shown.</p>
          </ChipPanel>
        )}

        <ChipPanel name="Category" chosen={category?.name ?? null} wide>
          {[{ id: '', name: 'Any category' }, ...options.categories].map((item) => (
            <label key={item.id} className={OPTION}>
              <input
                type="radio"
                name="filter-category"
                className={INPUT}
                checked={filters.category === String(item.id)}
                onChange={() => onChange({ category: String(item.id) })}
              />
              {item.name}
            </label>
          ))}
        </ChipPanel>

        <li>
          <button type="button" aria-haspopup="dialog" onClick={() => setAccommodationsOpen(true)} className={`${CHIP} ${accommodationCount > 0 ? CHIP_ON : CHIP_IDLE}`}>
            <SlidersHorizontal className="size-4" aria-hidden="true" focusable="false" />
            {accommodationCount > 0 ? (
              <span>
                <span className="sr-only">Accommodations:</span> {accommodationCount === 1 ? '1 accommodation' : `${accommodationCount} accommodations`}
              </span>
            ) : (
              'Accommodations'
            )}
          </button>
        </li>

        <ChipPanel name="Sort" chosen={options.sorts[filters.sort]} showName quiet>
          {Object.entries(options.sorts).map(([value, label]) => (
            <label key={value} className={OPTION}>
              <input type="radio" name="filter-sort" className={INPUT} checked={filters.sort === value} onChange={() => onChange({ sort: value === 'best' ? '' : value })} />
              {label}
            </label>
          ))}
        </ChipPanel>

        {activeCount > 0 && (
          <li>
            <button type="button" className="button button--link" onClick={onClear}>
              Clear all filters
            </button>
          </li>
        )}
      </ul>

      {accommodationsOpen && (
        <Dialog
          title="Accommodations provided"
          onClose={() => setAccommodationsOpen(false)}
          actions={
            <>
              {accommodationCount > 0 && (
                <Button type="button" className="button button--secondary" onClick={() => onChange({ acc: [] })}>
                  Untick all
                </Button>
              )}
              <Button type="button" className="button" onClick={() => setAccommodationsOpen(false)}>
                Show jobs
              </Button>
            </>
          }
        >
          <p className="mb-4">Show jobs that provide every one you tick. The list updates as you tick.</p>
          <AccommodationPicker id="filter-accommodations" legend="Accommodations" groups={options.groups} selected={filters.accommodations} onChange={(ids) => onChange({ acc: ids })} />
        </Dialog>
      )}
    </section>
  );
}

/**
 * One chip that opens a small panel of choices below it (a disclosure: button + group of inputs).
 * Escape and a click outside close it; Escape puts focus back on the chip. With `showName` the
 * name stays visible ("Sort: Newest"); otherwise a chosen value replaces it.
 */
function ChipPanel({ name, chosen, showName = false, quiet = false, wide = false, children }) {
  const [open, setOpen] = useState(false);
  // A chip near the right edge opens its panel leftwards, so the page never scrolls sideways.
  const [alignRight, setAlignRight] = useState(false);
  const panelId = useId();
  const buttonRef = useRef(null);
  const wrapperRef = useRef(null);
  const on = Boolean(chosen) && !quiet;

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event) {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <li ref={wrapperRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          const box = buttonRef.current.getBoundingClientRect();
          setAlignRight(box.left + (wide ? 320 : 224) > document.documentElement.clientWidth - 16);
          setOpen(!open);
        }}
        className={`${CHIP} ${on ? CHIP_ON : CHIP_IDLE}`}
      >
        {chosen ? (
          <span>
            <span className={showName ? '' : 'sr-only'}>{name}:</span> {chosen}
          </span>
        ) : (
          name
        )}
        <ChevronDown className={`size-4 transition-transform duration-200 ease-soft ${open ? 'rotate-180' : ''}`} aria-hidden="true" focusable="false" />
      </button>
      <fieldset
        id={panelId}
        data-open={open}
        inert={!open}
        aria-hidden={!open}
        className={`od-pop absolute ${alignRight ? 'right-0' : 'left-0'} z-30 mt-2 max-h-80 overflow-y-auto rounded-lg border border-border bg-surface p-2 shadow-[0_12px_28px_rgba(36,27,58,0.16)] ${wide ? 'w-[min(20rem,calc(100vw-2rem))]' : 'w-[min(14rem,calc(100vw-2rem))]'}`}
      >
        <legend className="sr-only">{name}</legend>
        {children}
      </fieldset>
    </li>
  );
}
