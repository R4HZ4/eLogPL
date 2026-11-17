import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { StaffAccount } from '../types/training';
import { handleStaticApiRequest } from '../utils/staticFallbackApi';

const TOKEN_STORAGE_KEY = 'motac_logbook_token_v1';

interface AuthContextValue {
  user: StaffAccount | null;
  token: string | null;
  loading: boolean;
  login: (noKp: string, password: string, roleMode?: 'staff' | 'admin') => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  apiFetch: <T>(url: string, init?: RequestInit) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function isJsonResponse(res: Response): boolean {
  const ct = res.headers.get('content-type') ?? '';
  return ct.includes('application/json');
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [user, setUser] = useState<StaffAccount | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const persistToken = useCallback((nextToken: string | null) => {
    setToken(nextToken);
    try {
      if (nextToken) {
        window.localStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
      } else {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    } catch {
      // Abaikan ralat storan pelayar
    }
  }, []);

  const apiFetch = useCallback(
    async <T,>(url: string, init: RequestInit = {}): Promise<T> => {
      const activeToken = token ?? window.localStorage.getItem(TOKEN_STORAGE_KEY);
      if (activeToken?.startsWith('static.')) {
        return handleStaticApiRequest<T>(url, init, activeToken);
      }

      const headers = new Headers(init.headers);
      if (!headers.has('Content-Type') && init.body) {
        headers.set('Content-Type', 'application/json');
      }
      if (activeToken) {
        headers.set('Authorization', `Bearer ${activeToken}`);
      }

      try {
        const response = await fetch(url, { ...init, headers });
        if (!isJsonResponse(response)) {
          return handleStaticApiRequest<T>(url, init, activeToken);
        }
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            typeof data?.error === 'string'
              ? data.error
              : 'Permintaan pelayan gagal diproses.'
          );
        }
        return data as T;
      } catch (err) {
        if (err instanceof TypeError) {
          return handleStaticApiRequest<T>(url, init, activeToken);
        }
        throw err;
      }
    },
    [token]
  );

  const refreshUser = useCallback(async () => {
    const activeToken = token ?? window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!activeToken) {
      return;
    }
    if (activeToken.startsWith('static.')) {
      try {
        const data = await handleStaticApiRequest<{ user: StaffAccount }>(
          '/api/auth/me',
          {},
          activeToken
        );
        setUser(data.user);
      } catch {
        persistToken(null);
        setUser(null);
      }
      return;
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      if (!isJsonResponse(res)) {
        const data = await handleStaticApiRequest<{ user: StaffAccount }>(
          '/api/auth/me',
          {},
          activeToken
        );
        setUser(data.user);
        return;
      }
      if (!res.ok) {
        persistToken(null);
        setUser(null);
      } else {
        const data = (await res.json()) as { user: StaffAccount };
        setUser(data.user);
      }
    } catch {
      // Abaikan jika sesi belum wujud
    }
  }, [token, persistToken]);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      await refreshUser();
      if (!cancelled) {
        setLoading(false);
      }
    };
    void init();
    return () => {
      cancelled = true;
    };
  }, [refreshUser]);

  const login = useCallback(
    async (noKp: string, password: string, roleMode: 'staff' | 'admin' = 'staff') => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ noKp, password, roleMode }),
        });
        if (!isJsonResponse(res)) {
          const data = await handleStaticApiRequest<{ token: string; user: StaffAccount }>(
            '/api/auth/login',
            {
              method: 'POST',
              body: JSON.stringify({ noKp, password, roleMode }),
            }
          );
          persistToken(data.token);
          setUser(data.user);
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || 'Log masuk gagal.');
        }
        persistToken(data.token);
        setUser(data.user);
      } catch (err) {
        if (err instanceof TypeError) {
          const data = await handleStaticApiRequest<{ token: string; user: StaffAccount }>(
            '/api/auth/login',
            {
              method: 'POST',
              body: JSON.stringify({ noKp, password, roleMode }),
            }
          );
          persistToken(data.token);
          setUser(data.user);
          return;
        }
        throw err;
      }
    },
    [persistToken]
  );

  const logout = useCallback(() => {
    persistToken(null);
    setUser(null);
  }, [persistToken]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        refreshUser,
        apiFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth mesti digunakan di dalam AuthProvider.');
  }
  return ctx;
}
