import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Palette, Building2, Layout, Type, Save, Upload, Eye, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useReceiptSettings, ReceiptSettings, DEFAULT_RECEIPT_SETTINGS } from '@/hooks/useReceiptSettings';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const LAYOUT_STYLES = [
  { id: 'modern', label: 'Moderno', desc: 'Design limpo com cabeçalho colorido' },
  { id: 'classic', label: 'Clássico', desc: 'Layout tradicional com bordas' },
  { id: 'minimal', label: 'Minimalista', desc: 'Simples e elegante' },
  { id: 'corporate', label: 'Corporativo', desc: 'Profissional com detalhes' },
];

const COLOR_PRESETS = [
  { name: 'Ellosuit', primary: '#1E00C8', secondary: '#F5F5FF' },
  { name: 'Azul', primary: '#2F428D', secondary: '#EFF6FF' },
  { name: 'Verde', primary: '#16A34A', secondary: '#F0FDF4' },
  { name: 'Roxo', primary: '#7C3AED', secondary: '#F5F3FF' },
  { name: 'Laranja', primary: '#EA580C', secondary: '#FFF7ED' },
  { name: 'Rosa', primary: '#DB2777', secondary: '#FDF2F8' },
  { name: 'Escuro', primary: '#18181B', secondary: '#F4F4F5' },
  { name: 'Teal', primary: '#0D9488', secondary: '#F0FDFA' },
];

