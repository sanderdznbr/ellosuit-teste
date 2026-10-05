
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

interface Client {
  id: string;
  name: string;
  company_name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  status: string;
  created_at: string;
  updated_at: string;
  notes?: string;
  cnpj_cpf?: string;
  address_street?: string;
  address_number?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  avatar_url?: string;
  birth_date?: string;
  profession?: string;
  website?: string;
  linkedin?: string;
  instagram?: string;
  facebook?: string;
  whatsapp_business?: string;
  tags?: string[];
  client_type?: string;
  company_size?: string;
  industry?: string;
  annual_revenue?: number;
  custom_fields?: any;
}

export const useClients = (contactType: 'cliente' | 'fornecedor' | 'prospecto' | 'all' = 'all') => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchClients = async () => {
    if (!user) return;

    try {
      // Paginação para ultrapassar o limite padrão de 1000 linhas do Supabase
      const PAGE_SIZE = 1000;
      const all: Client[] = [];
      for (let page = 0; ; page++) {
        let query = supabase
          .from('clients')
          .select('*')
          .order('created_at', { ascending: false })
          .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

        // Filtrar por tipo se não for 'all'
        if (contactType !== 'all') {
          query = query.eq('client_type', contactType);
        }

        const { data, error } = await query;
        if (error) throw error;

        all.push(...((data || []) as Client[]));
        if (!data || data.length < PAGE_SIZE) break;
      }

      setClients(all);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar contatos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createClient = async (clientData: Omit<Client, 'id' | 'created_at' | 'updated_at'>) => {
    if (!user) return;

    try {
      // Get user's company
      const { data: companyUser } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!companyUser) throw new Error('Usuário não associado a empresa');

      const { error } = await supabase
        .from('clients')
        .insert({
          ...clientData,
          created_by: user.id,
          company_id: companyUser.company_id
        });

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Contato criado com sucesso"
      });

      fetchClients();
    } catch (error) {
      console.error('Error creating client:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar contato",
        variant: "destructive"
      });
    }
  };

  const updateClient = async (id: string, updates: Partial<Client>) => {
    try {
      const { error } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Contato atualizado com sucesso"
      });

      fetchClients();
    } catch (error) {
      console.error('Error updating client:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar contato",
        variant: "destructive"
      });
    }
  };

  const deleteClient = async (id: string) => {
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Contato excluído com sucesso"
      });

      fetchClients();
    } catch (error) {
      console.error('Error deleting client:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir contato",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    if (user) {
      fetchClients();
    }
  }, [user, contactType]);

  return {
    clients,
    loading,
    createClient,
    updateClient,
    deleteClient,
    refetch: fetchClients
  };
};
