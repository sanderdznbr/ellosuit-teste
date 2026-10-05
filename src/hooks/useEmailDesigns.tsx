
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

interface EmailDesign {
  id: string;
  name: string;
  description?: string;
  design_data: any;
  thumbnail_url?: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export const useEmailDesigns = () => {
  const [designs, setDesigns] = useState<EmailDesign[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchDesigns = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('email_designs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDesigns(data || []);
    } catch (error) {
      console.error('Error fetching designs:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar designs",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createDesign = async (designData: Omit<EmailDesign, 'id' | 'created_at' | 'updated_at'>) => {
    if (!user) return;

    try {
      const { data: companyUser } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!companyUser) throw new Error('Usuário não associado a empresa');

      const { error } = await supabase
        .from('email_designs')
        .insert({
          ...designData,
          user_id: user.id,
          company_id: companyUser.company_id
        });

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Design criado com sucesso"
      });

      fetchDesigns();
    } catch (error) {
      console.error('Error creating design:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar design",
        variant: "destructive"
      });
    }
  };

  const updateDesign = async (id: string, updates: Partial<EmailDesign>) => {
    try {
      const { error } = await supabase
        .from('email_designs')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Design atualizado com sucesso"
      });

      fetchDesigns();
    } catch (error) {
      console.error('Error updating design:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar design",
        variant: "destructive"
      });
    }
  };

  const deleteDesign = async (id: string) => {
    try {
      const { error } = await supabase
        .from('email_designs')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Design excluído com sucesso"
      });

      fetchDesigns();
    } catch (error) {
      console.error('Error deleting design:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir design",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    if (user) {
      fetchDesigns();
    }
  }, [user?.id]);

  return {
    designs,
    loading,
    createDesign,
    updateDesign,
    deleteDesign,
    refetch: fetchDesigns
  };
};
