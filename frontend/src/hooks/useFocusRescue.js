import { useEffect } from 'react';

/**
 * When the focused element disappears (a deleted row's button, an approved card…) the browser
 * drops focus to <body> and keyboard/screen-reader users lose their place. This moves focus to
 * the page heading instead. Watches the element with id `containerId`.
 */
export function useFocusRescue(containerId = 'main') {
  useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container) return undefined;

    let lastFocused = null;
    const remember = (event) => {
      lastFocused = event.target;
    };

    const observer = new MutationObserver(() => {
      const lost = lastFocused && !lastFocused.isConnected;
      const nowhere = document.activeElement === document.body || document.activeElement === null;
      if (lost && nowhere) {
        lastFocused = null;
        container.querySelector('h1')?.focus();
      }
    });

    document.addEventListener('focusin', remember);
    observer.observe(container, { childList: true, subtree: true });

    return () => {
      document.removeEventListener('focusin', remember);
      observer.disconnect();
    };
  }, [containerId]);
}
