
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, username: string, companyName: string, phone?: string) => Promise<{ data: { user: User; session: Session } | { user: User; session: null }, error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ data: { user: User; session: Session } | null, error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  signInWithGoogle: () => Promise<{ data: { provider?: string; url?: string } | null, error: AuthError | null }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      // Don't set loading=false here — let getSession handle it
    });

    // Then restore session
    const initAuth = async () => {
      const rememberMe = localStorage.getItem('ellosuit_remember_me');
      const sessionActive = sessionStorage.getItem('ellosuit_session_active');

      // If user chose NOT to stay logged in and this is a new browser session
      if (rememberMe === 'false' && !sessionActive) {
        await supabase.auth.signOut();
        if (mounted) {
          setSession(null);
          setUser(null);
          setLoading(false);
          localStorage.removeItem('ellosuit_remember_me');
        }
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (mounted) {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    };

    initAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, username: string, companyName: string, phone?: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          username,
          company_name: companyName,
          ...(phone ? { phone: phone.replace(/\D/g, '') } : {}),
        },
      },
    });
    return { data, error };
  };

  const signIn = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    
    // Try original password first
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    
    if (!error || !error.message?.includes('Invalid login credentials')) {
      return { data, error };
    }
    
    // Try lowercase password
    if (password !== password.toLowerCase()) {
      const { data: dataLower, error: errorLower } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: password.toLowerCase(),
      });
      if (!errorLower || !errorLower.message?.includes('Invalid login credentials')) {
        return { data: dataLower, error: errorLower };
      }
    }
    
    // Try uppercase password
    if (password !== password.toUpperCase()) {
      const { data: dataUpper, error: errorUpper } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: password.toUpperCase(),
      });
      if (!errorUpper || !errorUpper.message?.includes('Invalid login credentials')) {
        return { data: dataUpper, error: errorUpper };
      }
    }
    
    return { data, error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
    return { data, error };
  };

  const logout = async () => {
    await signOut();
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    signInWithGoogle,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
