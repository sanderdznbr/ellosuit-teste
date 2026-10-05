
import React, { useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Save, Eye, ArrowLeft, Palette } from 'lucide-react';
import { DesignCanvas } from './DesignCanvas';
import { ElementsPalette } from './ElementsPalette';
import { PropertiesPanel } from './PropertiesPanel';
import { useEmailDesigns } from '@/hooks/useEmailDesigns';
import { HexColorPicker } from 'react-colorful';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface EmailDesignerProps {
  onBack: () => void;
  existingDesign?: any;
}

export interface DesignElement {
  id: string;
  type: 'text' | 'image' | 'button' | 'divider' | 'spacer';
  content?: string;
  styles: {
    fontSize?: string;
    color?: string;
    backgroundColor?: string;
    padding?: string;
    margin?: string;
    textAlign?: 'left' | 'center' | 'right';
    fontWeight?: string;
    width?: string;
    height?: string;
    borderRadius?: string;
    border?: string;
  };
  position: { x: number; y: number };
}

const EmailDesigner: React.FC<EmailDesignerProps> = ({ onBack, existingDesign }) => {
  const [designName, setDesignName] = useState(existingDesign?.name || '');
  const [designDescription, setDesignDescription] = useState(existingDesign?.description || '');
  const [elements, setElements] = useState<DesignElement[]>(existingDesign?.design_data?.elements || []);
  const [selectedElement, setSelectedElement] = useState<DesignElement | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  
  // Global styles - default to white backgrounds
  const [emailBackgroundColor, setEmailBackgroundColor] = useState(
    existingDesign?.design_data?.globalStyles?.backgroundColor || '#f4f4f4'
  );
  const [contentBackgroundColor, setContentBackgroundColor] = useState(
    existingDesign?.design_data?.globalStyles?.contentBackgroundColor || '#ffffff'
  );
  
  const { createDesign, updateDesign } = useEmailDesigns();

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    // Se arrastou de palette para canvas
    if (active.data.current?.type === 'palette-item' && over.id === 'canvas') {
      const newElement: DesignElement = {
        id: `element-${Date.now()}`,
        type: active.data.current.elementType,
        content: getDefaultContent(active.data.current.elementType),
        styles: getDefaultStyles(active.data.current.elementType),
        position: { x: 100, y: 100 }
      };
      
      setElements(prev => [...prev, newElement]);
    }
  };

  const getDefaultContent = (type: string) => {
    switch (type) {
      case 'text': return 'Seu texto aqui';
      case 'button': return 'Clique aqui';
      case 'image': return '';
      default: return '';
    }
  };

  const getDefaultStyles = (type: string) => {
    const baseStyles = {
      padding: '10px',
      margin: '5px',
    };

    switch (type) {
      case 'text':
        return { ...baseStyles, fontSize: '16px', color: '#000000', textAlign: 'left' as const };
      case 'button':
        return { 
          ...baseStyles, 
          backgroundColor: '#007bff', 
          color: '#ffffff', 
          borderRadius: '5px',
          textAlign: 'center' as const,
          padding: '12px 24px'
        };
      case 'image':
        return { ...baseStyles, width: '200px', height: '150px' };
      case 'divider':
        return { ...baseStyles, height: '1px', backgroundColor: '#e0e0e0', width: '100%' };
      case 'spacer':
        return { ...baseStyles, height: '20px', width: '100%' };
      default:
        return baseStyles;
    }
  };

  const updateElementStyles = (elementId: string, newStyles: Partial<DesignElement['styles']>) => {
    setElements(prev => 
      prev.map(el => 
        el.id === elementId 
          ? { ...el, styles: { ...el.styles, ...newStyles } }
          : el
      )
    );
  };

  const updateElementContent = (elementId: string, newContent: string) => {
    setElements(prev => 
      prev.map(el => 
        el.id === elementId 
          ? { ...el, content: newContent }
          : el
      )
    );
  };

  const deleteElement = (elementId: string) => {
    setElements(prev => prev.filter(el => el.id !== elementId));
    setSelectedElement(null);
  };

  const handleSave = async () => {
    if (!designName.trim()) {
      alert('Por favor, insira um nome para o design');
      return;
    }

    const designData = {
      name: designName,
      description: designDescription,
      design_data: { 
        elements,
        globalStyles: {
          backgroundColor: emailBackgroundColor,
          contentBackgroundColor: contentBackgroundColor
        }
      },
      is_published: false
    };

    if (existingDesign) {
      await updateDesign(existingDesign.id, designData);
    } else {
      await createDesign(designData);
    }
  };

  const generateHTML = () => {
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${designName}</title>
      </head>
      <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: ${emailBackgroundColor};">
        <div style="max-width: 600px; margin: 0 auto; background-color: ${contentBackgroundColor}; padding: 20px; border-radius: 8px;">
    `;

    elements.forEach(element => {
      const styles = Object.entries(element.styles)
        .map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`)
        .join('; ');

      switch (element.type) {
        case 'text':
          html += `<div style="${styles}">${element.content}</div>`;
          break;
        case 'button':
          html += `<a href="#" style="${styles}; display: inline-block; text-decoration: none;">${element.content}</a>`;
          break;
        case 'image':
          html += `<img src="${element.content || 'https://via.placeholder.com/200x150'}" style="${styles}" alt="Image" />`;
          break;
        case 'divider':
          html += `<hr style="${styles}; border: none;" />`;
          break;
        case 'spacer':
          html += `<div style="${styles}"></div>`;
          break;
      }
    });

    html += `
        </div>
      </body>
      </html>
    `;

    return html;
  };

  // Color picker helper
  const ColorPickerButton = ({ label, value, onChange }: { label: string; value: string; onChange: (color: string) => void }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <div className="w-4 h-4 rounded border" style={{ backgroundColor: value }} />
          <span className="text-xs">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <HexColorPicker color={value} onChange={onChange} />
        <Input 
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          className="mt-2 text-xs"
          placeholder="#000000"
        />
      </PopoverContent>
    </Popover>
  );

  if (showPreview) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <Button variant="outline" onClick={() => setShowPreview(false)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Editor
          </Button>
          <h2 className="text-xl font-semibold">Preview: {designName}</h2>
          <div></div>
        </div>
        <div className="flex-1 p-4 bg-muted/30">
          <div className="max-w-2xl mx-auto">
            <iframe
              srcDoc={generateHTML()}
              className="w-full h-full min-h-[600px] bg-white border rounded-lg shadow"
              title="Email Preview"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-card">
          <div className="flex items-center space-x-4">
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div>
              <Input
                placeholder="Nome do design"
                value={designName}
                onChange={(e) => setDesignName(e.target.value)}
                className="w-64"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {/* Global Background Colors */}
            <div className="flex items-center gap-2 mr-4 px-3 py-1 bg-muted rounded-lg">
              <Palette className="h-4 w-4 text-muted-foreground" />
              <ColorPickerButton 
                label="Fundo Email" 
                value={emailBackgroundColor} 
                onChange={setEmailBackgroundColor}
              />
              <ColorPickerButton 
                label="Fundo Conteúdo" 
                value={contentBackgroundColor} 
                onChange={setContentBackgroundColor}
              />
            </div>
            <Button variant="outline" onClick={() => setShowPreview(true)}>
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
            <Button onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Salvar
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex">
          {/* Elements Palette */}
          <div className="w-64 border-r bg-card">
            <ElementsPalette />
          </div>

          {/* Canvas */}
          <div className="flex-1 p-4 bg-muted/30">
            <DesignCanvas
              elements={elements}
              selectedElement={selectedElement}
              onSelectElement={setSelectedElement}
              onUpdateElement={updateElementStyles}
              onDeleteElement={deleteElement}
            />
          </div>

          {/* Properties Panel */}
          <div className="w-80 border-l bg-card">
            <PropertiesPanel
              selectedElement={selectedElement}
              onUpdateStyles={updateElementStyles}
              onUpdateContent={updateElementContent}
            />
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeId ? (
          <div className="bg-[#DFE4FB] border-2 border-[#879CE0] p-2 rounded opacity-75">
            Arrastando...
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default EmailDesigner;
