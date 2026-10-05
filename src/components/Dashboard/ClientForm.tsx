 import React, { useState, useEffect, useCallback, useMemo } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, User, Building2, MapPin, Globe, Phone, Mail, 
  Briefcase, Calendar, Hash, Instagram, Linkedin, Facebook,
  MessageCircle, FileText, Tag, X, Plus, CheckCircle2,
  ShoppingCart, DollarSign, Package, CreditCard, Truck, Receipt, Clock, Link2
} from 'lucide-react';

interface ClientFormProps {
  client?: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (clientData: any) => void;
}

// ---- Mask utilities ----
const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const maskCPF = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const maskCNPJ = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
};

const maskCPFCNPJ = (v: string) => {
  const digits = v.replace(/\D/g, '');
  return digits.length > 11 ? maskCNPJ(v) : maskCPF(v);
};

const maskCEP = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
};

const maskCurrency = (v: string) => {
  const d = v.replace(/\D/g, '');
  if (!d) return '';
  const num = parseInt(d, 10) / 100;
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

 const ClientForm = ({ client, open, onOpenChange, onSave }: ClientFormProps) => {
   const { user } = useAuth();
   const [customTypes, setCustomTypes] = useState<any[]>([]);
 
   useEffect(() => {
     const fetchCustomTypes = async () => {
       if (!user) return;
       const { data: compData } = await supabase
         .from('company_users')
         .select('company_id')
         .eq('user_id', user.id)
         .single();
       
       if (compData) {
         const { data } = await supabase
           .from('client_custom_types')
           .select('*')
           .eq('company_id', compData.company_id);
         if (data) setCustomTypes(data);
       }
     };
     if (open) fetchCustomTypes();
   }, [user, open]);
 
   const typeOptions = useMemo(() => {
     const base = [
       { value: 'cliente', label: 'Cliente' },
       { value: 'fornecedor', label: 'Fornecedor' },
       { value: 'prospecto', label: 'Prospecto' },
       { value: 'colaborador', label: 'Colaborador' },
     ];
     return [...base, ...customTypes.map(t => ({ value: t.value, label: t.label }))];
   }, [customTypes]);
 
  const [activeTab, setActiveTab] = useState('personal');
  const [tagInput, setTagInput] = useState('');

  const getInitialData = useCallback(() => {
    const cf = client?.custom_fields || {};
    return {
      name: client?.name || '',
      email: client?.email || '',
      phone: client?.phone || '',
      whatsapp: client?.whatsapp || '',
      whatsapp_business: client?.whatsapp_business || '',
      birth_date: client?.birth_date || '',
      profession: client?.profession || '',
      avatar_url: client?.avatar_url || '',
      company_name: client?.company_name || '',
      cnpj_cpf: client?.cnpj_cpf || '',
      client_type: client?.client_type || 'individual',
      company_size: client?.company_size || '',
      industry: client?.industry || '',
      annual_revenue: client?.annual_revenue ? maskCurrency(String(Math.round(client.annual_revenue * 100))) : '',
      website: client?.website || '',
      address_street: client?.address_street || '',
      address_number: client?.address_number || '',
      address_city: client?.address_city || '',
      address_state: client?.address_state || '',
      address_zip: client?.address_zip || '',
      linkedin: client?.linkedin || '',
      instagram: client?.instagram || '',
      facebook: client?.facebook || '',
      status: client?.status || 'active',
      notes: client?.notes || '',
      tags: client?.tags || [],
      // Custom fields
      custom_fields: {
        // Produto / Compra
        nome_produto: cf.nome_produto || '',
        valor_produto: cf.valor_produto || '',
        quantidade_produto: cf.quantidade_produto || '',
        valor_total: cf.valor_total || '',
        data_compra: cf.data_compra || '',
        numero_pedido: cf.numero_pedido || '',
        status_pedido: cf.status_pedido || '',
        metodo_pagamento: cf.metodo_pagamento || '',
        codigo_rastreio: cf.codigo_rastreio || '',
        link_boleto: cf.link_boleto || '',
        link_nota_fiscal: cf.link_nota_fiscal || '',
        cupom_desconto: cf.cupom_desconto || '',
        valor_desconto: cf.valor_desconto || '',
        // Serviço / Agendamento
        nome_servico: cf.nome_servico || '',
        valor_servico: cf.valor_servico || '',
        data_agendamento: cf.data_agendamento || '',
        hora_agendamento: cf.hora_agendamento || '',
        duracao_servico: cf.duracao_servico || '',
        local_servico: cf.local_servico || '',
        link_reuniao: cf.link_reuniao || '',
        profissional_responsavel: cf.profissional_responsavel || '',
        numero_os: cf.numero_os || '',
        status_servico: cf.status_servico || '',
        // Financeiro
        valor_fatura: cf.valor_fatura || '',
        data_vencimento: cf.data_vencimento || '',
        numero_fatura: cf.numero_fatura || '',
        status_pagamento: cf.status_pagamento || '',
        link_pagamento: cf.link_pagamento || '',
        saldo_devedor: cf.saldo_devedor || '',
        proxima_parcela: cf.proxima_parcela || '',
        valor_parcela: cf.valor_parcela || '',
      },
    };
  }, [client]);

  const [formData, setFormData] = useState(getInitialData());
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setFormData(getInitialData());
      setAvatarFile(null);
      setAvatarPreview(null);
      setActiveTab('personal');
      setTagInput('');
    }
  }, [open, getInitialData]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCustomFieldChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      custom_fields: { ...prev.custom_fields, [field]: value },
    }));
  };

  const handleMaskedChange = (field: string, value: string, maskFn: (v: string) => string) => {
    handleInputChange(field, maskFn(value));
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !formData.tags.includes(tag)) {
      handleInputChange('tags', [...formData.tags, tag]);
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    handleInputChange('tags', formData.tags.filter((t: string) => t !== tag));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;
    
    const dataToSave = {
      ...formData,
      annual_revenue: formData.annual_revenue 
        ? parseFloat(formData.annual_revenue.replace(/\./g, '').replace(',', '.')) 
        : null,
    };

    if (avatarFile) {
      dataToSave.avatar_url = URL.createObjectURL(avatarFile);
    }

    onSave(dataToSave);
    onOpenChange(false);
  };

  const initials = formData.name
    ? formData.name.split(' ').filter(Boolean).map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : '';

  const tabIcons: Record<string, React.ReactNode> = {
    personal: <User className="h-4 w-4" />,
    company: <Building2 className="h-4 w-4" />,
    address: <MapPin className="h-4 w-4" />,
    social: <Globe className="h-4 w-4" />,
    extras: <Package className="h-4 w-4" />,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-0">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background border-b px-6 pt-6 pb-4">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <User className="h-5 w-5 text-primary" />
              </div>
              {client ? 'Editar Contato' : 'Novo Contato'}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
            <TabsList className="grid w-full grid-cols-5 h-11">
              {(['personal', 'company', 'address', 'social', 'extras'] as const).map(tab => (
                <TabsTrigger key={tab} value={tab} className="flex items-center gap-1.5 text-xs sm:text-sm">
                  {tabIcons[tab]}
                  <span className="hidden sm:inline">
                    {tab === 'personal' ? 'Pessoal' : tab === 'company' ? 'Empresa' : tab === 'address' ? 'Endereço' : tab === 'social' ? 'Social' : 'Adicionais'}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div className="px-6 pb-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            {/* ====== PERSONAL ====== */}
            <TabsContent value="personal" className="space-y-5 mt-4">
              {/* Avatar */}
              <div className="flex items-center gap-5">
                <label htmlFor="avatar-upload" className="cursor-pointer group relative">
                  <Avatar className="h-20 w-20 ring-2 ring-muted group-hover:ring-primary transition-colors">
                    <AvatarImage src={avatarPreview || formData.avatar_url} />
                    <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                      {initials || <User className="h-6 w-6" />}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Upload className="h-5 w-5 text-white" />
                  </div>
                  <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </label>
                <div>
                  <p className="font-medium text-sm">Foto do contato</p>
                  <p className="text-xs text-muted-foreground">Clique para alterar. JPG, PNG até 5MB</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-medium flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-muted-foreground" /> Nome Completo *
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Ex: João da Silva"
                    className="rounded-xl"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-medium flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" /> Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="joao@empresa.com.br"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs font-medium flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" /> Telefone
                  </Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleMaskedChange('phone', e.target.value, maskPhone)}
                    placeholder="(11) 99999-9999"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="whatsapp" className="text-xs font-medium flex items-center gap-1.5">
                    <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" /> WhatsApp
                  </Label>
                  <Input
                    id="whatsapp"
                    value={formData.whatsapp}
                    onChange={(e) => handleMaskedChange('whatsapp', e.target.value, maskPhone)}
                    placeholder="(11) 99999-9999"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="birth_date" className="text-xs font-medium flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" /> Data de Nascimento
                  </Label>
                  <Input
                    id="birth_date"
                    type="date"
                    value={formData.birth_date}
                    onChange={(e) => handleInputChange('birth_date', e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="profession" className="text-xs font-medium flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5 text-muted-foreground" /> Profissão
                  </Label>
                  <Input
                    id="profession"
                    value={formData.profession}
                    onChange={(e) => handleInputChange('profession', e.target.value)}
                    placeholder="Ex: Engenheiro de Software"
                    className="rounded-xl"
                  />
                </div>
              </div>
            </TabsContent>

            {/* ====== COMPANY ====== */}
            <TabsContent value="company" className="space-y-5 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-muted-foreground" /> Tipo
                  </Label>
                  <Select value={formData.client_type} onValueChange={(v) => handleInputChange('client_type', v)}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">Pessoa Física</SelectItem>
                      <SelectItem value="company">Pessoa Jurídica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cnpj_cpf" className="text-xs font-medium flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5 text-muted-foreground" /> CPF / CNPJ
                  </Label>
                  <Input
                    id="cnpj_cpf"
                    value={formData.cnpj_cpf}
                    onChange={(e) => handleMaskedChange('cnpj_cpf', e.target.value, maskCPFCNPJ)}
                    placeholder={formData.client_type === 'company' ? '00.000.000/0000-00' : '000.000.000-00'}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="company_name" className="text-xs font-medium flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" /> Nome da Empresa
                  </Label>
                  <Input
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) => handleInputChange('company_name', e.target.value)}
                    placeholder="Ex: Tech Solutions Ltda"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="website" className="text-xs font-medium flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground" /> Website
                  </Label>
                  <Input
                    id="website"
                    value={formData.website}
                    onChange={(e) => handleInputChange('website', e.target.value)}
                    placeholder="https://www.empresa.com.br"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Setor</Label>
                  <Select value={formData.industry} onValueChange={(v) => handleInputChange('industry', v)}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="technology">Tecnologia</SelectItem>
                      <SelectItem value="healthcare">Saúde</SelectItem>
                      <SelectItem value="finance">Financeiro</SelectItem>
                      <SelectItem value="education">Educação</SelectItem>
                      <SelectItem value="retail">Varejo</SelectItem>
                      <SelectItem value="manufacturing">Manufatura</SelectItem>
                      <SelectItem value="services">Serviços</SelectItem>
                      <SelectItem value="construction">Construção</SelectItem>
                      <SelectItem value="food">Alimentação</SelectItem>
                      <SelectItem value="logistics">Logística</SelectItem>
                      <SelectItem value="legal">Jurídico</SelectItem>
                      <SelectItem value="other">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Tamanho da Empresa</Label>
                  <Select value={formData.company_size} onValueChange={(v) => handleInputChange('company_size', v)}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione o porte" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mei">MEI</SelectItem>
                      <SelectItem value="1-10">1-10 funcionários</SelectItem>
                      <SelectItem value="11-50">11-50 funcionários</SelectItem>
                      <SelectItem value="51-200">51-200 funcionários</SelectItem>
                      <SelectItem value="201-500">201-500 funcionários</SelectItem>
                      <SelectItem value="500+">500+ funcionários</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-full space-y-1.5">
                  <Label htmlFor="annual_revenue" className="text-xs font-medium">Faturamento Anual (R$)</Label>
                  <Input
                    id="annual_revenue"
                    value={formData.annual_revenue}
                    onChange={(e) => handleMaskedChange('annual_revenue', e.target.value, maskCurrency)}
                    placeholder="0,00"
                    className="rounded-xl"
                  />
                </div>
              </div>
            </TabsContent>

            {/* ====== ADDRESS ====== */}
            <TabsContent value="address" className="space-y-5 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="address_zip" className="text-xs font-medium flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> CEP
                  </Label>
                  <Input
                    id="address_zip"
                    value={formData.address_zip}
                    onChange={(e) => handleMaskedChange('address_zip', e.target.value, maskCEP)}
                    placeholder="00000-000"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="address_state" className="text-xs font-medium">Estado</Label>
                  <Select value={formData.address_state} onValueChange={(v) => handleInputChange('address_state', v)}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione o estado" /></SelectTrigger>
                    <SelectContent>
                      {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => (
                        <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="address_city" className="text-xs font-medium">Cidade</Label>
                  <Input
                    id="address_city"
                    value={formData.address_city}
                    onChange={(e) => handleInputChange('address_city', e.target.value)}
                    placeholder="Ex: São Paulo"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="address_street" className="text-xs font-medium">Rua / Logradouro</Label>
                  <Input
                    id="address_street"
                    value={formData.address_street}
                    onChange={(e) => handleInputChange('address_street', e.target.value)}
                    placeholder="Ex: Av. Paulista"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="address_number" className="text-xs font-medium">Número</Label>
                  <Input
                    id="address_number"
                    value={formData.address_number}
                    onChange={(e) => handleInputChange('address_number', e.target.value)}
                    placeholder="Ex: 1000"
                    className="rounded-xl"
                  />
                </div>
              </div>
            </TabsContent>

            {/* ====== SOCIAL / TAGS / NOTES ====== */}
            <TabsContent value="social" className="space-y-5 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="linkedin" className="text-xs font-medium flex items-center gap-1.5">
                    <Linkedin className="h-3.5 w-3.5 text-muted-foreground" /> LinkedIn
                  </Label>
                  <Input
                    id="linkedin"
                    value={formData.linkedin}
                    onChange={(e) => handleInputChange('linkedin', e.target.value)}
                    placeholder="https://linkedin.com/in/usuario"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="instagram" className="text-xs font-medium flex items-center gap-1.5">
                    <Instagram className="h-3.5 w-3.5 text-muted-foreground" /> Instagram
                  </Label>
                  <Input
                    id="instagram"
                    value={formData.instagram}
                    onChange={(e) => handleInputChange('instagram', e.target.value)}
                    placeholder="@usuario"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="facebook" className="text-xs font-medium flex items-center gap-1.5">
                    <Facebook className="h-3.5 w-3.5 text-muted-foreground" /> Facebook
                  </Label>
                  <Input
                    id="facebook"
                    value={formData.facebook}
                    onChange={(e) => handleInputChange('facebook', e.target.value)}
                    placeholder="https://facebook.com/usuario"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="whatsapp_business" className="text-xs font-medium flex items-center gap-1.5">
                    <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" /> WhatsApp Business
                  </Label>
                  <Input
                    id="whatsapp_business"
                    value={formData.whatsapp_business}
                    onChange={(e) => handleMaskedChange('whatsapp_business', e.target.value, maskPhone)}
                    placeholder="(11) 99999-9999"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Status</Label>
                  <Select value={formData.status} onValueChange={(v) => handleInputChange('status', v)}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                      <SelectItem value="prospect">Prospecto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-muted-foreground" /> Tags
                </Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.tags.map((tag: string) => (
                    <Badge key={tag} variant="secondary" className="rounded-full gap-1 pr-1">
                      {tag}
                      <button onClick={() => removeTag(tag)} className="ml-0.5 hover:bg-muted rounded-full p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    placeholder="Digite uma tag e pressione Enter"
                    className="rounded-xl"
                  />
                  <Button type="button" variant="outline" size="icon" className="rounded-xl shrink-0" onClick={addTag}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label htmlFor="notes" className="text-xs font-medium flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" /> Observações
                </Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  rows={3}
                  placeholder="Informações adicionais sobre o contato, preferências, anotações..."
                  className="rounded-xl resize-none"
                />
              </div>
            </TabsContent>

            {/* ====== EXTRAS (Adicionais) ====== */}
            <TabsContent value="extras" className="space-y-6 mt-4">
              {/* Produto / Compra */}
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-3 text-foreground">
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" /> Produto / Compra
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Nome do Produto</Label>
                    <Input value={formData.custom_fields.nome_produto} onChange={e => handleCustomFieldChange('nome_produto', e.target.value)} placeholder="Ex: Plano Premium" className="rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Valor do Produto (R$)</Label>
                    <Input value={formData.custom_fields.valor_produto} onChange={e => handleCustomFieldChange('valor_produto', maskCurrency(e.target.value))} placeholder="0,00" className="rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Quantidade</Label>
                    <Input value={formData.custom_fields.quantidade_produto} onChange={e => handleCustomFieldChange('quantidade_produto', e.target.value)} placeholder="1" className="rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Valor Total (R$)</Label>
                    <Input value={formData.custom_fields.valor_total} onChange={e => handleCustomFieldChange('valor_total', maskCurrency(e.target.value))} placeholder="0,00" className="rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Data da Compra</Label>
                    <Input type="date" value={formData.custom_fields.data_compra} onChange={e => handleCustomFieldChange('data_compra', e.target.value)} className="rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Nº do Pedido</Label>
                    <Input value={formData.custom_fields.numero_pedido} onChange={e => handleCustomFieldChange('numero_pedido', e.target.value)} placeholder="#12345" className="rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Status do Pedido</Label>
                    <Select value={formData.custom_fields.status_pedido} onValueChange={v => handleCustomFieldChange('status_pedido', v)}>
                      <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="aprovado">Aprovado</SelectItem>
                        <SelectItem value="enviado">Enviado</SelectItem>
                        <SelectItem value="entregue">Entregue</SelectItem>
                        <SelectItem value="cancelado">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Método de Pagamento</Label>
                    <Select value={formData.custom_fields.metodo_pagamento} onValueChange={v => handleCustomFieldChange('metodo_pagamento', v)}>
                      <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                        <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                        <SelectItem value="pix">PIX</SelectItem>
                        <SelectItem value="boleto">Boleto</SelectItem>
                        <SelectItem value="transferencia">Transferência</SelectItem>
                        <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Código de Rastreio</Label>
                    <Input value={formData.custom_fields.codigo_rastreio} onChange={e => handleCustomFieldChange('codigo_rastreio', e.target.value)} placeholder="BR123456789" className="rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Cupom de Desconto</Label>
                    <Input value={formData.custom_fields.cupom_desconto} onChange={e => handleCustomFieldChange('cupom_desconto', e.target.value)} placeholder="PROMO10" className="rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Valor do Desconto (R$)</Label>
                    <Input value={formData.custom_fields.valor_desconto} onChange={e => handleCustomFieldChange('valor_desconto', maskCurrency(e.target.value))} placeholder="0,00" className="rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Link do Boleto</Label>
                    <Input value={formData.custom_fields.link_boleto} onChange={e => handleCustomFieldChange('link_boleto', e.target.value)} placeholder="https://..." className="rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Link da Nota Fiscal</Label>
                    <Input value={formData.custom_fields.link_nota_fiscal} onChange={e => handleCustomFieldChange('link_nota_fiscal', e.target.value)} placeholder="https://..." className="rounded-xl" />
                  </div>
                </div>
              </div>

              {/* Serviço / Agendamento */}
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-3 text-foreground">
                  <Calendar className="h-4 w-4 text-muted-foreground" /> Serviço / Agendamento
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Nome do Serviço</Label>
                    <Input value={formData.custom_fields.nome_servico} onChange={e => handleCustomFieldChange('nome_servico', e.target.value)} placeholder="Ex: Consultoria Premium" className="rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Valor do Serviço (R$)</Label>
                    <Input value={formData.custom_fields.valor_servico} onChange={e => handleCustomFieldChange('valor_servico', maskCurrency(e.target.value))} placeholder="0,00" className="rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Data do Agendamento</Label>
                    <Input type="date" value={formData.custom_fields.data_agendamento} onChange={e => handleCustomFieldChange('data_agendamento', e.target.value)} className="rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Hora do Agendamento</Label>
                    <Input type="time" value={formData.custom_fields.hora_agendamento} onChange={e => handleCustomFieldChange('hora_agendamento', e.target.value)} className="rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Duração</Label>
                    <Input value={formData.custom_fields.duracao_servico} onChange={e => handleCustomFieldChange('duracao_servico', e.target.value)} placeholder="Ex: 1 hora" className="rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Local</Label>
                    <Input value={formData.custom_fields.local_servico} onChange={e => handleCustomFieldChange('local_servico', e.target.value)} placeholder="Online - Zoom" className="rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Link da Reunião</Label>
                    <Input value={formData.custom_fields.link_reuniao} onChange={e => handleCustomFieldChange('link_reuniao', e.target.value)} placeholder="https://zoom.us/..." className="rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Profissional Responsável</Label>
                    <Input value={formData.custom_fields.profissional_responsavel} onChange={e => handleCustomFieldChange('profissional_responsavel', e.target.value)} placeholder="Ex: Dr. Carlos" className="rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Nº da OS</Label>
                    <Input value={formData.custom_fields.numero_os} onChange={e => handleCustomFieldChange('numero_os', e.target.value)} placeholder="OS-2026-001" className="rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Status do Serviço</Label>
                    <Select value={formData.custom_fields.status_servico} onValueChange={v => handleCustomFieldChange('status_servico', v)}>
                      <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="agendado">Agendado</SelectItem>
                        <SelectItem value="em_andamento">Em Andamento</SelectItem>
                        <SelectItem value="concluido">Concluído</SelectItem>
                        <SelectItem value="cancelado">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Financeiro */}
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-3 text-foreground">
                  <DollarSign className="h-4 w-4 text-muted-foreground" /> Financeiro
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Valor da Fatura (R$)</Label>
                    <Input value={formData.custom_fields.valor_fatura} onChange={e => handleCustomFieldChange('valor_fatura', maskCurrency(e.target.value))} placeholder="0,00" className="rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Data de Vencimento</Label>
                    <Input type="date" value={formData.custom_fields.data_vencimento} onChange={e => handleCustomFieldChange('data_vencimento', e.target.value)} className="rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Nº da Fatura</Label>
                    <Input value={formData.custom_fields.numero_fatura} onChange={e => handleCustomFieldChange('numero_fatura', e.target.value)} placeholder="FAT-001" className="rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Status do Pagamento</Label>
                    <Select value={formData.custom_fields.status_pagamento} onValueChange={v => handleCustomFieldChange('status_pagamento', v)}>
                      <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="pago">Pago</SelectItem>
                        <SelectItem value="atrasado">Atrasado</SelectItem>
                        <SelectItem value="cancelado">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Link de Pagamento</Label>
                    <Input value={formData.custom_fields.link_pagamento} onChange={e => handleCustomFieldChange('link_pagamento', e.target.value)} placeholder="https://..." className="rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Saldo Devedor (R$)</Label>
                    <Input value={formData.custom_fields.saldo_devedor} onChange={e => handleCustomFieldChange('saldo_devedor', maskCurrency(e.target.value))} placeholder="0,00" className="rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Próxima Parcela</Label>
                    <Input value={formData.custom_fields.proxima_parcela} onChange={e => handleCustomFieldChange('proxima_parcela', e.target.value)} placeholder="3/12" className="rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Valor da Parcela (R$)</Label>
                    <Input value={formData.custom_fields.valor_parcela} onChange={e => handleCustomFieldChange('valor_parcela', maskCurrency(e.target.value))} placeholder="0,00" className="rounded-xl" />
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-background border-t px-6 py-4 flex justify-between items-center">
          <p className="text-xs text-muted-foreground">
            * Campos obrigatórios
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={!formData.name.trim()} className="rounded-xl gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {client ? 'Salvar Alterações' : 'Criar Contato'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ClientForm;
