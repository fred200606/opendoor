import { describe, expect, test, vi } from 'vitest';
import { fakeApi } from '../test/fakeApi.js';
import { ApiError, api, setUnauthorizedHandler, tokenStore } from './client.js';

describe('api client', () => {
  test('uses the gateway base URL and sends the stored token', async () => {
    tokenStore.set('1|abc');
    const calls = fakeApi({ 'GET /me': () => [200, { id: 1 }] });

    await api.get('/me');

    expect(calls[0].config.baseURL).toBe('http://gateway.test/api');
    expect(calls[0].config.headers.Authorization).toBe('Bearer 1|abc');
  });

  test('sends no Authorization header when logged out', async () => {
    const calls = fakeApi({ 'GET /categories': () => [200, { data: [] }] });

    await api.get('/categories');

    expect(calls[0].config.headers.Authorization).toBeUndefined();
  });

  test('turns the error envelope into an ApiError with the request id', async () => {
    fakeApi({
      'POST /job-postings/1/applications': () => [
        409,
        { error: { code: 'ALREADY_APPLIED', message: 'You have already applied to this posting.', request_id: 'req-1' } },
      ],
    });

    const error = await api.post('/job-postings/1/applications').catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: 'ALREADY_APPLIED', message: 'You have already applied to this posting.', requestId: 'req-1' });
  });

  test('exposes 422 field errors for the form', async () => {
    fakeApi({
      'POST /register': () => [
        422,
        { message: 'The given data was invalid.', error: { code: 'VALIDATION_FAILED', request_id: 'req-2' }, errors: { email: ['The email has already been taken.'] } },
      ],
    });

    const error = await api.post('/register', {}).catch((e) => e);

    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.message).toBe('The given data was invalid.');
    expect(error.fieldErrors).toEqual({ email: ['The email has already been taken.'] });
  });

  test('a network failure gets a plain-language message', async () => {
    api.defaults.adapter = async (config) => {
      const error = new Error('Network Error');
      error.config = config;
      error.code = 'ERR_NETWORK';
      throw error;
    };

    const error = await api.get('/categories').catch((e) => e);

    expect(error).toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
    expect(error.message).toMatch(/could not reach OpenDoor/);
  });

  test('401 on a request that carried a token triggers the logout handler', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    fakeApi({ 'GET /me': () => [401, { error: { code: 'UNAUTHENTICATED', message: 'Unauthenticated.', request_id: 'r' } }] });

    tokenStore.set('expired');
    await api.get('/me').catch(() => {});
    expect(onUnauthorized).toHaveBeenCalledTimes(1);

    tokenStore.clear();
    await api.get('/me').catch(() => {});
    expect(onUnauthorized).toHaveBeenCalledTimes(1);

    setUnauthorizedHandler(() => {});
  });
});
