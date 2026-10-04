const ICONS = { info: 'ℹ', success: '✓', warning: '!', error: '⚠' };
const LABELS = { info: 'Information', success: 'Success', warning: 'Warning', error: 'Error' };

/**
 * Message box. Status is shown with an icon and a hidden label, never color alone.
 * `live`: 'polite' for results/confirmations, 'assertive' for errors that block the user.
 */
export default function Alert({ type = 'info', title, children, live, requestId, className = '' }) {
  const role = live === 'assertive' ? 'alert' : live === 'polite' ? 'status' : undefined;

  return (
    <div className={`alert alert--${type} ${className}`.trim()} role={role}>
      <span className="alert__icon" aria-hidden="true">
        {ICONS[type]}
      </span>
      <div className="alert__body">
        <span className="visually-hidden">{LABELS[type]}: </span>
        {title && <p className="alert__title">{title}</p>}
        {children}
        {requestId && <p className="alert__reference">Reference: {requestId}</p>}
      </div>
    </div>
  );
}

/** Shows an ApiError in plain language with its reference id (for support). */
export function ApiErrorAlert({ error, title }) {
  if (!error) return null;

  return (
    <Alert type="error" live="assertive" title={title} requestId={error.requestId}>
      <p>{error.message}</p>
    </Alert>
  );
}
