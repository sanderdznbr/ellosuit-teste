import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Palette, Image, Globe, Clock, Link2, X, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface BookingLinkData {
  title: string;
  description: string;
  link_slug: string;
  duration_minutes: number;
  buffer_minutes: number;
  is_active: boolean;
  expires_at: string;
  never_expires: boolean;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  background_color: string;
  custom_message: string;
}

interface BookingLinkCustomizerProps {
  onSave: (data: Partial<BookingLinkData>) => Promise<void>;
  onCancel: () => void;
  initialData?: Partial<BookingLinkData>;
}

const PRESET_COLORS = [
  '#3600FF', '#2F428D', '#0891B2', '#059669', 
  '#CA8A04', '#DC2626', '#9333EA', '#DB2777'
];

const BookingLinkCustomizer: React.FC<BookingLinkCustomizerProps> = ({ 
  onSave, 
  onCancel,
  initialData 
}) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [data, setData] = useState<BookingLinkData>({
    title: initialData?.title || '',
    description: initialData?.description || '',
    link_slug: initialData?.link_slug || '',
    duration_minutes: initialData?.duration_minutes || 30,
    buffer_minutes: initialData?.buffer_minutes || 15,
    is_active: initialData?.is_active ?? true,
    expires_at: initialData?.expires_at || '',
    never_expires: !initialData?.expires_at,
    logo_url: initialData?.logo_url || '',
    primary_color: initialData?.primary_color || '#3600FF',
    secondary_color: initialData?.secondary_color || '#FFFFFF',
    background_color: initialData?.background_color || '#F9FAFB',
    custom_message: initialData?.custom_message || ''
  });

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleTitleChange = (title: string) => {
    setData(prev => ({
      ...prev,
      title,
      link_slug: prev.link_slug || generateSlug(title)
    }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Erro',
        description: 'Por favor, selecione uma imagem',
        variant: 'destructive'
      });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `booking-logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('logos')
        .getPublicUrl(filePath);

      setData(prev => ({ ...prev, logo_url: urlData.publicUrl }));
      toast({ title: 'Logo enviado com sucesso!' });
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({
        title: 'Erro ao enviar logo',
        description: 'Tente novamente',
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!data.title || !data.link_slug) {
      toast({
        title: 'Erro',
        description: 'Título e slug são obrigatórios',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      const submitData = {
        ...data,
        expires_at: data.never_expires ? null : (data.expires_at || null)
      };
      delete (submitData as any).never_expires;
      await onSave(submitData);
    } finally {
      setSaving(false);
    }
  };

  const getPublicUrl = (slug: string) => {
    return `https://ellosuit.online/agendamentos/${slug}`;
  };

  return (
    <div className="space-y-6">
      {/* Basic Info Card */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Globe className="h-5 w-5 text-primary" />
            Informações do Link
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="title">Título da Reunião *</Label>
              <Input
                id="title"
                value={data.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="ex: Consultoria de 30 minutos"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="slug">URL Personalizada *</Label>
              <Input
                id="slug"
                value={data.link_slug}
                onChange={(e) => setData(prev => ({ ...prev, link_slug: e.target.value }))}
                placeholder="consultoria-30min"
                className="mt-1"
              />
              {data.link_slug && (
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {getPublicUrl(data.link_slug)}
                </p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={data.description}
              onChange={(e) => setData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descreva o tipo de reunião..."
              rows={3}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="duration">Duração (minutos)</Label>
              <Input
                id="duration"
                type="number"
                value={data.duration_minutes}
                onChange={(e) => setData(prev => ({ ...prev, duration_minutes: parseInt(e.target.value) || 30 }))}
                min="15"
                max="480"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="buffer">Buffer entre reuniões (minutos)</Label>
              <Input
                id="buffer"
                type="number"
                value={data.buffer_minutes}
                onChange={(e) => setData(prev => ({ ...prev, buffer_minutes: parseInt(e.target.value) || 0 }))}
                min="0"
                max="60"
                className="mt-1"
              />
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={data.never_expires}
                  onCheckedChange={(checked) => setData(prev => ({ ...prev, never_expires: checked, expires_at: '' }))}
                />
                <Label>Link nunca expira</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={data.is_active}
                  onCheckedChange={(checked) => setData(prev => ({ ...prev, is_active: checked }))}
                />
                <Label>Link ativo</Label>
              </div>
            </div>
            
            {!data.never_expires && (
              <div>
                <Label htmlFor="expires_at">Data de Expiração</Label>
                <Input
                  id="expires_at"
                  type="datetime-local"
                  value={data.expires_at}
                  onChange={(e) => setData(prev => ({ ...prev, expires_at: e.target.value }))}
                  min={new Date().toISOString().slice(0, 16)}
                  className="mt-1"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Customization Card */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Palette className="h-5 w-5 text-primary" />
            Personalização Visual
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Logo Upload */}
          <div>
            <Label>Logo (opcional)</Label>
            <div className="mt-2 flex items-center gap-4">
              {data.logo_url ? (
                <div className="relative">
                  <img 
                    src={data.logo_url} 
                    alt="Logo" 
                    className="h-16 w-16 rounded-lg object-cover border"
                  />
                  <button
                    onClick={() => setData(prev => ({ ...prev, logo_url: '' }))}
                    className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="h-16 w-16 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
                >
                  {uploading ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  ) : (
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <div className="text-sm text-muted-foreground">
                <p>Clique para enviar um logo</p>
                <p className="text-xs">PNG, JPG até 2MB</p>
              </div>
            </div>
          </div>

          {/* Color Pickers */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Cor Principal</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {PRESET_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setData(prev => ({ ...prev, primary_color: color }))}
                    className={`w-8 h-8 rounded-lg border-2 transition-all ${
                      data.primary_color === color ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <Input
                type="color"
                value={data.primary_color}
                onChange={(e) => setData(prev => ({ ...prev, primary_color: e.target.value }))}
                className="mt-2 h-10 w-full cursor-pointer"
              />
            </div>

            <div>
              <Label>Cor Secundária</Label>
              <Input
                type="color"
                value={data.secondary_color}
                onChange={(e) => setData(prev => ({ ...prev, secondary_color: e.target.value }))}
                className="mt-2 h-10 w-full cursor-pointer"
              />
            </div>

            <div>
              <Label>Cor de Fundo</Label>
              <Input
                type="color"
                value={data.background_color}
                onChange={(e) => setData(prev => ({ ...prev, background_color: e.target.value }))}
                className="mt-2 h-10 w-full cursor-pointer"
              />
            </div>
          </div>

          {/* Custom Message */}
          <div>
            <Label htmlFor="custom_message">Mensagem Personalizada (exibida na página)</Label>
            <Textarea
              id="custom_message"
              value={data.custom_message}
              onChange={(e) => setData(prev => ({ ...prev, custom_message: e.target.value }))}
              placeholder="Uma mensagem especial para seus visitantes..."
              rows={2}
              className="mt-1"
            />
          </div>

          {/* Preview */}
          <div className="pt-4 border-t">
            <Label className="mb-3 block">Pré-visualização</Label>
            <div 
              className="rounded-xl p-6 border"
              style={{ backgroundColor: data.background_color }}
            >
              <div className="flex items-center gap-4 mb-4">
                {data.logo_url && (
                  <img src={data.logo_url} alt="Logo" className="h-12 w-12 rounded-lg object-cover" />
                )}
                <div>
                  <h3 
                    className="font-bold text-lg"
                    style={{ color: data.primary_color }}
                  >
                    {data.title || 'Título da Reunião'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {data.duration_minutes} minutos
                  </p>
                </div>
              </div>
              {data.custom_message && (
                <p className="text-sm text-muted-foreground">{data.custom_message}</p>
              )}
              <Button 
                className="mt-4 w-full"
                style={{ backgroundColor: data.primary_color, color: data.secondary_color }}
              >
                Agendar Horário
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} disabled={saving}>
          {saving ? 'Salvando...' : 'Criar Link'}
        </Button>
      </div>
    </div>
  );
};

export default BookingLinkCustomizer;
