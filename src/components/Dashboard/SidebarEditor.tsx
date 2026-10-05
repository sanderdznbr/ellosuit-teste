
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Upload, Palette, Settings, Image, RotateCcw, Save } from 'lucide-react';
import { useSidebarSettings } from '@/hooks/useSidebarSettings';
import { useFileUpload } from '@/hooks/useFileUpload';
import ColorWheel from './ColorWheel';

const defaultMenuItems = [
  { id: 'home', label: 'Dashboard', icon: '🏠' },
  { id: 'calendar', label: 'Agendamentos', icon: '📅' },
  { id: 'clients', label: 'Contatos', icon: '👥' },
  { id: 'documents', label: 'Arquivos', icon: '📁' },
  { id: 'tasks', label: 'Tarefas', icon: '✅' },
  { id: 'flows', label: 'Fluxos de produção', icon: '📊' },
  { id: 'crm-whatsapp', label: 'Whatsapp CRM', icon: '💬' },
  { id: 'email', label: 'Email Marketing', icon: '📧' },
  { id: 'agenda-aberta', label: 'Agendamento Online', icon: '🗓️' },
  { id: 'meetings', label: 'Reuniões Ello', icon: '📹' },
  { id: 'bot-ia', label: 'Agentes de IA', icon: '🤖' },
  { id: 'settings', label: 'Configurações', icon: '⚙️' }
];

interface SortableItemProps {
  id: string;
  label: string;
  icon: string;
}

function SortableItem({ id, label, icon }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-white border rounded-lg shadow-sm"
    >
      <div {...attributes} {...listeners} className="cursor-grab hover:cursor-grabbing">
        <GripVertical className="h-4 w-4 text-gray-400" />
      </div>
      <span className="text-lg">{icon}</span>
      <span className="font-medium">{label}</span>
    </div>
  );
}

