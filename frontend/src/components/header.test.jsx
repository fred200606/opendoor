import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { applyDisplayPrefs, DEFAULT_PREFS } from '../lib/displayPrefs.js';
import { renderApp } from '../test/render.jsx';

afterEach(() => {
  localStorage.removeItem('opendoor.display');
  applyDisplayPrefs(DEFAULT_PREFS);
});

describe('Utility bar (Figma design)', () => {
  test('skip link first, then display shortcuts that apply at once and stay in this browser', async () => {
    const { user } = renderApp('/jobs', { routes: { 'GET /job-postings': () => [200, { data: [], meta: { total: 0, current_page: 1, last_page: 1 } }] } });

    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveAccessibleName('Skip to main content');

    // Text size opens a panel: quick picks, a slider and Smaller/Larger buttons; Escape closes it.
    const textSize = screen.getByRole('button', { name: /^Text size/ });
    expect(textSize).toHaveAccessibleName('Text size: 100%');
    await user.click(textSize);
    expect(textSize).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('button', { name: 'Large (125%)' }));
    expect(document.documentElement.dataset.textSize).toBe('125');
    expect(screen.getByRole('button', { name: 'Large (125%)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('slider', { name: 'Text size' })).toHaveValue('125');
    await user.click(screen.getByRole('button', { name: 'Larger text' }));
    expect(document.documentElement.dataset.textSize).toBe('150');
    expect(screen.getByRole('button', { name: 'Larger text' })).toHaveAttribute('aria-disabled', 'true');
    await user.click(screen.getByRole('button', { name: 'Smaller text' }));
    expect(document.documentElement.dataset.textSize).toBe('125');
    await user.keyboard('{Escape}');
    expect(textSize).toHaveAttribute('aria-expanded', 'false');
    expect(textSize).toHaveFocus();
    expect(textSize).toHaveAccessibleName('Text size: 125%');

    const contrast = screen.getByRole('button', { name: 'High contrast' });
    await user.click(contrast);
    expect(contrast).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.dataset.contrast).toBe('high');

    await user.click(screen.getByRole('button', { name: 'Quiet mode' }));
    expect(document.documentElement.dataset.quiet).toBe('on');
    expect(await screen.findByText('Quiet mode is on.')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('opendoor.display'))).toMatchObject({ textSize: '125', contrast: 'high', quiet: 'on' });
  });

  test('a signed-in user also saves text size and contrast to the account, not Quiet mode', async () => {
    const { user, calls } = renderApp('/candidate/saved-jobs', {
      as: 'candidate',
      routes: {
        'GET /candidate/saved-jobs': () => [200, { data: [], meta: { total: 0, current_page: 1, last_page: 1 } }],
        'PUT /me/display-prefs': (config) => [200, JSON.parse(config.data)],
      },
    });

    await user.click(await screen.findByRole('button', { name: 'High contrast' }));
    await user.click(screen.getByRole('button', { name: 'Quiet mode' }));

    const saves = calls.filter((call) => call.key === 'PUT /me/display-prefs');
    expect(saves).toHaveLength(1);
    expect(saves[0].data).toEqual({ text_size: '100', contrast: 'high', motion: 'normal' });
  });
});

describe('Header (IPT look)', () => {
  test('logo, role links with the current page marked, and an account menu with the own pages and Log out', async () => {
    const { user } = renderApp('/candidate/saved-jobs', {
      as: 'candidate',
      routes: { 'GET /candidate/saved-jobs': () => [200, { data: [], meta: { total: 0, current_page: 1, last_page: 1 } }] },
    });

    expect(await screen.findByRole('link', { name: 'OpenDoor home' })).toHaveAttribute('href', '/candidate/dashboard');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Saved jobs' })).toHaveAttribute('aria-current', 'page');
    for (const name of ['Dashboard', 'Find jobs', 'Applications']) {
      expect(within(nav).getByRole('link', { name })).toBeInTheDocument();
    }
    expect(within(nav).queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument();

    const account = within(nav).getByRole('button', { name: 'Account' });
    await user.click(account);
    expect(account).toHaveAttribute('aria-expanded', 'true');
    expect(within(nav).getByText('candidate@opendoor.test')).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/candidate/profile');
    expect(within(nav).getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/account');
    expect(within(nav).getByRole('button', { name: 'Log out' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(account).toHaveAttribute('aria-expanded', 'false');
    expect(account).toHaveFocus();
  });

  test('compact menu: one Menu button; Escape closes it and returns focus; a chosen link closes it', async () => {
    const { user, location } = renderApp('/jobs', { routes: { 'GET /job-postings': () => [200, { data: [], meta: { total: 0, current_page: 1, last_page: 1 } }] } });

    await user.click(screen.getByRole('button', { name: 'Compact menu' }));
    expect(screen.getByRole('button', { name: 'Show all links' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Find jobs' })).not.toBeInTheDocument();

    const menu = screen.getByRole('button', { name: 'Menu' });
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    await user.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Find jobs' })).toHaveAttribute('aria-current', 'page');

    await user.keyboard('{Escape}');
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    expect(menu).toHaveFocus();

    await user.click(menu);
    await user.click(screen.getByRole('link', { name: 'Log in' }));
    expect(location()).toBe('/login');
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'false');
  });
});
