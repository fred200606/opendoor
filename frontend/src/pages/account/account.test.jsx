import { screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { applyDisplayPrefs, DEFAULT_PREFS } from '../../lib/displayPrefs.js';
import { paged, renderApp, users, validationError } from '../../test/render.jsx';

afterEach(() => applyDisplayPrefs(DEFAULT_PREFS));

describe('AccountPage', () => {
  test('changes the password with the contract field names', async () => {
    const { user, calls } = renderApp('/account', { as: 'candidate', routes: { 'PUT /me/password': () => [204, ''] } });

    await user.type(await screen.findByLabelText(/Current password/), 'old-password');
    await user.type(screen.getByLabelText(/^New password/), 'new-password-1');
    await user.type(screen.getByLabelText(/Confirm new password/), 'new-password-1');
    await user.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByText(/signed out on your other devices/)).toBeInTheDocument();
    expect(calls.find((call) => call.key === 'PUT /me/password').data).toEqual({
      current_password: 'old-password',
      password: 'new-password-1',
      password_confirmation: 'new-password-1',
    });
    expect(screen.getByLabelText(/Current password/)).toHaveValue('');
  });

  test('a wrong current password is linked to its field', async () => {
    const { user } = renderApp('/account', {
      as: 'employer',
      routes: { 'PUT /me/password': () => validationError({ current_password: ['The password is incorrect.'] }) },
    });

    await user.type(await screen.findByLabelText(/Current password/), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Change password' }));

    await user.click(await screen.findByRole('link', { name: 'The password is incorrect.' }));
    expect(screen.getByLabelText(/Current password/)).toHaveFocus();
  });

  test('display settings apply immediately and are saved to the account', async () => {
    const { user, calls } = renderApp('/account', {
      as: 'candidate',
      routes: { 'PUT /me/display-prefs': (config) => [200, JSON.parse(config.data)] },
    });

    await user.click(await screen.findByLabelText('Extra large (150%)'));
    await user.click(screen.getByLabelText('High contrast'));

    expect(document.documentElement.dataset.textSize).toBe('150');
    expect(document.documentElement.dataset.contrast).toBe('high');
    expect(JSON.parse(localStorage.getItem('opendoor.display'))).toMatchObject({ textSize: '150', contrast: 'high' });
    expect(await screen.findByText('Display settings applied and saved to your account.')).toBeInTheDocument();
    const saves = calls.filter((call) => call.key === 'PUT /me/display-prefs');
    expect(saves).toHaveLength(2);
    expect(saves.at(-1).data).toEqual({ text_size: '150', contrast: 'high', motion: 'normal' });
  });

  test('display settings still apply on this device when the account cannot be saved', async () => {
    const { user } = renderApp('/account', { as: 'employer', routes: { 'PUT /me/display-prefs': () => [503, { error: { code: 'SERVICE_UNAVAILABLE', message: 'Down', request_id: 'x' } }] } });

    await user.click(await screen.findByLabelText('Reduce motion'));

    expect(document.documentElement.dataset.motion).toBe('reduce');
    expect(await screen.findByText(/applied on this device, but not saved to your account/)).toBeInTheDocument();
  });

  test('settings saved with the account are applied after sign-in', async () => {
    renderApp('/account', {
      as: 'candidate',
      routes: { 'GET /me': () => [200, { ...users.candidate, display_prefs: { text_size: '125', contrast: 'high', motion: 'reduce' } }] },
    });

    expect(await screen.findByLabelText('Large (125%)')).toBeChecked();
    expect(document.documentElement.dataset.textSize).toBe('125');
    expect(document.documentElement.dataset.motion).toBe('reduce');
    expect(JSON.parse(localStorage.getItem('opendoor.display'))).toEqual({ textSize: '125', contrast: 'high', motion: 'reduce' });
  });

  test('guests are sent to log in', async () => {
    renderApp('/account');

    expect(await screen.findByRole('heading', { level: 1, name: 'Log in' })).toBeInTheDocument();
  });
});

describe('NotificationsPage', () => {
  const notifications = [
    { id: 'a1', type: 'application_status_changed', data: { message: 'Your application for Data Encoder was reviewed.', url: '/candidate/applications/11' }, read_at: null, created_at: '2026-10-04T09:00:00+08:00' },
    { id: 'b2', type: 'posting_approved', data: { message: 'Welcome to OpenDoor.' }, read_at: null, created_at: '2026-10-03T09:00:00+08:00' },
  ];

  test('marks one and then all notifications as read', async () => {
    const { user, calls } = renderApp('/notifications', {
      as: 'candidate',
      routes: {
        'GET /notifications': () => [200, paged(notifications, { unread_count: 2 })],
        'PATCH /notifications/b2/read': () => [204, ''],
        'PATCH /notifications/read-all': () => [204, ''],
      },
    });

    expect(await screen.findByText('2 unread notifications')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Your application for Data Encoder was reviewed.' })).toHaveAttribute('href', '/candidate/applications/11');

    await user.click(screen.getByRole('button', { name: 'Mark as read' }));
    expect(await screen.findByText('1 unread notification')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mark all as read' }));
    expect(await screen.findByText('Everything is read.')).toBeInTheDocument();
    expect(calls.map((call) => call.key)).toEqual(expect.arrayContaining(['PATCH /notifications/b2/read', 'PATCH /notifications/read-all']));
  });

  test('the header link announces the unread count', async () => {
    renderApp('/candidate/saved-jobs', {
      as: 'candidate',
      routes: { 'GET /notifications': () => [200, paged(notifications, { unread_count: 2 })], 'GET /candidate/saved-jobs': () => [200, paged([])] },
    });

    expect(await screen.findByRole('link', { name: 'Notifications 2 unread' })).toHaveAttribute('href', '/notifications');
  });

  test('the header count follows "Mark all as read" without a page change', async () => {
    let unread = 2;
    const { user } = renderApp('/notifications', {
      as: 'candidate',
      routes: {
        'GET /notifications': () => [200, paged(unread ? notifications : notifications.map((n) => ({ ...n, read_at: '2026-10-10T09:00:00+08:00' })), { unread_count: unread })],
        'PATCH /notifications/read-all': () => {
          unread = 0;
          return [204, ''];
        },
      },
    });

    expect(await screen.findByRole('link', { name: 'Notifications 2 unread' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mark all as read' }));

    expect(await screen.findByRole('link', { name: 'Notifications' })).not.toHaveAttribute('aria-label');
  });
});
