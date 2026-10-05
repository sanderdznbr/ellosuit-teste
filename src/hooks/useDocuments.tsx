
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

interface Document {
  id: string;
  name: string;
  description?: string;
  file_type: string;
  file_size?: number;
  file_url?: string;
  tags?: string[];
  folder_id?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

interface DocumentFolder {
  id: string;
  name: string;
  parent_folder_id?: string;
  created_at: string;
  created_by: string;
  description?: string;
  color?: string;
}

export const useDocuments = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchDocuments = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar documentos",
        variant: "destructive"
      });
    }
  };

  const fetchFolders = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('document_folders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFolders(data || []);
    } catch (error) {
      console.error('Error fetching folders:', error);
    }
  };

  const createDocument = async (documentData: Omit<Document, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
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
        .from('documents')
        .insert({
          ...documentData,
          created_by: user.id,
          company_id: companyUser.company_id
        });

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Documento criado com sucesso"
      });

      fetchDocuments();
    } catch (error) {
      console.error('Error creating document:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar documento",
        variant: "destructive"
      });
    }
  };

  const createFolder = async (name: string, parentFolderId?: string, description?: string, color?: string) => {
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
        .from('document_folders')
        .insert({
          name,
          parent_folder_id: parentFolderId,
          description,
          color,
          created_by: user.id,
          company_id: companyUser.company_id
        });

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Pasta criada com sucesso"
      });

      fetchFolders();
    } catch (error) {
      console.error('Error creating folder:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar pasta",
        variant: "destructive"
      });
    }
  };

  const deleteDocument = async (id: string) => {
    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Documento excluído com sucesso"
      });

      fetchDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir documento",
        variant: "destructive"
      });
    }
  };

  const deleteFolder = async (id: string) => {
    try {
      const { error } = await supabase
        .from('document_folders')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Pasta excluída com sucesso"
      });

      fetchFolders();
    } catch (error) {
      console.error('Error deleting folder:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir pasta",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    if (user) {
      setLoading(true);
      Promise.all([fetchDocuments(), fetchFolders()]).finally(() => {
        setLoading(false);
      });
    }
  }, [user]);

  return {
    documents,
    folders,
    loading,
    createDocument,
    createFolder,
    deleteDocument,
    deleteFolder,
    refetch: () => Promise.all([fetchDocuments(), fetchFolders()])
  };
};
