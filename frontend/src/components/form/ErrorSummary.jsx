import { TriangleAlert } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { errorText } from '../../lib/errors.js';

/**
 * Shown above a form after a failed submit. Takes focus so screen-reader users hear it,
 * and links every message to its field (GOV.UK error summary pattern).
 * `fields` maps API field names to { id, label }; unknown fields are listed without a link.
 */
export default function ErrorSummary({ errors, fields = {}, title = 'There is a problem' }) {
  const ref = useRef(null);
  const entries = Object.entries(errors ?? {}).filter(([, value]) => errorText(value));

  useEffect(() => {
    if (Object.keys(errors ?? {}).length > 0) ref.current?.focus();
  }, [errors]);

  if (entries.length === 0) return null;

  function focusField(event, id) {
    event.preventDefault();
    const element = document.getElementById(id);
    element?.focus();
    element?.scrollIntoView?.({ block: 'center' });
  }

  return (
    <div className="error-summary" role="alert" aria-labelledby="error-summary-title" tabIndex={-1} ref={ref}>
      <h2 id="error-summary-title" className="error-summary__title">
        <TriangleAlert aria-hidden="true" focusable="false" />
        {title}
      </h2>
      <ul>
        {entries.map(([name, value]) => {
          const id = fields[name]?.id ?? name;
          return (
            <li key={name}>
              <a href={`#${id}`} onClick={(event) => focusField(event, id)}>
                {errorText(value)}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
