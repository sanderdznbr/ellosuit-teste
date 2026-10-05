import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export const useAdminMaster = () => {
  const { user, loading: authLoading } = useAuth();
  const [isAdminMaster, setIsAdminMaster] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wait for auth to finish loading before making any decision
    if (authLoading) {
      return;
    }

    if (!user?.id) {
      setIsAdminMaster(false);
      setLoading(false);
      return;
    }

    const check = async () => {
      try {
        const { data } = await supabase
          .from('company_users')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'adminmaster')
          .maybeSingle();

        setIsAdminMaster(!!data);
      } catch {
        setIsAdminMaster(false);
      } finally {
        setLoading(false);
      }
    };

    check();
  }, [user?.id, authLoading]);

  const callAdminApi = async (action: string, params?: Record<string, string>, body?: unknown) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const queryParams = new URLSearchParams({ action, ...params });
    const url = `https://jwddiyuezqrpuakazvgg.supabase.co/functions/v1/admin-impersonate?${queryParams}`;

    const options: RequestInit = {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3ZGRpeXVlenFycHVha2F6dmdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEzNDIzNTgsImV4cCI6MjA2NjkxODM1OH0.CrUu3HGCfWh6cPfGsbDXGQNG5AWOsi9X2GGix1-7izg',
      },
    };

    if (body) options.body = JSON.stringify(body);

    const res = await fetch(url, options);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'API Error');
    }
    return res.json();
  };

  return { isAdminMaster, loading, callAdminApi };
};
