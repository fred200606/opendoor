import axios from 'axios';

const TOKEN_KEY = 'opendoor.token';

// Storage can be unavailable (private mode, blocked site data); the app must still work.
export const tokenStore = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* stays logged in for this page only */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* nothing stored */
    }
  },
};

/** Every failed API call rejects with this shape, whatever went wrong. */
export class ApiError extends Error {
  constructor({ status = 0, code, message, requestId = null, fieldErrors = {} }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.fieldErrors = fieldErrors;
  }
}

export function toApiError(error) {
  const response = error.response;

  if (!response) {
    return new ApiError({
      code: error.code === 'ERR_CANCELED' ? 'CANCELED' : error.code === 'ECONNABORTED' ? 'TIMEOUT' : 'NETWORK_ERROR',
      message: 'We could not reach OpenDoor. Check your internet connection and try again.',
    });
  }

  const body = response.data ?? {};
  const envelope = body.error ?? {};

  return new ApiError({
    status: response.status,
    code: envelope.code ?? 'UNKNOWN_ERROR',
    message: envelope.message ?? body.message ?? 'Something went wrong. Please try again.',
    requestId: envelope.request_id ?? response.headers?.['x-request-id'] ?? null,
    fieldErrors: response.status === 422 ? (body.errors ?? {}) : {},
  });
}

// The only HTTP client in the app. It talks to the API Gateway, never to services directly.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { Accept: 'application/json' },
  timeout: 20_000,
});

let handleUnauthorized = () => {};

/** AuthContext registers what happens when a stored token stops working (logout + go to /login). */
export function setUnauthorizedHandler(handler) {
  handleUnauthorized = handler;
}

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const apiError = toApiError(error);
    const sentToken = Boolean(error.config?.headers?.Authorization);

    if (apiError.status === 401 && sentToken) handleUnauthorized(apiError);

    return Promise.reject(apiError);
  },
);
