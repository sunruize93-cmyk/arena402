'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ArenaAuthSession } from '@/lib/arena-http';
import {
  getArenaAuthSession,
  subscribeArenaAuthSession,
} from '@/lib/arena-http';

interface AuthSessionContextValue {
  session: ArenaAuthSession | null;
  loading: boolean;
  refresh: (force?: boolean) => Promise<ArenaAuthSession | null>;
}

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export default function AuthSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<ArenaAuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (force = false) => {
    try {
      const nextSession = await getArenaAuthSession({ force });
      setSession(nextSession);
      return nextSession;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeArenaAuthSession((nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });
    void refresh();
    return unsubscribe;
  }, [refresh]);

  useEffect(() => {
    const refreshVisibleSession = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', refreshVisibleSession);
    document.addEventListener('visibilitychange', refreshVisibleSession);
    return () => {
      window.removeEventListener('focus', refreshVisibleSession);
      document.removeEventListener('visibilitychange', refreshVisibleSession);
    };
  }, [refresh]);

  const value = useMemo(
    () => ({ session, loading, refresh }),
    [loading, refresh, session],
  );

  return (
    <AuthSessionContext.Provider value={value}>
      {children}
    </AuthSessionContext.Provider>
  );
}

export function useAuthSession(): AuthSessionContextValue {
  const value = useContext(AuthSessionContext);
  if (!value) {
    throw new Error('useAuthSession must be used inside AuthSessionProvider');
  }
  return value;
}
