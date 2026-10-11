import { useId } from 'react';
import { errorText } from '../../lib/errors.js';
import VoiceInput from '../VoiceInput.jsx';

function describedBy(...ids) {
  const list = ids.filter(Boolean).join(' ');
  return list || undefined;
}

function Hint({ id, children }) {
  return children ? (
    <p id={id} className="field__hint">
      {children}
    </p>
  ) : null;
}

function FieldError({ id, error }) {
  const text = errorText(error);
  return text ? (
    <p id={id} className="field__error">
      <span aria-hidden="true">⚠ </span>
      {text}
    </p>
  ) : null;
}

function Label({ htmlFor, required, children }) {
  return (
    <label htmlFor={htmlFor} className="field__label">
      {children}
      {required && <span className="field__required"> (required)</span>}
    </label>
  );
}

/**
 * Text input, email, password, number, date… Error and hint are linked with aria-describedby.
 * Pass `id` when the ErrorSummary must link to the field (defaults to `name`).
 * `voice` adds a "Speak" button (browser speech recognition, see VoiceInput).
 */
export function TextField({ label, name, id = name, error, hint, required, className = '', voice = false, ...inputProps }) {
  const hintId = hint ? `${id}-hint` : null;
  const errorId = error ? `${id}-error` : null;

  return (
    <div className={`field ${error ? 'field--invalid' : ''} ${className}`.trim()}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <Hint id={hintId}>{hint}</Hint>
      <FieldError id={errorId} error={error} />
      <input
        id={id}
        name={name}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hintId, errorId)}
        className="field__input"
        {...inputProps}
      />
      {voice && <VoiceInput fieldLabel={label} name={name} value={inputProps.value ?? ''} onChange={inputProps.onChange} maxLength={inputProps.maxLength} />}
    </div>
  );
}

export function TextArea({ label, name, id = name, error, hint, required, maxLength, value = '', className = '', voice = false, ...props }) {
  const hintId = `${id}-hint`;
  const errorId = error ? `${id}-error` : null;
  const counter = maxLength ? `${value.length} of ${maxLength} characters used.` : null;

  return (
    <div className={`field ${error ? 'field--invalid' : ''} ${className}`.trim()}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {(hint || counter) && (
        <p id={hintId} className="field__hint">
          {hint} {counter}
        </p>
      )}
      <FieldError id={errorId} error={error} />
      <textarea
        id={id}
        name={name}
        required={required}
        maxLength={maxLength}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint || counter ? hintId : null, errorId)}
        className="field__input field__textarea"
        {...props}
      />
      {voice && <VoiceInput fieldLabel={label} name={name} value={value} onChange={props.onChange} maxLength={maxLength} />}
    </div>
  );
}

/** options: [{ value, label }] */
export function SelectField({ label, name, id = name, error, hint, required, options, placeholder, className = '', ...props }) {
  const hintId = hint ? `${id}-hint` : null;
  const errorId = error ? `${id}-error` : null;

  return (
    <div className={`field ${error ? 'field--invalid' : ''} ${className}`.trim()}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <Hint id={hintId}>{hint}</Hint>
      <FieldError id={errorId} error={error} />
      <select
        id={id}
        name={name}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hintId, errorId)}
        className="field__input"
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function CheckboxField({ label, name, id = name, error, hint, className = '', ...props }) {
  const hintId = hint ? `${id}-hint` : null;
  const errorId = error ? `${id}-error` : null;

  return (
    <div className={`field field--checkbox ${error ? 'field--invalid' : ''} ${className}`.trim()}>
      <FieldError id={errorId} error={error} />
      <div className="checkbox">
        <input
          type="checkbox"
          id={id}
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(hintId, errorId)}
          {...props}
        />
        <label htmlFor={id}>{label}</label>
      </div>
      <Hint id={hintId}>{hint}</Hint>
    </div>
  );
}

/** Radio buttons in a fieldset. options: [{ value, label, hint? }] */
export function RadioGroup({ legend, name, value, onChange, options, error, required, className = '' }) {
  const groupId = useId();
  const errorId = error ? `${name}-error` : null;

  return (
    <fieldset
      id={name}
      className={`field fieldset ${error ? 'field--invalid' : ''} ${className}`.trim()}
      aria-describedby={errorId ?? undefined}
      tabIndex={-1}
    >
      <legend className="field__label">
        {legend}
        {required && <span className="field__required"> (required)</span>}
      </legend>
      <FieldError id={errorId} error={error} />
      {options.map((option) => {
        const optionId = `${groupId}-${option.value}`;
        return (
          <div className="radio" key={option.value}>
            <input
              type="radio"
              id={optionId}
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              aria-describedby={option.hint ? `${optionId}-hint` : undefined}
            />
            <label htmlFor={optionId}>{option.label}</label>
            {option.hint && (
              <p id={`${optionId}-hint`} className="field__hint radio__hint">
                {option.hint}
              </p>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}
