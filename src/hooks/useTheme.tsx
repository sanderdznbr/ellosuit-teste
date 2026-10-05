import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

type ThemeMode = 'light' | 'dark';
const THEME_KEY = 'ellosuit-theme';
const THEME_SYNC_EVENT = 'ellosuit-theme-sync';

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useTheme() {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);
  const [isSyncing, setIsSyncing] = useState(false);

  // Fetch theme preference from Supabase when user logs in
  useEffect(() => {
    const fetchThemePreference = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('theme_preference')
          .eq('id', user.id)
          .single();

        if (data?.theme_preference && (data.theme_preference === 'light' || data.theme_preference === 'dark')) {
          setThemeState(data.theme_preference as ThemeMode);
        }
      } catch (err) {
        console.error('Error fetching theme preference:', err);
      }
    };

    fetchThemePreference();
  }, [user]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const syncTheme = (nextTheme: ThemeMode) => {
      setThemeState((current) => (current === nextTheme ? current : nextTheme));
    };

    const handleThemeSync = (event: Event) => {
      const nextTheme = (event as CustomEvent<ThemeMode>).detail;
      if (nextTheme === 'dark' || nextTheme === 'light') {
        syncTheme(nextTheme);
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== THEME_KEY) return;
      if (event.newValue === 'dark' || event.newValue === 'light') {
        syncTheme(event.newValue);
      }
    };

    window.addEventListener(THEME_SYNC_EVENT, handleThemeSync as EventListener);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(THEME_SYNC_EVENT, handleThemeSync as EventListener);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const saveThemeToDb = useCallback(async (nextTheme: ThemeMode) => {
    if (!user) return;
    
    try {
      await supabase
        .from('profiles')
        .update({ theme_preference: nextTheme })
        .eq('id', user.id);
    } catch (err) {
      console.error('Error saving theme preference:', err);
    }
  }, [user]);

  const setTheme = useCallback((next: ThemeMode | ((prev: ThemeMode) => ThemeMode)) => {
    setThemeState((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent<ThemeMode>(THEME_SYNC_EVENT, { detail: resolved }));
      }
      saveThemeToDb(resolved);
      return resolved;
    });
  }, [saveThemeToDb]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, [setTheme]);

  return { theme, toggleTheme, setTheme };
}

