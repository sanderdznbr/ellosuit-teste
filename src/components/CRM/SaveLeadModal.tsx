import React, { useState } from 'react';
import { UserPlus, Mail, Phone, Building, Tag, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ConversationData {
  id: string;
  contact_phone: string;
  contact_name?: string;
  last_message?: string;
}

interface SaveLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: ConversationData | null;
  companyId: string | null;
  onSuccess?: () => void;
}

const SaveLeadModal: React.FC<SaveLeadModalProps> = ({
  isOpen,
  onClose,
  conversation,
  companyId,
  onSuccess,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company_name: '',
    client_type: 'prospecto',
    notes: '',
  });

  // Pre-fill form when conversation changes
  React.useEffect(() => {
    if (conversation) {
      setFormData({
        name: conversation.contact_name || '',
        email: '',
        phone: conversation.contact_phone || '',
        company_name: '',
        client_type: 'prospecto',
        notes: conversation.last_message ? `Última mensagem: ${conversation.last_message}` : '',
      });
    }
  }, [conversation]);

  const handleSave = async () => {
    if (!user?.id || !companyId) {
      toast({
        title: 'Erro',
        description: 'Usuário não autenticado',
        variant: 'destructive'
      });
      return;
    }

    if (!formData.name.trim()) {
      toast({
        title: 'Erro',
        description: 'Nome é obrigatório',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('clients').insert({
        name: formData.name.trim(),
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        whatsapp: conversation?.contact_phone || null,
        company_name: formData.company_name.trim() || null,
        client_type: formData.client_type,
        notes: formData.notes.trim() || null,
        status: 'active',
        company_id: companyId,
        created_by: user.id,
      });

      if (error) throw error;

      toast({
        title: 'Sucesso!',
        description: 'Lead salvo com sucesso no banco de dados',
      });

      onSuccess?.();
      onClose();
      
      // Reset form
      setFormData({
        name: '',
        email: '',
        phone: '',
        company_name: '',
        client_type: 'prospecto',
        notes: '',
      });
    } catch (error) {
      console.error('Error saving lead:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao salvar lead. Tente novamente.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-[#374DA4]" />
            Salvar como Lead
          </DialogTitle>
          <DialogDescription>
            Salve este contato no banco de dados de clientes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              placeholder="Nome do contato"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          {/* Email & Phone */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" /> Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="email@exemplo.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" /> Telefone
              </Label>
              <Input
                id="phone"
                placeholder="+55 11 99999-9999"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>

          {/* Company & Type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company" className="flex items-center gap-1">
                <Building className="h-3.5 w-3.5" /> Empresa
              </Label>
              <Input
                id="company"
                placeholder="Nome da empresa"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type" className="flex items-center gap-1">
                <Tag className="h-3.5 w-3.5" /> Tipo
              </Label>
              <Select
                value={formData.client_type}
                onValueChange={(value) => setFormData({ ...formData, client_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prospecto">Prospecto</SelectItem>
                  <SelectItem value="cliente">Cliente</SelectItem>
                  <SelectItem value="fornecedor">Fornecedor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              placeholder="Informações adicionais sobre o lead..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          {/* WhatsApp Info */}
          {conversation?.contact_phone && (
            <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-sm text-green-700 dark:text-green-300">
                <strong>WhatsApp:</strong> {conversation.contact_phone}
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                Este número será salvo automaticamente como WhatsApp do contato
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={saving || !formData.name.trim()}
              className="flex-1 bg-[#374DA4] hover:bg-[#374DA4]/90"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Salvar Lead
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SaveLeadModal;
