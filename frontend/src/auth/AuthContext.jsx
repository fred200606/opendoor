import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as authApi from '../api/auth.js';
import { setUnauthorizedHandler, tokenStore } from '../api/client.js';
import { fromApi, saveDisplayPrefs } from '../lib/displayPrefs.js';

const AuthContext = createContext(null);

/**
 * M13: settings saved with the account win over this browser's copy (null = never saved). Applied
 * before the user is set, so pages that read the browser copy on their first render see them.
 */
function applyAccountDisplayPrefs(user) {
  if (user?.display_prefs) saveDisplayPrefs(fromApi(user.display_prefs));
}

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
  // Where GuestRoute sends the user right after login/register ({ pathname, state }).
  const [afterLogin, setAfterLogin] = useState(null);

  const clearSession = useCallback(() => {
    tokenStore.clear();
    setToken(null);
    setUser(null);
  }, []);

  const startSession = useCallback(({ token: newToken, user: newUser }, redirectTo) => {
    applyAccountDisplayPrefs(newUser);
    tokenStore.set(newToken);
    setToken(newToken);
    setUser(newUser);
    setStatus('ready');
    setAfterLogin(redirectTo ? redirectTo(newUser) : null);
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
        if (cancelled) return;
        applyAccountDisplayPrefs(currentUser);
        setUser(currentUser);
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

  /** `redirectTo(user)` → { pathname, state? } chooses where to go next (default: the role's portal). */
  const login = useCallback(
    async (credentials, redirectTo) => startSession(await authApi.login(credentials), redirectTo),
    [startSession],
  );

  const register = useCallback(
    async (details, redirectTo) => startSession(await authApi.register(details), redirectTo),
    [startSession],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // The token is dropped locally either way.
    }
    clearSession();
    setAfterLogin(null);
    setStatus('signedOut'); // ProtectedRoute sends the user home instead of to /login
  }, [clearSession]);

  const value = useMemo(
    () => ({ user, role: user?.role ?? null, token, status, afterLogin, login, register, logout }),
    [user, token, status, afterLogin, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// oxlint-disable-next-line react/only-export-components -- hook belongs next to its provider
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