export default function ReceiptThemeBuilder() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: companyId } = useQuery({
    queryKey: ['user-company', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from('company_users').select('company_id').eq('user_id', user.id).single();
      return data?.company_id || null;
    },
    enabled: !!user?.id,
  });

  const { settings, isLoading, save } = useReceiptSettings(companyId);
  const [form, setForm] = useState<ReceiptSettings>({ ...DEFAULT_RECEIPT_SETTINGS, company_id: '' });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (settings && companyId && !initializedRef.current) {
      initializedRef.current = true;
      setForm({ ...settings, company_id: companyId });
      if (settings.logo_url) setLogoPreview(settings.logo_url);
    }
  }, [settings, companyId]);

  const updateField = <K extends keyof ReceiptSettings>(key: K, value: ReceiptSettings[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleLogoUpload = async (file: File) => {
    if (!companyId) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));

    const ext = file.name.split('.').pop();
    const path = `${companyId}/receipt-logo.${ext}`;
    const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true });
    if (error) {
      toast({ title: 'Erro ao enviar logo', variant: 'destructive' });
      return;
    }
    const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path);
    updateField('logo_url', urlData.publicUrl);
    toast({ title: 'Logo enviada!' });
  };

  const handleSave = async () => {
    try {
      await save.mutateAsync(form);
      toast({ title: 'Configurações salvas com sucesso!', description: 'O novo design será aplicado a todos os recibos.' });
    } catch {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    }
  };

  const fmtBRL = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-300 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard/recibos')} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
              <ArrowLeft className="h-5 w-5 text-gray-500" />
            </button>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-foreground">Design do Recibo</h1>
              <p className="text-sm text-muted-foreground">Configure a aparência padrão dos seus recibos</p>
            </div>
          </div>
          <Button
            onClick={handleSave}
            disabled={save.isPending}
            className="rounded-xl h-11 gap-2 text-white shadow-lg"
            style={{ background: form.primary_color }}
          >
            {save.isPending ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Settings Panel */}
          <div className="space-y-4">
            <Tabs defaultValue="company" className="w-full">
              <TabsList className="w-full grid grid-cols-4 h-11 rounded-xl bg-gray-100">
                <TabsTrigger value="company" className="rounded-lg text-xs gap-1.5 data-[state=active]:shadow-sm">
                  <Building2 className="h-3.5 w-3.5" /> Empresa
                </TabsTrigger>
                <TabsTrigger value="colors" className="rounded-lg text-xs gap-1.5 data-[state=active]:shadow-sm">
                  <Palette className="h-3.5 w-3.5" /> Cores
                </TabsTrigger>
                <TabsTrigger value="layout" className="rounded-lg text-xs gap-1.5 data-[state=active]:shadow-sm">
                  <Layout className="h-3.5 w-3.5" /> Layout
                </TabsTrigger>
                <TabsTrigger value="text" className="rounded-lg text-xs gap-1.5 data-[state=active]:shadow-sm">
                  <Type className="h-3.5 w-3.5" /> Texto
                </TabsTrigger>
              </TabsList>

              {/* Company Tab */}
              <TabsContent value="company" className="mt-4 space-y-4">
                <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
                  <h3 className="font-semibold text-sm text-foreground">Informações da Empresa</h3>

                  {/* Logo Upload */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Logomarca</Label>
                    <div className="mt-1.5 flex items-center gap-3">
                      {(logoPreview || form.logo_url) ? (
                        <div className="relative w-16 h-16 rounded-xl border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
                          <img src={logoPreview || form.logo_url || ''} alt="Logo" className="max-w-full max-h-full object-contain" />
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center">
                          <Upload className="h-5 w-5 text-gray-300" />
                        </div>
                      )}
                      <div className="flex-1">
                        <label className="cursor-pointer">
                          <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleLogoUpload(e.target.files[0])} />
                          <span className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors inline-block">
                            {form.logo_url ? 'Trocar Logo' : 'Enviar Logo'}
                          </span>
                        </label>
                        {form.logo_url && (
                          <button onClick={() => { updateField('logo_url', null); setLogoPreview(null); }} className="text-xs text-red-500 ml-2">
                            Remover
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      {(['left', 'center', 'right'] as const).map(pos => (
                        <button
                          key={pos}
                          onClick={() => updateField('logo_position', pos)}
                          className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${form.logo_position === pos ? 'border-primary bg-primary/5 text-primary font-semibold' : 'border-gray-200 text-gray-500'}`}
                        >
                          {pos === 'left' ? 'Esquerda' : pos === 'center' ? 'Centro' : 'Direita'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Nome da Empresa</Label>
                      <Input value={form.company_name || ''} onChange={e => updateField('company_name', e.target.value)} placeholder="Sua Empresa Ltda" className="rounded-xl mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">CNPJ / CPF</Label>
                      <Input value={form.company_cnpj || ''} onChange={e => updateField('company_cnpj', e.target.value)} placeholder="00.000.000/0000-00" className="rounded-xl mt-1" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Endereço</Label>
                    <Input value={form.company_address || ''} onChange={e => updateField('company_address', e.target.value)} placeholder="Rua, Nº - Bairro, Cidade - UF" className="rounded-xl mt-1" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Telefone</Label>
                      <Input value={form.company_phone || ''} onChange={e => updateField('company_phone', e.target.value)} placeholder="(00) 00000-0000" className="rounded-xl mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Email</Label>
                      <Input value={form.company_email || ''} onChange={e => updateField('company_email', e.target.value)} placeholder="contato@empresa.com" className="rounded-xl mt-1" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Website</Label>
                    <Input value={form.company_website || ''} onChange={e => updateField('company_website', e.target.value)} placeholder="www.empresa.com" className="rounded-xl mt-1" />
                  </div>
                </div>
              </TabsContent>

              {/* Colors Tab */}
              <TabsContent value="colors" className="mt-4 space-y-4">
                <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
                  <h3 className="font-semibold text-sm text-foreground">Presets de Cores</h3>
                  <div className="grid grid-cols-4 gap-2">
                    {COLOR_PRESETS.map(p => (
                      <button
                        key={p.name}
                        onClick={() => { updateField('primary_color', p.primary); updateField('secondary_color', p.secondary); }}
                        className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all ${form.primary_color === p.primary ? 'border-primary ring-2 ring-primary/20' : 'border-gray-100 hover:border-gray-200'}`}
                      >
                        <div className="flex gap-0.5">
                          <div className="w-5 h-5 rounded-full" style={{ background: p.primary }} />
                          <div className="w-5 h-5 rounded-full border border-gray-200" style={{ background: p.secondary }} />
                        </div>
                        <span className="text-[10px] text-gray-600">{p.name}</span>
                      </button>
                    ))}
                  </div>

                  <h3 className="font-semibold text-sm text-foreground pt-2">Cores Personalizadas</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { key: 'primary_color' as const, label: 'Cor Principal' },
                      { key: 'secondary_color' as const, label: 'Cor Secundária' },
                      { key: 'text_color' as const, label: 'Cor do Texto' },
                      { key: 'accent_color' as const, label: 'Cor de Destaque' },
                    ]).map(c => (
                      <div key={c.key} className="flex items-center gap-2">
                        <input
                          type="color"
                          value={form[c.key]}
                          onChange={e => updateField(c.key, e.target.value)}
                          className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer"
                        />
                        <div className="flex-1">
                          <p className="text-xs text-gray-600">{c.label}</p>
                          <p className="text-[10px] text-gray-400 font-mono">{form[c.key]}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* Layout Tab */}
              <TabsContent value="layout" className="mt-4 space-y-4">
                <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
                  <h3 className="font-semibold text-sm text-foreground">Estilo do Layout</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {LAYOUT_STYLES.map(s => (
                      <button
                        key={s.id}
                        onClick={() => updateField('layout_style', s.id as any)}
                        className={`text-left p-3 rounded-xl border transition-all ${form.layout_style === s.id ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-gray-100 hover:border-gray-200'}`}
                      >
                        <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          {form.layout_style === s.id && <CheckCircle className="h-3.5 w-3.5 text-primary" />}
                          {s.label}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{s.desc}</p>
                      </button>
                    ))}
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Mostrar Bordas</Label>
                      <Switch checked={form.show_border} onCheckedChange={v => updateField('show_border', v)} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Marca d'água</Label>
                      <Switch checked={form.show_watermark} onCheckedChange={v => updateField('show_watermark', v)} />
                    </div>
                    {form.show_watermark && (
                      <Input value={form.watermark_text || ''} onChange={e => updateField('watermark_text', e.target.value)} placeholder="Texto da marca d'água" className="rounded-xl" />
                    )}
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Linha de Assinatura</Label>
                      <Switch checked={form.show_signature_line} onCheckedChange={v => updateField('show_signature_line', v)} />
                    </div>
                    {form.show_signature_line && (
                      <Input value={form.signature_label} onChange={e => updateField('signature_label', e.target.value)} placeholder="Texto da assinatura" className="rounded-xl" />
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Text Tab */}
              <TabsContent value="text" className="mt-4 space-y-4">
                <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
                  <h3 className="font-semibold text-sm text-foreground">Textos do Recibo</h3>
                  <div>
                    <Label className="text-xs text-muted-foreground">Texto do Rodapé</Label>
                    <Textarea
                      value={form.footer_text}
                      onChange={e => updateField('footer_text', e.target.value)}
                      placeholder="Documento gerado eletronicamente"
                      className="rounded-xl mt-1 min-h-[60px]"
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Live Preview */}
          <div className="sticky top-6">
            <div className="flex items-center gap-2 mb-3">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Pré-visualização</h3>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <ReceiptPreview settings={form} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReceiptPreview({ settings }: { settings: ReceiptSettings }) {
  const s = settings;
  const now = new Date();

  return (
    <div className="p-6 text-sm" style={{ color: s.text_color, fontFamily: 'system-ui' }}>
      {/* Border wrapper */}
      <div className={s.show_border ? 'border-2 rounded-xl p-5' : 'p-2'} style={s.show_border ? { borderColor: s.primary_color + '30' } : {}}>

        {/* Header */}
        {s.layout_style === 'modern' && (
          <div className="rounded-xl p-4 mb-4" style={{ background: s.primary_color }}>
            <div className={`flex items-center gap-3 ${s.logo_position === 'center' ? 'justify-center flex-col' : s.logo_position === 'right' ? 'flex-row-reverse' : ''}`}>
              {s.logo_url && <img src={s.logo_url} alt="Logo" className="h-10 w-auto object-contain" style={{ filter: 'brightness(0) invert(1)' }} />}
              <div className={s.logo_position === 'center' ? 'text-center' : ''}>
                <h2 className="text-base font-bold text-white">RECIBO</h2>
                {s.company_name && <p className="text-xs text-white/80">{s.company_name}</p>}
              </div>
            </div>
          </div>
        )}

        {s.layout_style === 'classic' && (
          <div className="text-center border-b-2 pb-3 mb-4" style={{ borderColor: s.primary_color }}>
            {s.logo_url && <img src={s.logo_url} alt="Logo" className="h-10 mx-auto mb-2 object-contain" />}
            {s.company_name && <h2 className="text-base font-bold">{s.company_name}</h2>}
            {s.company_cnpj && <p className="text-[10px]" style={{ color: s.accent_color }}>CNPJ: {s.company_cnpj}</p>}
            <h3 className="text-sm font-bold mt-2" style={{ color: s.primary_color }}>RECIBO DE PAGAMENTO</h3>
          </div>
        )}

        {s.layout_style === 'minimal' && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {s.logo_url && <img src={s.logo_url} alt="Logo" className="h-8 object-contain" />}
              {s.company_name && <span className="text-xs font-semibold" style={{ color: s.accent_color }}>{s.company_name}</span>}
            </div>
            <span className="text-xs font-bold" style={{ color: s.primary_color }}>RECIBO</span>
          </div>
        )}

        {s.layout_style === 'corporate' && (
          <div className="flex items-start justify-between mb-4 pb-3 border-b" style={{ borderColor: s.primary_color + '40' }}>
            <div>
              {s.logo_url && <img src={s.logo_url} alt="Logo" className="h-10 mb-1 object-contain" />}
              {s.company_name && <p className="text-xs font-bold">{s.company_name}</p>}
              {s.company_cnpj && <p className="text-[9px]" style={{ color: s.accent_color }}>CNPJ: {s.company_cnpj}</p>}
              {s.company_address && <p className="text-[9px]" style={{ color: s.accent_color }}>{s.company_address}</p>}
              {s.company_phone && <p className="text-[9px]" style={{ color: s.accent_color }}>Tel: {s.company_phone}</p>}
            </div>
            <div className="text-right">
              <h3 className="text-sm font-bold" style={{ color: s.primary_color }}>RECIBO</h3>
              <p className="text-[9px] font-mono" style={{ color: s.accent_color }}>REC-0001</p>
              <p className="text-[9px]" style={{ color: s.accent_color }}>{format(now, "dd/MM/yyyy", { locale: ptBR })}</p>
            </div>
          </div>
        )}

        {/* Info row */}
        <div className="flex justify-between text-[10px] mb-3" style={{ color: s.accent_color }}>
          <span>Nº REC-0001</span>
          <span>{format(now, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
        </div>

        {/* Amount */}
        <div className="rounded-lg p-3 mb-3" style={{ background: s.secondary_color }}>
          <p className="text-[10px] font-semibold mb-0.5" style={{ color: s.primary_color }}>VALOR</p>
          <p className="text-lg font-bold" style={{ color: s.primary_color }}>R$ 1.500,00</p>
        </div>

        {/* Details */}
        <div className="space-y-2 mb-4">
          {[
            { label: 'Título', value: 'Serviço de consultoria' },
            { label: 'Cliente', value: 'João da Silva' },
            { label: 'Pagamento', value: 'PIX' },
          ].map((item, i) => (
            <div key={i}>
              <p className="text-[9px] font-semibold uppercase" style={{ color: s.accent_color }}>{item.label}</p>
              <p className="text-xs">{item.value}</p>
            </div>
          ))}
        </div>

        {/* Watermark */}
        {s.show_watermark && s.watermark_text && (
          <div className="text-center my-3 opacity-10">
            <p className="text-3xl font-bold uppercase tracking-widest" style={{ color: s.primary_color }}>{s.watermark_text}</p>
          </div>
        )}

        {/* Signature */}
        {s.show_signature_line && (
          <div className="mt-6 pt-4 text-center">
            <div className="w-48 mx-auto border-t" style={{ borderColor: s.accent_color + '60' }} />
            <p className="text-[10px] mt-1" style={{ color: s.accent_color }}>{s.signature_label}</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 pt-2 border-t text-center" style={{ borderColor: s.accent_color + '20' }}>
          <p className="text-[9px]" style={{ color: s.accent_color }}>{s.footer_text}</p>
          {s.company_email && <p className="text-[9px]" style={{ color: s.accent_color }}>{s.company_email}</p>}
          {s.company_website && <p className="text-[9px]" style={{ color: s.accent_color }}>{s.company_website}</p>}
        </div>
      </div>
    </div>
  );
}
