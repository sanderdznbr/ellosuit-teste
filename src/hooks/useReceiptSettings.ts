import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ReceiptSettings {
  id?: string;
  company_id: string;
  company_name: string | null;
  company_cnpj: string | null;
  company_address: string | null;
  company_phone: string | null;
  company_email: string | null;
  company_website: string | null;
  logo_url: string | null;
  logo_position: 'left' | 'center' | 'right';
  primary_color: string;
  secondary_color: string;
  text_color: string;
  accent_color: string;
  layout_style: 'modern' | 'classic' | 'minimal' | 'corporate';
  show_border: boolean;
  show_watermark: boolean;
  watermark_text: string | null;
  footer_text: string;
  show_signature_line: boolean;
  signature_label: string;
}

export const DEFAULT_RECEIPT_SETTINGS: Omit<ReceiptSettings, 'company_id'> = {
  company_name: null,
  company_cnpj: null,
  company_address: null,
  company_phone: null,
  company_email: null,
  company_website: null,
  logo_url: null,
  logo_position: 'left',
  primary_color: '#1E00C8',
  secondary_color: '#F5F5FF',
  text_color: '#1E1E1E',
  accent_color: '#6B7280',
  layout_style: 'modern',
  show_border: true,
  show_watermark: false,
  watermark_text: null,
  footer_text: 'Documento gerado eletronicamente',
  show_signature_line: false,
  signature_label: 'Assinatura',
};

export function useReceiptSettings(companyId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['receipt-settings', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from('receipt_settings')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();
      if (error) throw error;
      return data as ReceiptSettings | null;
    },
    enabled: !!companyId,
  });

  const saveMutation = useMutation({
    mutationFn: async (newSettings: Partial<ReceiptSettings>) => {
      if (!companyId || !user) throw new Error('Missing context');
      
      const payload = {
        ...newSettings,
        company_id: companyId,
        created_by: user.id,
      };

      if (settings?.id) {
        const { error } = await supabase
          .from('receipt_settings')
          .update(payload)
          .eq('id', settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('receipt_settings')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipt-settings'] });
    },
  });

  const merged: ReceiptSettings = {
    ...DEFAULT_RECEIPT_SETTINGS,
    company_id: companyId || '',
    ...((settings as any) || {}),
  };

  return { settings: merged, isLoading, save: saveMutation };
}
