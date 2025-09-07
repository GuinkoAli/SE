'use client';

import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Session, User } from '@supabase/supabase-js';

/**
 * React context for authenticated user/session state.
 * - Uses the browser Supabase client to listen for auth state changes.
 * - Exposes `loading` to gate routes while the initial session is resolved.
 */
const AuthContext = createContext<{
  session: Session | null;
  user: User | null;
  signOut: () => void;
  loading: boolean;
}>({
  session: null,
  user: null,
  signOut: () => {},
  loading: true,
});

/**
 * AuthProvider bridges Supabase auth state into React.
 * - Fetches the current user once on mount.
 * - Subscribes to subsequent auth state changes (login/logout/refresh).
 */
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const supabase = useMemo(() => createClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Initial user fetch ensures SSR/edge-set cookies are reflected in the client.
    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error('Error fetching user:', error);
      }
      if (mounted) {
        setUser(data.user ?? null);
        // We intentionally don't rely on getSession() here; we surface user-centric state.
        setSession(null);
        setLoading(false);
        console.log('AuthContext: Initial user loaded', data.user);
      }
    };

    getUser();

    // Subscribe to auth changes (token refresh, sign-in, sign-out).
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      // Keep `loading` for initial mount only to avoid flicker on normal changes.
      console.log('AuthContext: Auth state changed', _event, session, session?.user);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  /**
   * Client-side sign out; middleware will clear cookies and redirect flow continues.
   */
  const signOut = async () => {
    await supabase.auth.signOut();
  };

  console.log('AuthContext: user', user);
  return (
    <AuthContext.Provider value={{ session, user, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Convenient hook to access auth state in client components.
 */
export const useAuth = () => useContext(AuthContext);
