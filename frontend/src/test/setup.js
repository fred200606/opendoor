import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// findBy*/waitFor give up after 3 s instead of 1 s. The first test of a file renders the whole app
// in a cold worker: its first findByRole took 381 ms idle and 629 ms with every core busy
// (later renders ~50–120 ms), and passed 1 s once in a full run on a machine short of memory.
configure({ asyncUtilTimeout: 3_000 });

// jsdom has <dialog> but no showModal/close.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close() {
    this.open = false;
  };
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});
