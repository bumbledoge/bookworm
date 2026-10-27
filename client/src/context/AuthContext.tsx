import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AUTH_EXPIRED_EVENT, authApi, tokenStore, type RegisterInput } from '@/services/api';
import type { User } from '@/types';

export type DemoAccount = 'customer' | 'admin' | 'guest';

/** Credentials created by the backend seed script (`server/prisma/seed.ts`). */
export const DEMO_ACCOUNTS: Record<Exclude<DemoAccount, 'guest'>, { email: string; password: string }> = {
  customer: { email: 'demo@bookworm.com', password: 'Password123!' },
  admin: { email: 'admin@bookworm.com', password: 'Admin123!' },
};

interface AuthContextValue {
  user: User | null;
  /** True until the initial session (stored token or new guest) is resolved. */
  loading: boolean;
  isGuest: boolean;
  isAdmin: boolean;
  pointsBalance: number;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  switchDemoAccount: (account: DemoAccount) => Promise<void>;
  /** Re-fetches the profile, e.g. after points are spent at checkout. */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Prevents React StrictMode's double effect from creating two guest sessions.
  const initStarted = useRef(false);
  // Init handles its own stale-token fallback; the expiry event must not start a second guest session.
  const initializing = useRef(true);

  const applySession = useCallback((token: string, nextUser: User) => {
    tokenStore.set(token, nextUser.isGuest);
    setUser(nextUser);
  }, []);

  const startGuest = useCallback(async () => {
    tokenStore.clear();
    const { token, user: guest } = await authApi.guest();
    applySession(token, guest);
  }, [applySession]);

  useEffect(() => {
    if (initStarted.current) return;
    initStarted.current = true;

    (async () => {
      try {
        if (tokenStore.get()) {
          setUser(await authApi.me());
          return;
        }
      } catch {
        // Stored token is stale/invalid: fall through to a fresh guest session.
      }
      try {
        await startGuest();
      } catch {
        setUser(null);
      }
    })().finally(() => {
      initializing.current = false;
      setLoading(false);
    });
  }, [startGuest]);

  // The Axios layer clears a rejected token and raises this event.
  useEffect(() => {
    const onExpired = () => {
      if (initializing.current) return;
      startGuest().catch(() => setUser(null));
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, [startGuest]);

  // The guest token (if any) is still attached to these calls, so the server merges the guest cart.
  const login = useCallback(
    async (email: string, password: string) => {
      const { token, user: next } = await authApi.login(email, password);
      applySession(token, next);
    },
    [applySession],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const { token, user: next } = await authApi.register(input);
      applySession(token, next);
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    await startGuest();
  }, [startGuest]);

  const switchDemoAccount = useCallback(
    async (account: DemoAccount) => {
      if (account === 'guest') {
        await startGuest();
        return;
      }
      const { email, password } = DEMO_ACCOUNTS[account];
      await login(email, password);
    },
    [login, startGuest],
  );

  const refreshUser = useCallback(async () => {
    try {
      setUser(await authApi.me());
    } catch {
      // Leave the current user in place; a 401 is handled by the expiry event.
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isGuest: user?.isGuest ?? true,
      isAdmin: user?.role === 'ADMIN',
      pointsBalance: user?.giftPoints ?? 0,
      login,
      register,
      logout,
      switchDemoAccount,
      refreshUser,
    }),
    [user, loading, login, register, logout, switchDemoAccount, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
