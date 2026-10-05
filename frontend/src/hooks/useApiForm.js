import { useCallback, useRef, useState } from 'react';

/**
 * Form state for API-backed forms.
 * - `fieldErrors`: 422 `errors` from the server, keyed by API field name
 * - `formError`: any other ApiError (shown in an alert with its reference id)
 *
 * submit(fn) runs `fn(values)`; it returns the result or undefined when the request failed
 * (or another submit of this form is still running).
 */
export function useApiForm(initialValues) {
  const [values, setValues] = useState(initialValues);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const running = useRef(false);

  const setValue = useCallback((name, value) => {
    setValues((current) => ({ ...current, [name]: value }));
  }, []);

  /** onChange handler for inputs, selects, textareas and checkboxes (by `name`). */
  const bind = useCallback(
    (name) => ({
      name,
      value: values[name] ?? '',
      onChange: (event) => setValue(name, event.target.value),
    }),
    [values, setValue],
  );

  const bindCheckbox = useCallback(
    (name) => ({
      name,
      checked: Boolean(values[name]),
      onChange: (event) => setValue(name, event.target.checked),
    }),
    [values, setValue],
  );

  const submit = useCallback(
    async (request) => {
      if (running.current) return undefined;
      running.current = true;
      setSubmitting(true);
      setFieldErrors({});
      setFormError(null);
      try {
        return await request(values);
      } catch (error) {
        if (error?.code === 'VALIDATION_FAILED' && Object.keys(error.fieldErrors ?? {}).length > 0) {
          setFieldErrors(error.fieldErrors);
        } else {
          setFormError(error);
        }
        return undefined;
      } finally {
        running.current = false;
        setSubmitting(false);
      }
    },
    [values],
  );

  return { values, setValues, setValue, bind, bindCheckbox, fieldErrors, setFieldErrors, formError, setFormError, submitting, submit };
}
