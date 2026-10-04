import { useEffect, useId, useRef } from 'react';

/**
 * Modal dialog on the native <dialog> element: traps focus, closes with Escape, returns focus
 * to the opener. Render it only while open: {open && <Dialog …/>}.
 */
export default function Dialog({ title, onClose, children, actions }) {
  const ref = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement;
    if (!dialog.open) dialog.showModal();

    return () => {
      if (dialog.open) dialog.close();
      opener?.focus?.();
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

/** Yes/no confirmation. `onConfirm` may be async; errors are shown by the caller. */
export function ConfirmDialog({ title, children, confirmLabel, cancelLabel = 'Cancel', danger = false, busy = false, onConfirm, onClose }) {
  return (
    <Dialog
      title={title}
      onClose={onClose}
      actions={
        <>
          <button type="button" className={`button ${danger ? 'button--danger' : ''}`} disabled={busy} onClick={onConfirm}>
            {busy ? 'Please wait…' : confirmLabel}
          </button>
          <button type="button" className="button button--secondary" disabled={busy} onClick={onClose}>
            {cancelLabel}
          </button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
