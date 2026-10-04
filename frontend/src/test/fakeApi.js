import { api } from '../api/client.js';

/**
 * Replaces the Axios adapter so tests never hit the network.
 * routes: { 'GET /me': (config) => [status, body] | Promise<[status, body]> }
 * Unlisted routes answer 404. Returns the list of received requests.
 */
export function fakeApi(routes) {
  const calls = [];

  api.defaults.adapter = async (config) => {
    const key = `${config.method.toUpperCase()} ${config.url}`;
    calls.push({ key, config, data: typeof config.data === 'string' ? JSON.parse(config.data) : config.data });

    const route = routes[key];
    const [status, data, headers = {}] = route ? await route(config) : [404, { error: { code: 'NOT_FOUND', message: 'Not found', request_id: 'test-id' } }];
    const response = { status, data, headers, config, statusText: String(status) };

    if (status >= 200 && status < 300) return response;

    const error = new Error(`Request failed with status code ${status}`);
    error.config = config;
    error.response = response;
    error.isAxiosError = true;
    throw error;
  };

  return calls;
}
