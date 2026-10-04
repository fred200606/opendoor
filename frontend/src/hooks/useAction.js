import { useCallback, useState } from 'react';

/**
 * Runs one-off actions (approve, suspend, delete…) with shared busy / error / success state.
 * run(fn, successMessage) → result, or undefined when the request failed.
 */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');

  const run = useCallback(async (fn, successMessage) => {
    setBusy(true);
    setError(null);
    setMessage('');
    try {
      const result = await fn();
      if (successMessage) setMessage(typeof successMessage === 'function' ? successMessage(result) : successMessage);
      return result ?? true;
    } catch (apiError) {
      setError(apiError);
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, error, message, run, setMessage, setError };
}
