import { useCallback, useEffect, useState } from 'react';

/**
 * Loads data whenever `deps` change. `load(signal)` returns a promise; it may pass the
 * AbortSignal on to the request, which is aborted when the deps change or the component goes
 * away (in development StrictMode runs every effect twice: without the abort, Chrome holds the
 * second identical GET until the first one ends – too long for a slow snapshot).
 * Returns { data, error, loading, reload, setData }. While reloading, the previous data stays
 * available (no layout jump when paging); responses for outdated deps are ignored.
 */
export function useAsync(load, deps) {
  const [version, setVersion] = useState(0);
  const key = JSON.stringify([...deps, version]);
  const [result, setResult] = useState({ key: null, data: undefined, error: null });

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    load(controller.signal)
      .then((data) => active && setResult({ key, data, error: null }))
      .catch((error) => active && setResult({ key, data: undefined, error }));
    return () => {
      active = false;
      controller.abort();
    };
    // `load` is a new function every render; `key` (from deps) decides when to reload.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);
  const setData = useCallback((updater) => {
    setResult((current) => ({ ...current, data: typeof updater === 'function' ? updater(current.data) : updater }));
  }, []);

  const loading = result.key !== key;
  return { data: result.data, error: loading ? null : result.error, loading, reload, setData };
}
