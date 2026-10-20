import { render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { saveDisplayPrefs, DEFAULT_PREFS } from '../../lib/displayPrefs.js';
import MascotDoor from './MascotDoor.jsx';
import MascotHappy from './MascotHappy.jsx';
import MascotLoader from './MascotLoader.jsx';
import MascotMessage from './MascotMessage.jsx';
import MascotSad from './MascotSad.jsx';

// The IPT mascots (Francis Ruzgal's opendoor-ipt, decision 2026-10-21b). Reduce motion draws one
// still frame, so the tests need no animation clock.
beforeEach(() => saveDisplayPrefs({ ...DEFAULT_PREFS, motion: 'reduce' }));
afterEach(() => saveDisplayPrefs(DEFAULT_PREFS));

describe('the mascot animations', () => {
  test.each([
    ['sad', MascotSad],
    ['happy', MascotHappy],
    ['door', MascotDoor],
    ['loader', MascotLoader],
  ])('draws the %s mascot as decoration, hidden from screen readers', (_, Mascot) => {
    const { container } = render(<Mascot />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    // Still: its parts already have their pose.
    expect(svg.querySelector('[transform]')).not.toBeNull();
  });

  test('two mascots on one page get their own ids, so masks and filters never clash', () => {
    const { container } = render(
      <>
        <MascotSad />
        <MascotSad />
      </>,
    );
    const masks = [...container.querySelectorAll('mask')].map((mask) => mask.id);
    expect(new Set(masks).size).toBe(2);
  });
});

describe('MascotMessage', () => {
  test('says the message in words, with the mascot beside it as decoration', async () => {
    const { container } = render(
      <MascotMessage mood="happy" title="Application sent!" headingId="sent-heading">
        <p>Your application was sent to Acme Corp.</p>
      </MascotMessage>,
    );
    expect(screen.getByRole('region', { name: 'Application sent!' })).toHaveTextContent('Your application was sent to Acme Corp.');
    const results = await axe.run(container, { rules: { region: { enabled: false } } });
    expect(results.violations).toEqual([]);
  });
});
