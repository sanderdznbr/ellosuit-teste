import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import {
  ArrowLeft, Save, Eye, Smartphone, Monitor, Tablet,
  Palette, Type, Image, Upload, Clock, Timer, MessageSquare,
  Calendar as CalendarIcon, ChevronRight, Undo2, Redo2,
  Check, Loader2, ExternalLink, Copy, Sparkles,
  Layout, AlignCenter, Square, Circle
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

const FLOW_COLOR = '#4D7CFF';

interface BookingLinkData {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  buffer_minutes: number;
  link_slug: string;
  is_active: boolean;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  background_color: string | null;
  custom_message: string | null;
}

type EditorSection = 'general' | 'colors' | 'themes' | 'logo' | 'layout';
type PreviewDevice = 'desktop' | 'tablet' | 'mobile';
type EditableElement = 'title' | 'description' | 'custom_message' | 'duration' | 'success_title' | 'success_message' | 'logo' | null;

const STYLE_THEMES = [
  // Row 1 - Clássicos
  { label: 'Moderno', desc: 'Clean e profissional', font: 'Inter', radius: '16', button: 'filled' as const, primary: '#007DE3', secondary: '#60A5FA', bg: '#EFF6FF', emoji: '💎' },
  { label: 'Elegante', desc: 'Tipografia sofisticada', font: 'Playfair Display', radius: '8', button: 'outlined' as const, primary: '#374151', secondary: '#6B7280', bg: '#FFFFFF', emoji: '🖋️' },
  { label: 'Vibrante', desc: 'Cores vivas e divertidas', font: 'Poppins', radius: '24', button: 'gradient' as const, primary: '#EC4899', secondary: '#F472B6', bg: '#FDF2F8', emoji: '🎨' },
  { label: 'Dark Pro', desc: 'Tema escuro premium', font: 'Montserrat', radius: '12', button: 'filled' as const, primary: '#6366F1', secondary: '#818CF8', bg: '#111827', emoji: '🌙' },
  // Row 2 - Naturais
  { label: 'Natural', desc: 'Verde e orgânico', font: 'Nunito', radius: '16', button: 'filled' as const, primary: '#10B981', secondary: '#34D399', bg: '#F0FDF4', emoji: '🌿' },
  { label: 'Corporativo', desc: 'Formal e confiável', font: 'Roboto', radius: '8', button: 'filled' as const, primary: '#1E40AF', secondary: '#374DA4', bg: '#F8FAFC', emoji: '🏢' },
  { label: 'Sunset', desc: 'Quente e acolhedor', font: 'Lato', radius: '20', button: 'gradient' as const, primary: '#FF4500', secondary: '#FB923C', bg: '#FFF7ED', emoji: '🌅' },
  { label: 'Minimal', desc: 'Puro e sem distrações', font: 'Inter', radius: '0', button: 'outlined' as const, primary: '#000000', secondary: '#6B7280', bg: '#FFFFFF', emoji: '⬜' },
  // Row 3 - Criativos
  { label: 'Neon Cyber', desc: 'Futurista e ousado', font: 'Montserrat', radius: '4', button: 'gradient' as const, primary: '#00FF88', secondary: '#00D4FF', bg: '#0A0A0A', emoji: '⚡' },
  { label: 'Lavanda', desc: 'Suave e relaxante', font: 'Nunito', radius: '24', button: 'filled' as const, primary: '#8B5CF6', secondary: '#C4B5FD', bg: '#FAF5FF', emoji: '💜' },
  { label: 'Terracota', desc: 'Rústico e aconchegante', font: 'Playfair Display', radius: '12', button: 'filled' as const, primary: '#C2410C', secondary: '#EA580C', bg: '#FEF3C7', emoji: '🏺' },
  { label: 'Oceano', desc: 'Calmo e profundo', font: 'Lato', radius: '16', button: 'gradient' as const, primary: '#0284C7', secondary: '#06B6D4', bg: '#ECFEFF', emoji: '🌊' },
  // Row 4 - Temáticos
  { label: 'Cherry Blossom', desc: 'Delicado e feminino', font: 'Nunito', radius: '24', button: 'filled' as const, primary: '#DB2777', secondary: '#F9A8D4', bg: '#FFF1F2', emoji: '🌸' },
  { label: 'Midnight Gold', desc: 'Luxuoso e exclusivo', font: 'Playfair Display', radius: '4', button: 'outlined' as const, primary: '#D97706', secondary: '#FCD34D', bg: '#18181B', emoji: '✨' },
  { label: 'Arctic', desc: 'Frio e minimalista', font: 'Inter', radius: '12', button: 'outlined' as const, primary: '#64748B', secondary: '#94A3B8', bg: '#F1F5F9', emoji: '❄️' },
  { label: 'Tropical', desc: 'Exótico e energético', font: 'Poppins', radius: '20', button: 'gradient' as const, primary: '#059669', secondary: '#FBBF24', bg: '#FFFBEB', emoji: '🌴' },
  // Row 5 - Ousados
  { label: 'Brutalist', desc: 'Bold e impactante', font: 'Montserrat', radius: '0', button: 'filled' as const, primary: '#DC2626', secondary: '#000000', bg: '#FAFAFA', emoji: '🔴' },
  { label: 'Glassmorphism', desc: 'Transparente e moderno', font: 'Inter', radius: '20', button: 'gradient' as const, primary: '#7C3AED', secondary: '#2DD4BF', bg: '#F5F3FF', emoji: '🔮' },
  { label: 'Retro Wave', desc: 'Nostalgia dos anos 80', font: 'Montserrat', radius: '8', button: 'gradient' as const, primary: '#E11D48', secondary: '#7C3AED', bg: '#1E1B4B', emoji: '🕹️' },
  { label: 'Sage', desc: 'Tons terrosos e zen', font: 'Lato', radius: '16', button: 'filled' as const, primary: '#4D7C0F', secondary: '#84CC16', bg: '#F7FEE7', emoji: '🍃' },
];

const COLOR_PRESETS = [
  { label: 'Azul', colors: { primary: '#007DE3', secondary: '#60A5FA', bg: '#EFF6FF' } },
  { label: 'Laranja', colors: { primary: '#FF4500', secondary: '#FB923C', bg: '#FFF7ED' } },
  { label: 'Verde', colors: { primary: '#10B981', secondary: '#34D399', bg: '#F0FDF4' } },
  { label: 'Roxo', colors: { primary: '#8B5CF6', secondary: '#A78BFA', bg: '#FAF5FF' } },
  { label: 'Rosa', colors: { primary: '#EC4899', secondary: '#F472B6', bg: '#FDF2F8' } },
  { label: 'Dark', colors: { primary: '#6366F1', secondary: '#818CF8', bg: '#111827' } },
  { label: 'Minimal', colors: { primary: '#374151', secondary: '#6B7280', bg: '#FFFFFF' } },
  { label: 'Teal', colors: { primary: '#14B8A6', secondary: '#2DD4BF', bg: '#F0FDFA' } },
];

const SINGLE_COLORS = [
  '#007DE3', '#FF4500', '#10B981', '#8B5CF6', '#F59E0B',
  '#EC4899', '#06B6D4', '#EF4444', '#14B8A6', '#6366F1',
  '#000000', '#374151', '#6B7280', '#9CA3AF', '#D1D5DB',
  '#FFFFFF', '#F9FAFB', '#F3F4F6', '#FEF3F2', '#F0FDF4',
];

const FONT_OPTIONS = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Open Sans', label: 'Open Sans' },
  { value: 'Montserrat', label: 'Montserrat' },
  { value: 'Lato', label: 'Lato' },
  { value: 'Nunito', label: 'Nunito' },
  { value: 'Playfair Display', label: 'Playfair Display' },
];

