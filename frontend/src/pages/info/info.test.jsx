import { screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { renderApp } from '../../test/render.jsx';

describe('Footer pages', () => {
  test('the footer links open Privacy and the Accessibility statement', async () => {
    const { user, location } = renderApp('/');

    await user.click(screen.getByRole('link', { name: 'Privacy' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Privacy' })).toBeInTheDocument();
    expect(location()).toBe('/privacy');
    expect(document.title).toBe('Privacy – OpenDoor');
    expect(screen.getByText(/Employers see it only if you choose\s+to show it/)).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Accessibility statement' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Accessibility statement' })).toBeInTheDocument();
    expect(screen.getByText(/WCAG\) 2.1\s+at level AA/)).toBeInTheDocument();
  });

  test('How trust scores work explains the publishing rule', async () => {
    renderApp('/trust-scores');

    expect(await screen.findByRole('heading', { level: 1, name: 'How trust scores work' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '3 · The score appears from 3 responses' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse jobs' })).toHaveAttribute('href', '/jobs');
  });
});
