import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

interface EmailTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  html_content: string;
  preview_text?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useEmailTemplates = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchTemplates = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar templates",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createTemplate = async (templateData: Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at'>) => {
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
        .from('email_templates')
        .insert({
          ...templateData,
          user_id: user.id,
          company_id: companyUser.company_id
        });

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Template criado com sucesso"
      });

      fetchTemplates();
    } catch (error) {
      console.error('Error creating template:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar template",
        variant: "destructive"
      });
    }
  };

  const updateTemplate = async (id: string, updates: Partial<EmailTemplate>) => {
    try {
      const { error } = await supabase
        .from('email_templates')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Template atualizado com sucesso"
      });

      fetchTemplates();
    } catch (error) {
      console.error('Error updating template:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar template",
        variant: "destructive"
      });
    }
  };

  const deleteTemplate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Template excluído com sucesso"
      });

      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir template",
        variant: "destructive"
      });
    }
  };

  const duplicateTemplate = async (template: EmailTemplate) => {
    await createTemplate({
      name: `${template.name} (Cópia)`,
      description: template.description,
      category: template.category,
      html_content: template.html_content,
      preview_text: template.preview_text,
      is_active: template.is_active
    });
  };

  useEffect(() => {
    if (user) {
      fetchTemplates();
    }
  }, [user?.id]);

  return {
    templates,
    loading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
    refetch: fetchTemplates
  };
};