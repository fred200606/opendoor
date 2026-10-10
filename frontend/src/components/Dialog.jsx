import { useEffect, useId, useRef, useState } from 'react';
import Button from './Button.jsx';

/**
 * Modal dialog on the native <dialog> element: traps focus, closes with Escape, returns focus
 * to the opener. Starts on the element marked `data-autofocus`, if any.
 * Render it only while open: {open && <Dialog …/>}.
 */
export default function Dialog({ title, onClose, children, actions }) {
  const ref = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement;
    if (!dialog.open) dialog.showModal();
    // showModal() focuses the first control; a dialog can name a safer start (e.g. Cancel).
    dialog.querySelector('[data-autofocus]')?.focus();

    return () => {
      if (dialog.open) dialog.close();
      // The opener may be gone (e.g. the deleted row's button); then start again at the page heading.
      const target = opener?.isConnected ? opener : document.querySelector('main h1');
      target?.focus?.();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <h2 id={titleId} className="dialog__title">
        {title}
      </h2>
      <div className="dialog__body">{children}</div>
      {actions && <div className="dialog__actions">{actions}</div>}
    </dialog>
  );
}

/**
 * Asks for a reason (reject a posting or employer, act on a report). `required` blocks an empty
 * reason with an inline, announced error. onSubmit(reason) may be async.
 */
export function ReasonDialog({ title, label, hint, confirmLabel, required = true, busy = false, onSubmit, onClose, children }) {
  const fieldId = useId();
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);

  function handleSubmit(event) {
    event.preventDefault();
    if (required && !reason.trim()) {
      setError('Enter a reason.');
      document.getElementById(fieldId)?.focus();
      return;
    }
    onSubmit(reason.trim());
  }

  return (
    <Dialog title={title} onClose={onClose}>
      {children}
      <form onSubmit={handleSubmit} noValidate>
        <div className={`field ${error ? 'field--invalid' : ''}`}>
          <label htmlFor={fieldId} className="field__label">
            {label}
            {!required && <span className="field__required"> (optional)</span>}
          </label>
          {hint && (
            <p id={`${fieldId}-hint`} className="field__hint">
              {hint}
            </p>
          )}
          {error && (
            <p id={`${fieldId}-error`} className="field__error" role="alert">
              <span aria-hidden="true">⚠ </span>
              {error}
            </p>
          )}
          <textarea
            id={fieldId}
            className="field__input field__textarea"
            value={reason}
            maxLength={1000}
            aria-invalid={error ? true : undefined}
            aria-describedby={[hint && `${fieldId}-hint`, error && `${fieldId}-error`].filter(Boolean).join(' ') || undefined}
            onChange={(event) => {
              setReason(event.target.value);
              setError(null);
            }}
          />
        </div>
        <div className="dialog__actions">
          <Button type="submit" className="button" disabled={busy}>
            {busy ? 'Please wait…' : confirmLabel}
          </Button>
          <Button type="button" className="button button--secondary" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/**
 * Yes/no confirmation. `onConfirm` may be async; errors are shown by the caller.
 * With `danger`, focus starts on Cancel so a stray Enter does not delete or suspend anything.
 */
export function ConfirmDialog({ title, children, confirmLabel, cancelLabel = 'Cancel', danger = false, busy = false, onConfirm, onClose }) {
  return (
    <Dialog
      title={title}
      onClose={onClose}
      actions={
        <>
          <Button type="button" className={`button ${danger ? 'button--danger' : ''}`} disabled={busy} onClick={onConfirm}>
            {busy ? 'Please wait…' : confirmLabel}
          </Button>
          <Button type="button" className="button button--secondary" disabled={busy} onClick={onClose} data-autofocus={danger || undefined}>
            {cancelLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
