import { X } from 'lucide-react';
import { useId, useMemo, useRef, useState } from 'react';
import { errorText } from '../../lib/errors.js';
import { canonicalSkill, makeSkillLookup, skillKey } from '../../lib/skills.js';

const MAX_LENGTH = 50;

/**
 * Skills from the shared list or typed freely (decision 2026-10-21). A text field suggests list
 * names (native datalist) and "Add skill" (or Enter) adds the skill under its list name; each skill
 * has its own Remove button. Changes are announced in a polite live region, and focus returns to
 * the text field after a removal (the button is gone). `id` is the text field's id, so an error
 * summary can link to it.
 */
export default function SkillsPicker({ id, label, hint, required, value, onChange, options = [], max, error }) {
  const [text, setText] = useState('');
  const [inputError, setInputError] = useState(null);
  const [message, setMessage] = useState('');
  const inputRef = useRef(null);
  const listId = useId();
  const lookup = useMemo(() => makeSkillLookup(options), [options]);
  const hintId = `${id}-hint`;
  const shownError = inputError ?? errorText(error);
  const errorId = shownError ? `${id}-error` : null;

  function add() {
    const typed = text.trim();
    if (!typed) {
      setInputError('Type a skill, then choose Add skill.');
      return;
    }
    if (typed.length > MAX_LENGTH) {
      setInputError(`A skill can have at most ${MAX_LENGTH} characters.`);
      return;
    }
    const name = canonicalSkill(lookup, typed);
    setInputError(null);
    setText('');
    if (value.some((skill) => skillKey(skill) === skillKey(name))) {
      setMessage(`${name} is already in the list.`);
      return;
    }
    if (max && value.length >= max) {
      setInputError(`You can add up to ${max} skills. Remove one first.`);
      return;
    }
    onChange([...value, name]);
    setMessage(`Added ${name}.`);
  }

  function remove(skill) {
    onChange(value.filter((item) => item !== skill));
    setMessage(`Removed ${skill}.`);
    inputRef.current?.focus();
  }

  return (
    <div className={`field skills-picker ${shownError ? 'field--invalid' : ''}`.trim()}>
      <label htmlFor={id} className="field__label">
        {label}
        {required && <span className="field__required"> (required)</span>}
      </label>
      <p id={hintId} className="field__hint">
        {hint} Type to see suggestions, or add your own. {value.length === 0 ? 'None added yet.' : `${value.length} added.`}
      </p>
      {shownError && (
        <p id={errorId} className="field__error">
          <span aria-hidden="true">⚠ </span>
          {shownError}
        </p>
      )}
      <div className="skills-picker__entry">
        <input
          ref={inputRef}
          id={id}
          type="text"
          list={listId}
          autoComplete="off"
          className="field__input"
          value={text}
          aria-invalid={shownError ? true : undefined}
          aria-describedby={[hintId, errorId].filter(Boolean).join(' ')}
          onChange={(event) => {
            setText(event.target.value);
            setInputError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="button button--secondary" onClick={add}>
          Add skill
        </button>
      </div>
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option.id} value={option.name}>
            {option.name}
          </option>
        ))}
      </datalist>
      {value.length > 0 && (
        <ul className="tag-list skills-picker__list" aria-label={`${label}: added`}>
          {value.map((skill) => (
            <li key={skill} className="tag tag--removable">
              {skill}
              <button type="button" className="tag__remove" aria-label={`Remove ${skill}`} onClick={() => remove(skill)}>
                <X aria-hidden="true" focusable="false" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p role="status" className="visually-hidden">
        {message}
      </p>
    </div>
  );
}
