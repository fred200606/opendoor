import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as authApi from '../api/auth.js';
import { setUnauthorizedHandler, tokenStore } from '../api/client.js';

const AuthContext = createContext(null);

/**
 * Holds the logged-in user. `status` is 'loading' while a stored token is checked with GET /me,
 * then 'ready'; 'signedOut' right after the user logs out. Navigation only – the server enforces
 * every permission.
 */
export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [token, setToken] = useState(() => tokenStore.get());
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(() => (tokenStore.get() ? 'loading' : 'ready'));

  const clearSession = useCallback(() => {
    tokenStore.clear();
    setToken(null);
    setUser(null);
  }, []);

  const startSession = useCallback(({ token: newToken, user: newUser }) => {
    tokenStore.set(newToken);
    setToken(newToken);
    setUser(newUser);
    setStatus('ready');
    return newUser;
  }, []);

  // A stored token that stops working (expired, revoked, account suspended) sends the user to /login.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession();
      navigate('/login', { replace: true, state: { reason: 'expired' } });
    });
    return () => setUnauthorizedHandler(() => {});
  }, [clearSession, navigate]);

  // Restore the session once on page load.
  useEffect(() => {
    if (!tokenStore.get()) return;

    let cancelled = false;
    authApi
      .me()
      .then((currentUser) => {
        if (!cancelled) setUser(currentUser);
      })
      .catch(() => {
        if (!cancelled) clearSession();
      })
      .finally(() => {
        if (!cancelled) setStatus('ready');
      });

    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  const login = useCallback(async (credentials) => startSession(await authApi.login(credentials)), [startSession]);

  const register = useCallback(async (details) => startSession(await authApi.register(details)), [startSession]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // The token is dropped locally either way.
    }
    clearSession();
    setStatus('signedOut'); // ProtectedRoute sends the user home instead of to /login
  }, [clearSession]);

  const value = useMemo(
    () => ({ user, role: user?.role ?? null, token, status, login, register, logout }),
    [user, token, status, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// oxlint-disable-next-line react/only-export-components -- hook belongs next to its provider
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
