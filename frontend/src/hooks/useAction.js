import { useCallback, useRef, useState } from 'react';

/**
 * Runs one-off actions (approve, suspend, delete…) with shared busy / error / success state.
 * run(fn, successMessage) → result, or undefined when the request failed (or another action is still running).
 */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const running = useRef(false);

  const run = useCallback(async (fn, successMessage) => {
    if (running.current) return undefined;
    running.current = true;
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
      running.current = false;
      setBusy(false);
    }
  }, []);

  return { busy, error, message, run, setMessage, setError };
}