const BORDER_RADIUS_OPTIONS = [
  { value: '0', label: 'Reto', icon: Square },
  { value: '8', label: 'Suave', icon: Square },
  { value: '16', label: 'Arredondado', icon: Square },
  { value: '24', label: 'Muito arredondado', icon: Circle },
];

const BookingThemeBuilder = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const linkId = searchParams.get('linkId');

  const [linkData, setLinkData] = useState<BookingLinkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<EditorSection>('general');
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>('desktop');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [previewStep, setPreviewStep] = useState<'date' | 'time' | 'form' | 'success'>('date');
  const [selectedElement, setSelectedElement] = useState<EditableElement>(null);

  // Theme state
  const [theme, setTheme] = useState({
    title: '',
    description: '',
    duration_minutes: 30,
    buffer_minutes: 15,
    custom_message: '',
    logo_url: '',
    primary_color: FLOW_COLOR,
    secondary_color: '#10B981',
    background_color: '#FFFFFF',
    font_family: 'Inter',
    border_radius: '16',
    button_style: 'filled' as 'filled' | 'outlined' | 'gradient',
    show_duration: true,
    show_description: true,
    success_title: 'Agendamento Confirmado!',
    success_message: 'Enviamos os detalhes para o seu email.',
    button_text: 'Confirmar Agendamento',
  });

  // History for undo/redo
  const [history, setHistory] = useState<typeof theme[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  useEffect(() => {
    if (linkId) loadLinkData();
  }, [linkId]);

  const loadLinkData = async () => {
    if (!linkId) return;
    const { data, error } = await supabase
      .from('public_booking_links')
      .select('*')
      .eq('id', linkId)
      .single();

    if (error || !data) {
      toast({ title: 'Erro', description: 'Link não encontrado', variant: 'destructive' });
      navigate('/dashboard/agenda-aberta');
      return;
    }

    setLinkData(data as BookingLinkData);
    const newTheme = {
      title: data.title || '',
      description: data.description || '',
      duration_minutes: data.duration_minutes || 30,
      buffer_minutes: data.buffer_minutes || 15,
      custom_message: data.custom_message || '',
      logo_url: data.logo_url || '',
      primary_color: data.primary_color || FLOW_COLOR,
      secondary_color: data.secondary_color || '#10B981',
      background_color: data.background_color || '#FFFFFF',
      font_family: (data as any).font_family || 'Inter',
      border_radius: (data as any).border_radius || '16',
      button_style: ((data as any).button_style || 'filled') as 'filled' | 'outlined' | 'gradient',
      show_duration: (data as any).show_duration ?? true,
      show_description: (data as any).show_description ?? true,
      success_title: (data as any).success_title || 'Agendamento Confirmado!',
      success_message: (data as any).success_message || 'Enviamos os detalhes para o seu email.',
      button_text: (data as any).button_text || 'Confirmar Agendamento',
    };
    setTheme(newTheme);
    setHistory([newTheme]);
    setHistoryIndex(0);
    setLoading(false);
  };

  const updateTheme = useCallback((updates: Partial<typeof theme>) => {
    setTheme(prev => {
      const next = { ...prev, ...updates };
      setHistory(h => [...h.slice(0, historyIndex + 1), next]);
      setHistoryIndex(i => i + 1);
      setHasUnsavedChanges(true);
      return next;
    });
  }, [historyIndex]);

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(i => i - 1);
      setTheme(history[historyIndex - 1]);
      setHasUnsavedChanges(true);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(i => i + 1);
      setTheme(history[historyIndex + 1]);
      setHasUnsavedChanges(true);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `booking-logos/${linkId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('logos')
        .getPublicUrl(filePath);

      updateTheme({ logo_url: urlData.publicUrl });
      toast({ title: 'Logo enviado!' });
    } catch (err: any) {
      toast({ title: 'Erro no upload', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingLogo(false);
    }
  };

  const saveChanges = async () => {
    if (!linkData) return;
    setSaving(true);

    const { error } = await supabase
      .from('public_booking_links')
      .update({
        title: theme.title,
        description: theme.description || null,
        duration_minutes: theme.duration_minutes,
        buffer_minutes: theme.buffer_minutes,
        custom_message: theme.custom_message || null,
        logo_url: theme.logo_url || null,
        primary_color: theme.primary_color,
        secondary_color: theme.secondary_color,
        background_color: theme.background_color,
        font_family: theme.font_family,
        border_radius: theme.border_radius,
        button_style: theme.button_style,
        success_title: theme.success_title || null,
        success_message: theme.success_message || null,
        button_text: theme.button_text || null,
        show_duration: theme.show_duration,
        show_description: theme.show_description,
      })
      .eq('id', linkData.id);

    if (error) {
      toast({ title: 'Erro', description: 'Falha ao salvar', variant: 'destructive' });
    } else {
      toast({ title: 'Salvo!', description: 'Alterações aplicadas com sucesso' });
      setHasUnsavedChanges(false);
    }
    setSaving(false);
  };

  const applyStyleTheme = (t: typeof STYLE_THEMES[0]) => {
    updateTheme({
      primary_color: t.primary,
      secondary_color: t.secondary,
      background_color: t.bg,
      font_family: t.font,
      border_radius: t.radius,
      button_style: t.button,
    });
  };

  const selectElement = (el: EditableElement) => {
    setSelectedElement(el);
    if (el === 'title' || el === 'description' || el === 'custom_message' || el === 'duration') {
      setActiveSection('general');
    } else if (el === 'logo') {
      setActiveSection('logo');
    } else if (el === 'success_title' || el === 'success_message') {
      setActiveSection('general');
    }
  };

  const applyPreset = (preset: typeof COLOR_PRESETS[0]) => {
    updateTheme({
      primary_color: preset.colors.primary,
      secondary_color: preset.colors.secondary,
      background_color: preset.colors.bg,
    });
  };

  const copyLink = () => {
    if (!linkData) return;
    navigator.clipboard.writeText(`https://www.ellosuit.online/agendamentos/${linkData.link_slug}`);
    toast({ title: 'Link copiado!' });
  };

  const isDarkBg = ['#111827', '#000000', '#0A0A0A', '#18181B', '#1E1B4B'].includes(theme.background_color);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const sidebarSections: { id: EditorSection; label: string; icon: React.ElementType }[] = [
    { id: 'general', label: 'Geral', icon: Type },
    { id: 'themes', label: 'Temas', icon: Sparkles },
    { id: 'colors', label: 'Cores', icon: Palette },
    { id: 'logo', label: 'Logo', icon: Image },
    { id: 'layout', label: 'Layout', icon: Layout },
  ];

  const previewWidth = previewDevice === 'mobile' ? 375 : previewDevice === 'tablet' ? 768 : '100%';

  // Generate mock days for preview
  const mockDays = Array.from({ length: 5 }, (_, i) => addDays(new Date(), i + 1));

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Top Bar */}
      <div className="h-14 bg-white border-b flex items-center justify-between px-4 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (hasUnsavedChanges && !confirm('Descartar alterações não salvas?')) return;
              navigate('/dashboard/agenda-aberta');
            }}
            className="rounded-xl"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="h-6 w-px bg-gray-200" />
          <div>
            <h1 className="text-sm font-semibold text-gray-900 leading-tight">Editor Visual</h1>
            <p className="text-[11px] text-gray-500">{theme.title || 'Link de agendamento'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Undo/Redo */}
          <div className="flex items-center gap-1 mr-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={undo} disabled={historyIndex <= 0}>
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={redo} disabled={historyIndex >= history.length - 1}>
              <Redo2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Device Switcher */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
            {[
              { id: 'desktop' as const, icon: Monitor },
              { id: 'tablet' as const, icon: Tablet },
              { id: 'mobile' as const, icon: Smartphone },
            ].map(device => (
              <button
                key={device.id}
                onClick={() => setPreviewDevice(device.id)}
                className={cn(
                  'p-1.5 rounded-md transition-all',
                  previewDevice === device.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'
                )}
              >
                <device.icon className="h-4 w-4" />
              </button>
            ))}
          </div>

          <div className="h-6 w-px bg-gray-200 mx-1" />

          <Button variant="outline" size="sm" className="rounded-lg gap-2" onClick={copyLink}>
            <Copy className="h-3.5 w-3.5" />
            Copiar Link
          </Button>

          {linkData && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg gap-2"
              onClick={() => window.open(`/agendamentos/${linkData.link_slug}`, '_blank')}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Visualizar
            </Button>
          )}

          <Button
            size="sm"
            onClick={saveChanges}
            disabled={saving || !hasUnsavedChanges}
            className="rounded-lg gap-2 text-white"
            style={{ backgroundColor: FLOW_COLOR }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Section Nav */}
        <div className="w-14 bg-white border-r flex flex-col items-center py-3 gap-1 shrink-0">
          {sidebarSections.map(section => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center transition-all group relative',
                activeSection === section.id
                  ? 'text-white'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              )}
              style={activeSection === section.id ? { backgroundColor: FLOW_COLOR } : {}}
              title={section.label}
            >
              <section.icon className="h-4.5 w-4.5" />
              {/* Tooltip */}
              <span className="absolute left-12 bg-gray-900 text-white text-[11px] px-2 py-1 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-20">
                {section.label}
              </span>
            </button>
          ))}
        </div>

        {/* Editor Panel */}
        <div className="w-80 bg-white border-r shrink-0 flex flex-col">
          <div className="p-4 border-b">
            <h2 className="text-sm font-semibold text-gray-900">
              {sidebarSections.find(s => s.id === activeSection)?.label}
            </h2>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-5">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeSection}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.15 }}
                >
                  {/* General Section */}
                  {activeSection === 'general' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-gray-600">Título do evento</Label>
                        <Input
                          value={theme.title}
                          onChange={e => updateTheme({ title: e.target.value })}
                          className="rounded-lg"
                          placeholder="Ex: Consultoria"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-medium text-gray-600">Descrição</Label>
                          <Switch
                            checked={theme.show_description}
                            onCheckedChange={v => updateTheme({ show_description: v })}
                          />
                        </div>
                        {theme.show_description && (
                          <Textarea
                            value={theme.description}
                            onChange={e => updateTheme({ description: e.target.value })}
                            className="rounded-lg resize-none"
                            rows={3}
                            placeholder="Descreva o compromisso..."
                          />
                        )}
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-gray-600 flex items-center gap-2">
                          <Timer className="h-3.5 w-3.5" />Duração
                        </Label>
                        <Select value={theme.duration_minutes.toString()} onValueChange={v => updateTheme({ duration_minutes: parseInt(v) })}>
                          <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-lg">
                            {[15, 30, 45, 60, 90, 120].map(m => (
                              <SelectItem key={m} value={m.toString()}>
                                {m < 60 ? `${m} minutos` : `${m / 60}h${m % 60 ? ` ${m % 60}min` : ''}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-gray-600 flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5" />Intervalo entre reuniões
                        </Label>
                        <Select value={theme.buffer_minutes.toString()} onValueChange={v => updateTheme({ buffer_minutes: parseInt(v) })}>
                          <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-lg">
                            {[0, 5, 10, 15, 30].map(m => (
                              <SelectItem key={m} value={m.toString()}>
                                {m === 0 ? 'Sem intervalo' : `${m} minutos`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-gray-600 flex items-center gap-2">
                          <MessageSquare className="h-3.5 w-3.5" />Mensagem personalizada
                        </Label>
                        <Textarea
                          value={theme.custom_message}
                          onChange={e => updateTheme({ custom_message: e.target.value })}
                          className="rounded-lg resize-none"
                          rows={2}
                          placeholder="Ex: Bem-vindo! Escolha o melhor horário..."
                        />
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-gray-600">Texto do botão</Label>
                        <Input
                          value={theme.button_text}
                          onChange={e => updateTheme({ button_text: e.target.value })}
                          className="rounded-lg"
                          placeholder="Confirmar Agendamento"
                        />
                      </div>

                      <Separator />

                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Página de Sucesso</p>

                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-gray-600">Título de confirmação</Label>
                        <Input
                          value={theme.success_title}
                          onChange={e => updateTheme({ success_title: e.target.value })}
                          className="rounded-lg"
                          placeholder="Agendamento Confirmado!"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-gray-600">Mensagem de confirmação</Label>
                        <Textarea
                          value={theme.success_message}
                          onChange={e => updateTheme({ success_message: e.target.value })}
                          className="rounded-lg resize-none"
                          rows={2}
                          placeholder="Enviamos os detalhes para o seu email."
                        />
                      </div>
                    </div>
                  )}

                  {/* Themes Section */}
                  {activeSection === 'themes' && (
                    <div className="space-y-4">
                      <p className="text-xs text-gray-500">Escolha um tema completo que altera cores, fonte, arredondamento e estilo dos botões.</p>
                      <div className="grid grid-cols-2 gap-3">
                        {STYLE_THEMES.map(t => {
                          const isActive = theme.primary_color === t.primary && theme.font_family === t.font && theme.border_radius === t.radius;
                          const tDark = t.bg === '#111827' || t.bg === '#0A0A0A' || t.bg === '#18181B' || t.bg === '#1E1B4B';
                          return (
                            <button
                              key={t.label}
                              onClick={() => applyStyleTheme(t)}
                              className={cn(
                                'relative rounded-xl border-2 overflow-hidden transition-all text-left',
                                isActive ? 'border-gray-900 shadow-lg scale-[1.02]' : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                              )}
                            >
                              <div className="p-3" style={{ backgroundColor: t.bg }}>
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-sm">{t.emoji}</span>
                                  <div className="h-2 flex-1 rounded-full" style={{ backgroundColor: tDark ? '#374151' : '#E5E7EB' }} />
                                </div>
                                <div className="space-y-1 mb-2">
                                  <div className="h-1.5 w-3/4 rounded-full" style={{ backgroundColor: tDark ? '#4B5563' : '#D1D5DB' }} />
                                  <div className="h-1.5 w-1/2 rounded-full" style={{ backgroundColor: tDark ? '#374151' : '#E5E7EB' }} />
                                </div>
                                <div
                                  className="h-5 w-full flex items-center justify-center text-[8px] font-semibold"
                                  style={{
                                    borderRadius: `${Math.min(parseInt(t.radius), 8)}px`,
                                    ...(t.button === 'filled' ? { backgroundColor: t.primary, color: '#FFF' } :
                                      t.button === 'outlined' ? { border: `1.5px solid ${t.primary}`, color: t.primary } :
                                      { background: `linear-gradient(135deg, ${t.primary}, ${t.secondary})`, color: '#FFF' }),
                                  }}
                                >
                                  Botão
                                </div>
                              </div>
                              <div className="px-3 py-2 bg-white border-t">
                                <p className="text-[11px] font-semibold text-gray-800" style={{ fontFamily: t.font }}>{t.label}</p>
                                <p className="text-[9px] text-gray-400">{t.desc}</p>
                              </div>
                              {isActive && (
                                <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: t.primary }}>
                                  <Check className="h-3 w-3 text-white" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Colors Section */}
                  {activeSection === 'colors' && (
                    <div className="space-y-5">
                      {/* Quick Presets */}
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-gray-600 flex items-center gap-2">
                          <Sparkles className="h-3.5 w-3.5" />Temas rápidos
                        </Label>
                        <div className="grid grid-cols-4 gap-2">
                          {COLOR_PRESETS.map(preset => (
                            <button
                              key={preset.label}
                              onClick={() => applyPreset(preset)}
                              className="group relative"
                            >
                              <div
                                className={cn(
                                  'h-12 rounded-lg border-2 transition-all overflow-hidden flex flex-col',
                                  theme.primary_color === preset.colors.primary && theme.background_color === preset.colors.bg
                                    ? 'border-gray-900 scale-105'
                                    : 'border-gray-200 hover:border-gray-300 hover:scale-102'
                                )}
                              >
                                <div className="flex-1" style={{ backgroundColor: preset.colors.bg }} />
                                <div className="h-3 flex">
                                  <div className="flex-1" style={{ backgroundColor: preset.colors.primary }} />
                                  <div className="flex-1" style={{ backgroundColor: preset.colors.secondary }} />
                                </div>
                              </div>
                              <span className="text-[10px] text-gray-500 mt-1 block">{preset.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <Separator />

                      {/* Individual Colors */}
                      {[
                        { key: 'primary_color' as const, label: 'Cor principal', desc: 'Botões e elementos de destaque' },
                        { key: 'secondary_color' as const, label: 'Cor secundária', desc: 'Acentos e detalhes' },
                        { key: 'background_color' as const, label: 'Cor de fundo', desc: 'Fundo da página' },
                      ].map(colorConfig => (
                        <div key={colorConfig.key} className="space-y-2">
                          <Label className="text-xs font-medium text-gray-600">{colorConfig.label}</Label>
                          <p className="text-[10px] text-gray-400">{colorConfig.desc}</p>
                          <div className="flex items-center gap-2">
                            <div className="flex flex-wrap gap-1.5">
                              {SINGLE_COLORS.slice(0, 10).map(color => (
                                <button
                                  key={`${colorConfig.key}-${color}`}
                                  onClick={() => updateTheme({ [colorConfig.key]: color })}
                                  className={cn(
                                    'w-6 h-6 rounded-md border transition-all',
                                    theme[colorConfig.key] === color
                                      ? 'border-gray-900 scale-110 ring-2 ring-gray-300'
                                      : 'border-gray-200 hover:scale-105'
                                  )}
                                  style={{ backgroundColor: color }}
                                />
                              ))}
                            </div>
                            <input
                              type="color"
                              value={theme[colorConfig.key]}
                              onChange={e => updateTheme({ [colorConfig.key]: e.target.value })}
                              className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0"
                            />
                          </div>
                          <Input
                            value={theme[colorConfig.key]}
                            onChange={e => updateTheme({ [colorConfig.key]: e.target.value })}
                            className="rounded-lg text-xs font-mono h-8"
                            placeholder="#000000"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Logo Section */}
                  {activeSection === 'logo' && (
                    <div className="space-y-5">
                      <div className="space-y-3">
                        <Label className="text-xs font-medium text-gray-600">Logo da empresa</Label>
                        <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center space-y-3">
                          {theme.logo_url ? (
                            <div className="space-y-3">
                              <img
                                src={theme.logo_url}
                                alt="Logo"
                                className="h-16 w-16 mx-auto object-contain rounded-xl border border-gray-100"
                              />
                              <div className="flex gap-2 justify-center">
                                <label className="cursor-pointer">
                                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium text-gray-700 transition-colors">
                                    <Upload className="h-3 w-3" />Trocar
                                  </span>
                                </label>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-500 hover:text-red-600 text-xs h-auto py-1.5"
                                  onClick={() => updateTheme({ logo_url: '' })}
                                >
                                  Remover
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <label className="cursor-pointer block">
                              <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
                              <div className="space-y-2">
                                <div className="w-12 h-12 mx-auto bg-gray-100 rounded-xl flex items-center justify-center">
                                  {uploadingLogo ? (
                                    <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
                                  ) : (
                                    <Upload className="h-5 w-5 text-gray-400" />
                                  )}
                                </div>
                                <p className="text-sm font-medium text-gray-600">
                                  {uploadingLogo ? 'Enviando...' : 'Clique para enviar'}
                                </p>
                                <p className="text-[10px] text-gray-400">PNG, JPG ou SVG • Max 2MB</p>
                              </div>
                            </label>
                          )}
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-gray-600">URL da logo (alternativo)</Label>
                        <Input
                          value={theme.logo_url}
                          onChange={e => updateTheme({ logo_url: e.target.value })}
                          className="rounded-lg text-xs"
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                  )}

                  {/* Layout Section */}
                  {activeSection === 'layout' && (
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-gray-600">Estilo dos botões</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: 'filled' as const, label: 'Sólido' },
                            { id: 'outlined' as const, label: 'Contorno' },
                            { id: 'gradient' as const, label: 'Gradiente' },
                          ].map(style => (
                            <button
                              key={style.id}
                              onClick={() => updateTheme({ button_style: style.id })}
                              className={cn(
                                'p-3 rounded-lg border-2 text-xs font-medium transition-all',
                                theme.button_style === style.id
                                  ? 'border-gray-900 bg-gray-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              )}
                            >
                              <div
                                className="h-6 rounded-md mb-2 mx-auto"
                                style={
                                  style.id === 'filled' ? { backgroundColor: theme.primary_color } :
                                  style.id === 'outlined' ? { border: `2px solid ${theme.primary_color}`, backgroundColor: 'transparent' } :
                                  { background: `linear-gradient(135deg, ${theme.primary_color}, ${theme.secondary_color})` }
                                }
                              />
                              {style.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-gray-600">Arredondamento</Label>
                        <div className="grid grid-cols-4 gap-2">
                          {BORDER_RADIUS_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => updateTheme({ border_radius: opt.value })}
                              className={cn(
                                'p-2 border-2 text-center text-[10px] font-medium transition-all',
                                theme.border_radius === opt.value
                                  ? 'border-gray-900 bg-gray-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              )}
                              style={{ borderRadius: `${parseInt(opt.value)}px` }}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <Label className="text-xs font-medium text-gray-600">Exibir na página</Label>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between py-1">
                            <span className="text-xs text-gray-600">Mostrar duração</span>
                            <Switch checked={theme.show_duration} onCheckedChange={v => updateTheme({ show_duration: v })} />
                          </div>
                          <div className="flex items-center justify-between py-1">
                            <span className="text-xs text-gray-600">Mostrar descrição</span>
                            <Switch checked={theme.show_description} onCheckedChange={v => updateTheme({ show_description: v })} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </ScrollArea>
        </div>

        {/* Preview Area */}
        <div className="flex-1 flex flex-col overflow-auto">
          {/* Preview Step Navigation */}
          <div className="bg-white border-b px-4 py-2 flex items-center gap-2 shrink-0">
            <span className="text-xs font-medium text-gray-500 mr-2">Etapa:</span>
            {[
              { id: 'date' as const, label: '1. Data' },
              { id: 'time' as const, label: '2. Horário' },
              { id: 'form' as const, label: '3. Formulário' },
              { id: 'success' as const, label: '✓ Sucesso' },
            ].map(s => (
              <button
                key={s.id}
                onClick={() => setPreviewStep(s.id)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  previewStep === s.id
                    ? 'text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                )}
                style={previewStep === s.id ? { backgroundColor: theme.primary_color } : {}}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="flex-1 flex items-center justify-center p-6 overflow-auto">
            <div
              className="transition-all duration-300 h-full"
              style={{
                width: typeof previewWidth === 'number' ? previewWidth : undefined,
                maxWidth: typeof previewWidth === 'string' ? '100%' : previewWidth,
                flex: typeof previewWidth === 'string' ? 1 : undefined,
              }}
            >
              <div
                className="h-full rounded-2xl shadow-2xl border border-gray-200 overflow-auto flex flex-col"
                style={{ backgroundColor: theme.background_color }}
              >
                <div className="flex-1 flex flex-col items-center p-8 gap-5" onClick={() => setSelectedElement(null)}>
                  {/* Logo - clickable */}
                  <div
                    onClick={(e) => { e.stopPropagation(); selectElement('logo'); }}
                    className={cn('cursor-pointer transition-all rounded-2xl', selectedElement === 'logo' && 'ring-2 ring-[#374DA4] ring-offset-2')}
                  >
                    {theme.logo_url ? (
                      <motion.img
                        key={theme.logo_url}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        src={theme.logo_url}
                        alt="Logo"
                        className="h-14 w-14 object-contain"
                        style={{ borderRadius: `${parseInt(theme.border_radius)}px` }}
                      />
                    ) : (
                      <div
                        className="w-14 h-14 flex items-center justify-center"
                        style={{
                          backgroundColor: `${theme.primary_color}15`,
                          borderRadius: `${parseInt(theme.border_radius)}px`,
                        }}
                      >
                        <CalendarIcon className="h-7 w-7" style={{ color: theme.primary_color }} />
                      </div>
                    )}
                  </div>

                  {/* Title - clickable */}
                  <h2
                    onClick={(e) => { e.stopPropagation(); selectElement('title'); }}
                    className={cn(
                      'text-2xl font-bold text-center cursor-pointer transition-all px-2 py-1 rounded-lg',
                      selectedElement === 'title' && 'ring-2 ring-[#374DA4] ring-offset-2'
                    )}
                    style={{ color: isDarkBg ? '#FFFFFF' : '#111827', fontFamily: theme.font_family }}
                  >
                    {theme.title || 'Título do evento'}
                  </h2>

                  {/* Description - clickable */}
                  {theme.show_description && (
                    <p
                      onClick={(e) => { e.stopPropagation(); selectElement('description'); }}
                      className={cn(
                        'text-sm text-center max-w-md cursor-pointer transition-all px-2 py-1 rounded-lg',
                        selectedElement === 'description' && 'ring-2 ring-[#374DA4] ring-offset-2'
                      )}
                      style={{ color: isDarkBg ? '#9CA3AF' : '#6B7280' }}
                    >
                      {theme.description || 'Clique para adicionar descrição'}
                    </p>
                  )}

                  {/* Custom Message - clickable */}
                  <p
                    onClick={(e) => { e.stopPropagation(); selectElement('custom_message'); }}
                    className={cn(
                      'text-xs text-center max-w-sm italic cursor-pointer transition-all px-2 py-1 rounded-lg',
                      selectedElement === 'custom_message' && 'ring-2 ring-[#374DA4] ring-offset-2'
                    )}
                    style={{ color: theme.custom_message ? theme.secondary_color : (isDarkBg ? '#4B5563' : '#D1D5DB') }}
                  >
                    {theme.custom_message || 'Clique para adicionar mensagem'}
                  </p>

                  {/* Duration - clickable */}
                  {theme.show_duration && (
                    <div
                      onClick={(e) => { e.stopPropagation(); selectElement('duration'); }}
                      className={cn(
                        'flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-all',
                        selectedElement === 'duration' && 'ring-2 ring-[#374DA4] ring-offset-2'
                      )}
                      style={{ backgroundColor: `${theme.primary_color}10`, borderRadius: `${parseInt(theme.border_radius)}px` }}
                    >
                      <Timer className="h-4 w-4" style={{ color: theme.primary_color }} />
                      <span className="text-sm font-medium" style={{ color: theme.primary_color }}>{theme.duration_minutes} min</span>
                    </div>
                  )}

                  {/* Progress indicators */}
                  {previewStep !== 'success' && (
                    <div className="flex items-center gap-2">
                      {(['date', 'time', 'form'] as const).map((s, i) => {
                        const stepIndex = ['date', 'time', 'form'].indexOf(previewStep);
                        const isActive = previewStep === s;
                        const isCompleted = stepIndex > i;
                        return (
                          <React.Fragment key={s}>
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
                              style={{
                                backgroundColor: isActive ? theme.primary_color : isCompleted ? `${theme.primary_color}30` : isDarkBg ? '#374151' : '#e5e7eb',
                                color: isActive ? 'white' : isCompleted ? theme.primary_color : isDarkBg ? '#6B7280' : '#9ca3af',
                              }}
                            >
                              {isCompleted ? <Check className="h-4 w-4" /> : i + 1}
                            </div>
                            {i < 2 && (
                              <div className="w-6 h-0.5 rounded-full" style={{ backgroundColor: stepIndex > i ? theme.primary_color : isDarkBg ? '#374151' : '#e5e7eb' }} />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}

                  {/* Step Content */}
                  <div className="w-full max-w-sm mt-2">
                    <AnimatePresence mode="wait">
                      {/* Date Step */}
                      {previewStep === 'date' && (
                        <motion.div key="date" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                          <div
                            className="p-4 border"
                            style={{ borderColor: isDarkBg ? '#374151' : '#E5E7EB', borderRadius: `${parseInt(theme.border_radius)}px`, backgroundColor: isDarkBg ? '#1F2937' : '#FFFFFF' }}
                          >
                            <p className="text-xs font-medium mb-3" style={{ color: isDarkBg ? '#D1D5DB' : '#374151' }}>
                              Selecione a data
                            </p>
                            {/* Mock calendar grid */}
                            <div className="grid grid-cols-7 gap-1 mb-3">
                              {['D','S','T','Q','Q','S','S'].map((d, i) => (
                                <div key={i} className="text-center text-[10px] font-medium py-1" style={{ color: isDarkBg ? '#9CA3AF' : '#6B7280' }}>{d}</div>
                              ))}
                              {Array.from({ length: 35 }, (_, i) => {
                                const day = i - 2;
                                const isValid = day >= 1 && day <= 31;
                                const isSelected = day === 15;
                                const isAvailable = isValid && [1,3,5,8,10,12,15,17,19,22,24,26,29].includes(day);
                                return (
                                  <div
                                    key={i}
                                    className="aspect-square flex items-center justify-center text-[10px] font-medium"
                                    style={{
                                      borderRadius: `${Math.min(parseInt(theme.border_radius), 8)}px`,
                                      backgroundColor: isSelected ? theme.primary_color : 'transparent',
                                      color: isSelected ? 'white' : isAvailable ? (isDarkBg ? '#E5E7EB' : '#374151') : (isDarkBg ? '#4B5563' : '#D1D5DB'),
                                      cursor: isAvailable ? 'pointer' : 'default',
                                    }}
                                  >
                                    {isValid ? day : ''}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          <button
                            className="w-full mt-4 px-6 py-3 text-sm font-semibold"
                            style={{
                              borderRadius: `${parseInt(theme.border_radius)}px`,
                              ...(theme.button_style === 'filled' ? { backgroundColor: theme.primary_color, color: '#FFFFFF' } :
                                theme.button_style === 'outlined' ? { border: `2px solid ${theme.primary_color}`, color: theme.primary_color, backgroundColor: 'transparent' } :
                                { background: `linear-gradient(135deg, ${theme.primary_color}, ${theme.secondary_color})`, color: '#FFFFFF' }),
                            }}
                          >
                            Continuar
                          </button>
                        </motion.div>
                      )}

                      {/* Time Step */}
                      {previewStep === 'time' && (
                        <motion.div key="time" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                          <div
                            className="p-4 border"
                            style={{ borderColor: isDarkBg ? '#374151' : '#E5E7EB', borderRadius: `${parseInt(theme.border_radius)}px`, backgroundColor: isDarkBg ? '#1F2937' : '#FFFFFF' }}
                          >
                            <p className="text-xs font-medium mb-3" style={{ color: isDarkBg ? '#D1D5DB' : '#374151' }}>
                              Horários disponíveis
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                              {['09:00','09:30','10:00','10:30','11:00','14:00','14:30','15:00','15:30'].map((time, i) => (
                                <div
                                  key={time}
                                  className="text-center py-2 text-xs font-medium cursor-pointer transition-all"
                                  style={{
                                    borderRadius: `${Math.min(parseInt(theme.border_radius), 10)}px`,
                                    backgroundColor: i === 2 ? theme.primary_color : `${theme.primary_color}10`,
                                    color: i === 2 ? 'white' : theme.primary_color,
                                    border: i === 2 ? 'none' : `1px solid ${theme.primary_color}20`,
                                  }}
                                >
                                  {time}
                                </div>
                              ))}
                            </div>
                          </div>
                          <button
                            className="w-full mt-4 px-6 py-3 text-sm font-semibold"
                            style={{
                              borderRadius: `${parseInt(theme.border_radius)}px`,
                              ...(theme.button_style === 'filled' ? { backgroundColor: theme.primary_color, color: '#FFFFFF' } :
                                theme.button_style === 'outlined' ? { border: `2px solid ${theme.primary_color}`, color: theme.primary_color, backgroundColor: 'transparent' } :
                                { background: `linear-gradient(135deg, ${theme.primary_color}, ${theme.secondary_color})`, color: '#FFFFFF' }),
                            }}
                          >
                            Continuar
                          </button>
                        </motion.div>
                      )}

                      {/* Form Step */}
                      {previewStep === 'form' && (
                        <motion.div key="form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                          <div
                            className="p-4 border space-y-3"
                            style={{ borderColor: isDarkBg ? '#374151' : '#E5E7EB', borderRadius: `${parseInt(theme.border_radius)}px`, backgroundColor: isDarkBg ? '#1F2937' : '#FFFFFF' }}
                          >
                            <p className="text-xs font-medium mb-1" style={{ color: isDarkBg ? '#D1D5DB' : '#374151' }}>Seus dados</p>
                            {['Nome completo *', 'Email *', 'Telefone', 'Observações'].map((field, i) => (
                              <div key={field}>
                                <label className="text-[10px] font-medium mb-1 block" style={{ color: isDarkBg ? '#9CA3AF' : '#6B7280' }}>{field}</label>
                                <div
                                  className="h-8 border px-2 flex items-center text-[10px]"
                                  style={{
                                    borderColor: isDarkBg ? '#374151' : '#E5E7EB',
                                    borderRadius: `${Math.min(parseInt(theme.border_radius), 8)}px`,
                                    backgroundColor: isDarkBg ? '#111827' : '#F9FAFB',
                                    color: isDarkBg ? '#6B7280' : '#9CA3AF',
                                    height: i === 3 ? 48 : 32,
                                  }}
                                >
                                  {i === 0 ? 'João Silva' : i === 1 ? 'joao@email.com' : i === 2 ? '(11) 99999-0000' : ''}
                                </div>
                              </div>
                            ))}
                          </div>
                          <button
                            className="w-full mt-4 px-6 py-3 text-sm font-semibold"
                            style={{
                              borderRadius: `${parseInt(theme.border_radius)}px`,
                              ...(theme.button_style === 'filled' ? { backgroundColor: theme.primary_color, color: '#FFFFFF' } :
                                theme.button_style === 'outlined' ? { border: `2px solid ${theme.primary_color}`, color: theme.primary_color, backgroundColor: 'transparent' } :
                                { background: `linear-gradient(135deg, ${theme.primary_color}, ${theme.secondary_color})`, color: '#FFFFFF' }),
                            }}
                          >
                            {theme.button_text || 'Confirmar Agendamento'}
                          </button>
                        </motion.div>
                      )}

                      {/* Success Step */}
                      {previewStep === 'success' && (
                        <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-4">
                          <div
                            className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
                            style={{ backgroundColor: `${theme.primary_color}15` }}
                          >
                            <Check className="h-8 w-8" style={{ color: theme.primary_color }} />
                          </div>
                          <h3
                            onClick={(e) => { e.stopPropagation(); selectElement('success_title'); }}
                            className={cn(
                              'text-lg font-bold mb-2 cursor-pointer transition-all px-2 py-1 rounded-lg inline-block',
                              selectedElement === 'success_title' && 'ring-2 ring-[#374DA4] ring-offset-2'
                            )}
                            style={{ color: isDarkBg ? '#FFFFFF' : '#111827' }}
                          >
                            {theme.success_title || 'Agendamento Confirmado!'}
                          </h3>
                          <p
                            onClick={(e) => { e.stopPropagation(); selectElement('success_message'); }}
                            className={cn(
                              'text-xs mb-4 cursor-pointer transition-all px-2 py-1 rounded-lg',
                              selectedElement === 'success_message' && 'ring-2 ring-[#374DA4] ring-offset-2'
                            )}
                            style={{ color: isDarkBg ? '#9CA3AF' : '#6B7280' }}
                          >
                            {theme.success_message || 'Clique para editar mensagem'}
                          </p>
                          <div
                            className="p-4 text-left space-y-2 text-xs"
                            style={{
                              backgroundColor: `${theme.primary_color}08`,
                              borderRadius: `${parseInt(theme.border_radius)}px`,
                              color: isDarkBg ? '#E5E7EB' : '#374151',
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <CalendarIcon className="h-4 w-4" style={{ color: theme.primary_color }} />
                              <span>Quarta, 15 de Janeiro de 2025</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" style={{ color: theme.primary_color }} />
                              <span>10:00 • {theme.duration_minutes} minutos</span>
                            </div>
                          </div>
                          {theme.custom_message && (
                            <p
                              onClick={(e) => { e.stopPropagation(); selectElement('custom_message'); }}
                              className={cn(
                                'mt-4 text-xs italic cursor-pointer transition-all px-2 py-1 rounded-lg inline-block',
                                selectedElement === 'custom_message' && 'ring-2 ring-[#374DA4] ring-offset-2'
                              )}
                              style={{ color: isDarkBg ? '#9CA3AF' : '#6B7280' }}
                            >
                              "{theme.custom_message}"
                            </p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Footer */}
                  <p className="text-[10px] mt-auto pt-4" style={{ color: isDarkBg ? '#4B5563' : '#9CA3AF' }}>
                    Powered by <span className="font-semibold" style={{ color: theme.primary_color }}>ellosuit</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingThemeBuilder;
