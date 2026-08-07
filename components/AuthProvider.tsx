'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export interface SessionUser {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
}

interface AuthContextValue {
  user: SessionUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (returnTo?: string) => void;
  logout: () => void;
  refresh: () => Promise<void>;
  apiFetch: (input: string, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session', { cache: 'no-store' });
      const data = await res.json();
      setUser(data.authenticated ? data.user : null);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback((returnTo?: string) => {
    const target = returnTo ?? window.location.pathname;
    window.location.href = `/api/auth/login?returnTo=${encodeURIComponent(target)}`;
  }, []);

  const logout = useCallback(() => {
    window.location.href = '/api/auth/logout';
  }, []);

  const apiFetch = useCallback(
    async (input: string, init: RequestInit = {}) => {
      const method = (init.method ?? 'GET').toUpperCase();
      const headers = new Headers(init.headers);
      if (MUTATING.has(method)) headers.set('X-MakerHub-Auth', '1');
      const res = await fetch(input, { ...init, method, headers, credentials: 'same-origin' });
      if (res.status === 401) {
        // No refresh-token flow in v1: an expired/invalid token means the
        // user must sign in again. Update local state so the UI reflects
        // it; the caller is responsible for surfacing a "please sign in
        // again" message rather than retrying blindly.
        refresh();
      }
      return res;
    },
    [refresh]
  );

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: user !== null, isLoading, login, logout, refresh, apiFetch }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
