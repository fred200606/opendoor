import { useId } from 'react';

/**
 * Accommodation checkboxes grouped per RA 7277 group (from GET /accommodations).
 * - `selected`: array of ids
 * - `withNotes`: show a note input under each checked item (job postings), `notes` = { [id]: text }
 * - `columns`: groups in two columns on wide screens (Figma "Post a new job", step 3)
 */
export default function AccommodationPicker({
  groups,
  selected,
  onChange,
  legend,
  hint,
  error,
  withNotes = false,
  notes = {},
  onNoteChange,
  id = 'accommodations',
  columns = false,
}) {
  const baseId = useId();
  const selectedSet = new Set(selected);

  function toggle(accommodationId, checked) {
    onChange(checked ? [...selected, accommodationId] : selected.filter((value) => value !== accommodationId));
  }

  return (
    <fieldset
      id={id}
      className={`field fieldset accommodation-picker ${columns ? 'accommodation-picker--columns' : ''} ${error ? 'field--invalid' : ''}`}
      tabIndex={-1}
    >
      <legend className="field__label">{legend}</legend>
      {hint && <p className="field__hint">{hint}</p>}
      {error && (
        <p className="field__error">
          <span aria-hidden="true">⚠ </span>
          {Array.isArray(error) ? error[0] : error}
        </p>
      )}
      <p className="field__hint" aria-live="polite">
        {selected.length === 0 ? 'None selected.' : `${selected.length} selected.`}
      </p>

      <div className="accommodation-picker__groups">
      {groups.map((group) => (
        <fieldset key={group.group} className="accommodation-picker__group">
          <legend>{group.label}</legend>
          {group.items.map((item) => {
            const inputId = `${baseId}-${item.id}`;
            const checked = selectedSet.has(item.id);
            return (
              <div key={item.id} className="accommodation-picker__item">
                <div className="checkbox">
                  <input
                    type="checkbox"
                    id={inputId}
                    checked={checked}
                    onChange={(event) => toggle(item.id, event.target.checked)}
                    aria-describedby={item.description ? `${inputId}-desc` : undefined}
                  />
                  <label htmlFor={inputId}>{item.name}</label>
                </div>
                {item.description && (
                  <p id={`${inputId}-desc`} className="field__hint accommodation-picker__desc">
                    {item.description}
                  </p>
                )}
                {withNotes && checked && (
                  <div className="field accommodation-picker__note">
                    <label htmlFor={`${inputId}-note`} className="field__label">
                      Details for “{item.name}” <span className="field__required">(optional)</span>
                    </label>
                    <p id={`${inputId}-note-hint`} className="field__hint">
                      For example, where it is or how to ask for it.
                    </p>
                    <input
                      id={`${inputId}-note`}
                      className="field__input"
                      maxLength={255}
                      aria-describedby={`${inputId}-note-hint`}
                      value={notes[item.id] ?? ''}
                      onChange={(event) => onNoteChange(item.id, event.target.value)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </fieldset>
      ))}
      </div>
    </fieldset>
  );
}
