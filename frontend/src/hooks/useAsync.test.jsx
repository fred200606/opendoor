import { renderHook, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, test } from 'vitest';
import { useAsync } from './useAsync.js';

describe('useAsync', () => {
  test('passes an AbortSignal and aborts it when the deps change', async () => {
    const signals = [];
    const { result, rerender } = renderHook(({ id }) => useAsync((signal) => (signals.push(signal), Promise.resolve(id)), [id]), {
      initialProps: { id: 1 },
    });
    await waitFor(() => expect(result.current.data).toBe(1));
    expect(signals[0]).toBeInstanceOf(AbortSignal);
    expect(signals[0].aborted).toBe(false);

    rerender({ id: 2 });
    await waitFor(() => expect(result.current.data).toBe(2));
    expect(signals[0].aborted).toBe(true);
    expect(signals.at(-1).aborted).toBe(false);
  });

  test('aborts the request when the component goes away', async () => {
    const signals = [];
    const { unmount } = renderHook(() => useAsync((signal) => (signals.push(signal), new Promise(() => {})), []));

    unmount();

    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });

  test('in StrictMode the first of the two loads is aborted, the second one is kept', async () => {
    const signals = [];
    const { result } = renderHook(() => useAsync((signal) => (signals.push(signal), Promise.resolve('snapshot')), ['job-1']), {
      wrapper: StrictMode,
    });
    await waitFor(() => expect(result.current.data).toBe('snapshot'));

    expect(signals).toHaveLength(2);
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
  });

  test('ignores the answer of an outdated load', async () => {
    let resolveFirst;
    const { result, rerender } = renderHook(
      ({ id }) => useAsync(() => (id === 1 ? new Promise((resolve) => (resolveFirst = resolve)) : Promise.resolve('second')), [id]),
      { initialProps: { id: 1 } },
    );
    rerender({ id: 2 });
    await waitFor(() => expect(result.current.data).toBe('second'));

    resolveFirst('first');
    await Promise.resolve();

    expect(result.current.data).toBe('second');
  });
});
