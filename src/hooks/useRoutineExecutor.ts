import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

const CHECK_INTERVAL = 60_000; // Check every 60 seconds

export const useRoutineExecutor = () => {
  const { user } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user) return;

    const checkRoutines = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('execute-routines');
        if (data?.executed > 0) {
          console.log(`✅ Executed ${data.executed} routine action(s)`);
        }
      } catch (e) {
        // Silent fail - routine check is background work
      }
    };

    // Check immediately on mount
    checkRoutines();

    // Then check periodically
    intervalRef.current = setInterval(checkRoutines, CHECK_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user]);
};
