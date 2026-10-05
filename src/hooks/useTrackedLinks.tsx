import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface TrackedLink {
  id: string;
  original_url: string;
  short_code: string;
  title: string | null;
  clicks: number;
  unique_visitors: number;
  is_active: boolean;
  created_at: string;
}

export interface LinkClick {
  id: string;
  link_id: string;
  ip_address: unknown;
  user_agent: string | null;
  referrer: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  clicked_at: string;
}

export const useTrackedLinks = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [links, setLinks] = useState<TrackedLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Get company ID
  useEffect(() => {
    const fetchCompanyId = async () => {
      if (!user?.id) return;

      const { data, error } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!error && data?.company_id) {
        setCompanyId(data.company_id);
      }
    };

    fetchCompanyId();
  }, [user?.id]);

  const loadLinks = async () => {
    if (!user?.id) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('tracked_links')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading links:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar links',
        variant: 'destructive',
      });
    } else {
      setLinks(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user?.id) {
      loadLinks();
    }
  }, [user?.id]);

  const generateShortCode = () => {
    return Math.random().toString(36).substring(2, 8);
  };

  const createLink = async (originalUrl: string, title?: string) => {
    if (!user?.id || !companyId) {
      toast({
        title: 'Erro',
        description: 'Usuário não autenticado',
        variant: 'destructive',
      });
      return null;
    }

    const shortCode = generateShortCode();

    const { data, error } = await supabase
      .from('tracked_links')
      .insert({
        user_id: user.id,
        company_id: companyId,
        original_url: originalUrl,
        short_code: shortCode,
        title: title || null,
        clicks: 0,
        unique_visitors: 0,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating link:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao criar link',
        variant: 'destructive',
      });
      return null;
    }

    toast({
      title: 'Sucesso!',
      description: 'Link rastreável criado com sucesso',
    });

    await loadLinks();
    return data;
  };

  const deleteLink = async (linkId: string) => {
    const { error } = await supabase
      .from('tracked_links')
      .delete()
      .eq('id', linkId);

    if (error) {
      console.error('Error deleting link:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao remover link',
        variant: 'destructive',
      });
      return false;
    }

    toast({
      title: 'Link removido',
    });

    await loadLinks();
    return true;
  };

  const toggleLinkStatus = async (linkId: string, isActive: boolean) => {
    const { error } = await supabase
      .from('tracked_links')
      .update({ is_active: !isActive })
      .eq('id', linkId);

    if (error) {
      console.error('Error toggling link status:', error);
      return false;
    }

    await loadLinks();
    return true;
  };

  const getLinkClicks = async (linkId: string): Promise<LinkClick[]> => {
    const { data, error } = await supabase
      .from('link_clicks')
      .select('*')
      .eq('link_id', linkId)
      .order('clicked_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching clicks:', error);
      return [];
    }

    return data || [];
  };

  const totalClicks = links.reduce((sum, link) => sum + (link.clicks || 0), 0);
  const totalUniqueVisitors = links.reduce((sum, link) => sum + (link.unique_visitors || 0), 0);

  return {
    links,
    loading,
    createLink,
    deleteLink,
    toggleLinkStatus,
    getLinkClicks,
    refetch: loadLinks,
    totalClicks,
    totalUniqueVisitors,
  };
};