const SidebarEditor = () => {
  const { settings, loading, updateSettings, refetch } = useSidebarSettings();
  const { uploadFile, uploading } = useFileUpload();
  const [menuItems, setMenuItems] = useState(defaultMenuItems);
  const [customLogoFile, setCustomLogoFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showBackgroundColorPicker, setShowBackgroundColorPicker] = useState(false);
  const [sidebarColor, setSidebarColor] = useState(settings.sidebar_color || '#374DA4');
  const [backgroundColor, setBackgroundColor] = useState(settings.sidebar_background_color || '#3600FF');
  const [sidebarColorHex, setSidebarColorHex] = useState(settings.sidebar_color || '#374DA4');
  const [backgroundColorHex, setBackgroundColorHex] = useState(settings.sidebar_background_color || '#3600FF');
  const [pendingChanges, setPendingChanges] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  React.useEffect(() => {
    if (settings.menu_order && settings.menu_order.length > 0) {
      const orderedItems = settings.menu_order
        .map(id => defaultMenuItems.find(item => item.id === id))
        .filter(Boolean) as typeof defaultMenuItems;
      
      const remainingItems = defaultMenuItems.filter(
        item => !settings.menu_order.includes(item.id)
      );
      
      setMenuItems([...orderedItems, ...remainingItems]);
    }
  }, [settings]);

  React.useEffect(() => {
    setSidebarColor(settings.sidebar_color || '#374DA4');
    setBackgroundColor(settings.sidebar_background_color || '#3600FF');
    setSidebarColorHex(settings.sidebar_color || '#374DA4');
    setBackgroundColorHex(settings.sidebar_background_color || '#3600FF');
  }, [settings]);

  function handleDragEnd(event: any) {
    const { active, over } = event;

    if (active.id !== over.id) {
      setMenuItems((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);

        const newItems = arrayMove(items, oldIndex, newIndex);
        
        updateSettings({
          menu_order: newItems.map(item => item.id)
        });

        return newItems;
      });
    }
  }

  const handleSidebarColorChange = (color: string) => {
    setSidebarColor(color);
    setSidebarColorHex(color);
    setPendingChanges(true);
  };

  const handleBackgroundColorChange = (color: string) => {
    setBackgroundColor(color);
    setBackgroundColorHex(color);
    setPendingChanges(true);
  };

  const handleSidebarColorHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSidebarColorHex(value);
    if (value.match(/^#[0-9A-Fa-f]{6}$/)) {
      setSidebarColor(value);
      setPendingChanges(true);
    }
  };

  const handleBackgroundColorHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setBackgroundColorHex(value);
    if (value.match(/^#[0-9A-Fa-f]{6}$/)) {
      setBackgroundColor(value);
      setPendingChanges(true);
    }
  };

  const handleRestoreDefaultColors = () => {
    setSidebarColor('#374DA4');
    setBackgroundColor('#3600FF');
    setSidebarColorHex('#374DA4');
    setBackgroundColorHex('#3600FF');
    setPendingChanges(true);
  };

  const handleLogoFileChange = (file: File | null) => {
    setCustomLogoFile(file);
    setPendingChanges(true);
  };

  const handleFaviconFileChange = (file: File | null) => {
    setFaviconFile(file);
    setPendingChanges(true);
  };

  const handleSaveAllChanges = async () => {
    try {
      let logoUrl = settings.custom_logo_url;
      let faviconUrl = settings.custom_favicon_url;

      // Upload da logo se houver arquivo selecionado
      if (customLogoFile) {
        console.log('Iniciando upload da logo:', customLogoFile.name);
        const uploadedLogoUrl = await uploadFile(customLogoFile, 'logos');
        if (uploadedLogoUrl) {
          console.log('Logo uploadada com sucesso:', uploadedLogoUrl);
          logoUrl = uploadedLogoUrl;
        } else {
          console.error('Falha no upload da logo');
          return; // Não continuar se o upload falhar
        }
        setCustomLogoFile(null);
      }

      // Upload do favicon se houver arquivo selecionado
      if (faviconFile) {
        console.log('Iniciando upload do favicon:', faviconFile.name);
        const uploadedFaviconUrl = await uploadFile(faviconFile, 'logos');
        if (uploadedFaviconUrl) {
          console.log('Favicon uploadado com sucesso:', uploadedFaviconUrl);
          faviconUrl = uploadedFaviconUrl;
        } else {
          console.error('Falha no upload do favicon');
          return; // Não continuar se o upload falhar
        }
        setFaviconFile(null);
      }

      // Salvar todas as configurações de uma vez
      console.log('Salvando configurações:', {
        sidebar_color: sidebarColor,
        sidebar_background_color: backgroundColor,
        custom_logo_url: logoUrl,
        custom_favicon_url: faviconUrl
      });

      await updateSettings({
        sidebar_color: sidebarColor,
        sidebar_background_color: backgroundColor,
        custom_logo_url: logoUrl,
        custom_favicon_url: faviconUrl
      });

      // Recarregar as configurações para garantir que estão atualizadas
      await refetch();

      setPendingChanges(false);
      console.log('Todas as configurações salvas com sucesso');
    } catch (error) {
      console.error('Erro ao salvar alterações:', error);
    }
  };

  const resetToDefaultLogo = async () => {
    await updateSettings({
      custom_logo_url: undefined
    });
    await refetch();
  };

  const resetToDefaultFavicon = async () => {
    await updateSettings({
      custom_favicon_url: undefined
    });
    await refetch();
  };

  if (loading) {
    return (
      <div className="p-6 space-y-8 bg-gray-50 min-h-screen">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 bg-white min-h-screen">
      {/* Header com botão de salvar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reorganizar Sidebar</h1>
          <p className="text-base mt-2">Personalize a aparência e ordem do menu lateral</p>
        </div>
        <Button
          onClick={handleSaveAllChanges}
          disabled={!pendingChanges || uploading}
          className="flex items-center gap-2 px-6 py-3 text-base"
          size="lg"
        >
          <Save className="h-5 w-5" />
          {uploading ? 'Salvando...' : 'Salvar Alterações'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Menu Order */}
        <Card className="border-none shadow-lg rounded-2xl bg-white">
          <CardHeader className="p-6">
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Ordem do Menu
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={menuItems.map(item => item.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {menuItems.map((item) => (
                    <SortableItem key={item.id} id={item.id} label={item.label} icon={item.icon} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </CardContent>
        </Card>

        {/* Customization Options */}
        <div className="space-y-6">
          {/* Accent Color Picker */}
          <Card className="border-none shadow-lg rounded-2xl bg-white">
            <CardHeader className="p-6">
              <CardTitle className="flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Cor dos Itens Selecionados
                </div>
                <Button
                  onClick={handleRestoreDefaultColors}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1"
                >
                  <RotateCcw className="h-4 w-4" />
                  Restaurar Padrão
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <button
                      onClick={() => setShowColorPicker(!showColorPicker)}
                      className="w-12 h-12 rounded-lg border-2 border-gray-200 cursor-pointer hover:border-gray-300 transition-colors"
                      style={{ backgroundColor: sidebarColor }}
                    />
                    {showColorPicker && (
                      <ColorWheel
                        color={sidebarColor}
                        onChange={handleSidebarColorChange}
                        onClose={() => setShowColorPicker(false)}
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <Label>Código HEX</Label>
                    <Input
                      type="text"
                      value={sidebarColorHex}
                      onChange={handleSidebarColorHexChange}
                      placeholder="#374DA4"
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Background Color Picker */}
          <Card className="border-none shadow-lg rounded-2xl bg-white">
            <CardHeader className="p-6">
              <CardTitle className="flex items-center gap-2">
                <Image className="h-5 w-5" />
                Cor de Fundo da Sidebar
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <button
                      onClick={() => setShowBackgroundColorPicker(!showBackgroundColorPicker)}
                      className="w-12 h-12 rounded-lg border-2 border-gray-200 cursor-pointer hover:border-gray-300 transition-colors"
                      style={{ backgroundColor: backgroundColor }}
                    />
                    {showBackgroundColorPicker && (
                      <ColorWheel
                        color={backgroundColor}
                        onChange={handleBackgroundColorChange}
                        onClose={() => setShowBackgroundColorPicker(false)}
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <Label>Código HEX</Label>
                    <Input
                      type="text"
                      value={backgroundColorHex}
                      onChange={handleBackgroundColorHexChange}
                      placeholder="#3600FF"
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Logo Upload */}
          <Card className="border-none shadow-lg rounded-2xl bg-white">
            <CardHeader className="p-6">
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Logo Personalizada
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <div className="space-y-4">
                <div>
                  <Label>Logo Completa</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setCustomLogoFile(file);
                      setPendingChanges(true);
                    }}
                    className="mt-1"
                    disabled={uploading}
                  />
                </div>
                {settings.custom_logo_url ? (
                  <div className="p-4 border rounded-lg">
                    <img 
                      src={settings.custom_logo_url} 
                      alt="Custom Logo" 
                      className="h-12 object-contain mb-2"
                    />
                    <Button
                      onClick={resetToDefaultLogo}
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={uploading}
                    >
                      Usar Logo Padrão
                    </Button>
                  </div>
                ) : (
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center space-x-3 mb-2">
                      <img 
                        src="/lovable-uploads/1ace337d-1080-46b1-b9e6-15dba227814c.png" 
                        alt="ElloSuit Logo" 
                        className="h-10 w-auto"
                        onError={(e) => {
                          console.error('Erro ao carregar logo padrão no editor:', e);
                        }}
                      />
                      <span className="text-lg font-bold text-gray-900">ElloSuit</span>
                    </div>
                    <p className="text-sm text-gray-500">Logo padrão da ElloSuit</p>
                  </div>
                )}
                {customLogoFile && (
                  <p className="text-sm text-green-600">
                    Arquivo selecionado: {customLogoFile.name}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Favicon Upload */}
          <Card className="border-none shadow-lg rounded-2xl bg-white">
            <CardHeader className="p-6">
              <CardTitle className="flex items-center gap-2">
                <Image className="h-5 w-5" />
                Favicon (Logo 1:1)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <div className="space-y-4">
                <div>
                  <Label>Favicon para Sidebar Recolhida (formato quadrado 1:1)</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setFaviconFile(file);
                      setPendingChanges(true);
                    }}
                    className="mt-1"
                    disabled={uploading}
                  />
                </div>
                {settings.custom_favicon_url ? (
                  <div className="p-4 border rounded-lg">
                    <img 
                      src={settings.custom_favicon_url} 
                      alt="Custom Favicon" 
                      className="h-12 w-12 object-contain mb-2"
                    />
                    <Button
                      onClick={resetToDefaultFavicon}
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={uploading}
                    >
                      Usar Favicon Padrão
                    </Button>
                  </div>
                ) : (
                  <div className="p-4 border rounded-lg">
                    <img 
                      src="/lovable-uploads/331ff3c7-4d10-4f90-bfdf-ec5b94766b0d.png" 
                      alt="ElloSuit Favicon" 
                      className="h-12 w-12 object-contain mb-2"
                      onError={(e) => {
                        console.error('Erro ao carregar favicon padrão no editor:', e);
                      }}
                    />
                    <p className="text-sm text-gray-500">Favicon padrão da ElloSuit</p>
                  </div>
                )}
                {faviconFile && (
                  <p className="text-sm text-green-600">
                    Arquivo selecionado: {faviconFile.name}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SidebarEditor;
