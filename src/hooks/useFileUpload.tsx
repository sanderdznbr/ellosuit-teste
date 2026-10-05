
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

export const useFileUpload = () => {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const uploadFile = async (file: File, bucket: string = 'logos'): Promise<string | null> => {
    if (!file) return null;

    try {
      setUploading(true);
      
      // Gerar nome único para o arquivo
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      
      // Upload do arquivo
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Erro no upload:', error);
        toast({
          title: "Erro",
          description: "Erro ao fazer upload do arquivo",
          variant: "destructive"
        });
        return null;
      }

      // Obter URL pública
      const { data: publicUrlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      return publicUrlData.publicUrl;
    } catch (error) {
      console.error('Erro no upload:', error);
      toast({
        title: "Erro",
        description: "Erro ao fazer upload do arquivo",
        variant: "destructive"
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const deleteFile = async (url: string, bucket: string = 'logos'): Promise<boolean> => {
    try {
      // Extrair o path da URL
      const urlParts = url.split('/');
      const fileName = urlParts[urlParts.length - 1];
      
      const { error } = await supabase.storage
        .from(bucket)
        .remove([fileName]);

      if (error) {
        console.error('Erro ao deletar arquivo:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Erro ao deletar arquivo:', error);
      return false;
    }
  };

  return {
    uploadFile,
    deleteFile,
    uploading
  };
};
