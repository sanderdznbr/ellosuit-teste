import React, { useState, useEffect, useCallback } from 'react';
import { DynamicVariables } from '@/components/EmailDesigner/DynamicVariables';
import { DndContext, closestCenter, DragEndEvent, DragStartEvent, useDraggable, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { 
  ArrowLeft, 
  Save, 
  Smartphone, 
  Monitor,
  Type,
  Image,
  Square,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  Link2,
  Mail,
  Columns,
  Trash2,
  Copy,
  GripVertical,
  Settings2,
  Palette,
  Code,
  Loader2,
  Upload,
  Video,
  ExternalLink,
  LayoutGrid,
  Undo2,
  Redo2,
  Minus,
  Plus,
  Facebook,
  Instagram,
  Linkedin,
  MessageCircle,
  Twitter,
  X,
  Crown,
  Info
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useFileUpload } from '@/hooks/useFileUpload';

interface EmailElement {
  id: string;
  type: 'header' | 'paragraph' | 'button' | 'image' | 'divider' | 'spacer' | 'columns' | 'list' | 'social' | 'footer' | 'video' | 'logo-header' | 'alert';
  content: any;
  styles: any;
}

const ELEMENT_TYPES = [
  { type: 'logo-header', label: 'Cabeçalho', icon: Crown, category: 'content' },
  { type: 'header', label: 'Título', icon: Type, category: 'content' },
  { type: 'paragraph', label: 'Parágrafo', icon: AlignLeft, category: 'content' },
  { type: 'button', label: 'Botão', icon: Square, category: 'content' },
  { type: 'alert', label: 'Caixa Info', icon: Info, category: 'content' },
  { type: 'image', label: 'Imagem', icon: Image, category: 'media' },
  { type: 'video', label: 'Vídeo', icon: Video, category: 'media' },
  { type: 'divider', label: 'Divisor', icon: Minus, category: 'layout' },
  { type: 'spacer', label: 'Espaço', icon: LayoutGrid, category: 'layout' },
  { type: 'columns', label: '2 Colunas', icon: Columns, category: 'layout' },
  { type: 'list', label: 'Lista', icon: List, category: 'content' },
  { type: 'social', label: 'Redes Sociais', icon: Link2, category: 'content' },
  { type: 'footer', label: 'Rodapé', icon: Mail, category: 'content' },
];

const createDefaultElement = (type: string): EmailElement => {
  const id = `element-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const defaults: Record<string, any> = {
    'logo-header': { content: { logoSrc: '', title: '', subtitle: '' }, styles: { gradientFrom: '#3A00E5', gradientTo: '#6B3AFF', padding: '40px', textAlign: 'center', titleColor: '#ffffff', subtitleColor: 'rgba(255,255,255,0.8)', borderRadius: '0' } },
    header: { content: { text: 'Título do Email', level: 'h1' }, styles: { color: '#1a1a1a', fontSize: '32px', textAlign: 'center', fontWeight: '700', padding: '16px 0' } },
    paragraph: { content: { text: 'Seu texto aqui. Clique para editar e personalizar.' }, styles: { color: '#4a4a4a', fontSize: '16px', lineHeight: '1.6', textAlign: 'left', padding: '8px 0' } },
    button: { content: { text: 'Clique Aqui', url: '#' }, styles: { backgroundColor: '#374DA4', color: '#ffffff', padding: '16px 32px', borderRadius: '8px', fontSize: '16px', textAlign: 'center' } },
    alert: { content: { text: 'Informação importante aqui.', alertType: 'info' }, styles: { backgroundColor: '#EFF6FF', borderColor: '#374DA4', textColor: '#1E40AF', padding: '16px 20px', borderRadius: '8px', borderWidth: '1px', fontSize: '14px' } },
    image: { content: { src: '', alt: 'Imagem' }, styles: { width: '100%', maxWidth: '100%', borderRadius: '8px', alignment: 'center' } },
    video: { content: { src: '', thumbnail: '', alt: 'Vídeo' }, styles: { width: '100%', maxWidth: '100%', borderRadius: '8px', alignment: 'center' } },
    divider: { content: {}, styles: { borderColor: '#e0e0e0', borderWidth: '1px', margin: '24px 0' } },
    spacer: { content: {}, styles: { height: '40px' } },
    columns: { content: { left: 'Coluna Esquerda', right: 'Coluna Direita' }, styles: { gap: '16px', backgroundColor: '#f5f5f5', padding: '16px', borderRadius: '8px' } },
    list: { content: { items: ['Item 1', 'Item 2', 'Item 3'], listIcon: 'bullet' }, styles: { color: '#4a4a4a', fontSize: '16px', lineHeight: '1.8' } },
    social: { content: { facebook: '', instagram: '', linkedin: '', whatsapp: '', twitter: '' }, styles: { iconSize: '32px', gap: '16px', alignment: 'center' } },
    footer: { content: { text: '© 2024 Sua Empresa. Todos os direitos reservados.', unsubscribe: '#', address: 'Seu endereço aqui' }, styles: { color: '#888888', fontSize: '12px', backgroundColor: '#f9f9f9', padding: '24px' } },
  };

  return { id, type: type as any, ...defaults[type] };
};

// Parse saved HTML back into EmailElement[] for editing
const parseHtmlToElements = (html: string): { elements: EmailElement[]; globalStyles?: any; rawHtml?: boolean } => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const container = doc.querySelector('.email-container');
  
  // If no .email-container found, this is a raw HTML template (table-based)
  // Import it as a single HTML block that can be edited in source
  if (!container) {
    // Try to extract meaningful content from body
    const body = doc.body;
    if (body && body.innerHTML.trim()) {
      return {
        elements: [{
          id: `element-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'paragraph',
          content: { text: html },
          styles: { color: '#4a4a4a', fontSize: '16px', lineHeight: '1.6', textAlign: 'left' as any, padding: '0' }
        }],
        rawHtml: true
      };
    }
    return { elements: [] };
  }

  const elements: EmailElement[] = [];
  const makeId = () => `element-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const getStyle = (el: Element, prop: string) => (el as HTMLElement).style?.getPropertyValue(prop) || '';

  container.childNodes.forEach(node => {
    if (node.nodeType !== 1) return;
    const el = node as HTMLElement;
    const tag = el.tagName?.toLowerCase();

    // Header (h1-h6)
    if (/^h[1-6]$/.test(tag)) {
      elements.push({
        id: makeId(), type: 'header',
        content: { text: el.textContent || '', level: tag },
        styles: {
          color: el.style.color || '#1a1a1a',
          fontSize: el.style.fontSize || '32px',
          textAlign: (el.style.textAlign || 'center') as any,
          fontWeight: el.style.fontWeight || '700',
          padding: el.style.padding || '16px 0',
        }
      });
    }
    // Paragraph
    else if (tag === 'p') {
      elements.push({
        id: makeId(), type: 'paragraph',
        content: { text: el.innerHTML || '' },
        styles: {
          color: el.style.color || '#4a4a4a',
          fontSize: el.style.fontSize || '16px',
          lineHeight: el.style.lineHeight || '1.6',
          textAlign: (el.style.textAlign || 'left') as any,
          padding: el.style.padding || '8px 0',
        }
      });
    }
    // HR = divider
    else if (tag === 'hr') {
      elements.push({
        id: makeId(), type: 'divider', content: {},
        styles: {
          borderColor: el.style.borderTopColor || '#e0e0e0',
          borderWidth: el.style.borderTopWidth || '1px',
          margin: el.style.margin || '24px 0',
        }
      });
    }
    // UL = list
    else if (tag === 'ul') {
      const items = Array.from(el.querySelectorAll('li')).map(li => li.textContent || '');
      elements.push({
        id: makeId(), type: 'list',
        content: { items },
        styles: { color: el.style.color || '#4a4a4a', fontSize: el.style.fontSize || '16px', lineHeight: el.style.lineHeight || '1.8' }
      });
    }
    // Div - could be button, image, spacer, social, footer, columns
    else if (tag === 'div') {
      const link = el.querySelector('a');
      const img = el.querySelector('img');

      // Spacer (empty div with height)
      if (!el.children.length && !el.textContent?.trim() && el.style.height) {
        elements.push({ id: makeId(), type: 'spacer', content: {}, styles: { height: el.style.height } });
      }
      // Button (div > a without img)
      else if (link && !img) {
        // Check if it's social links (multiple <a>)
        const links = el.querySelectorAll('a');
        if (links.length > 1) {
          const social: any = { facebook: '', instagram: '', linkedin: '', whatsapp: '', twitter: '' };
          links.forEach(a => {
            const href = a.getAttribute('href') || '';
            const text = (a.textContent || '').toLowerCase();
            if (text.includes('facebook') || href.includes('facebook')) social.facebook = href;
            else if (text.includes('instagram') || href.includes('instagram')) social.instagram = href;
            else if (text.includes('linkedin') || href.includes('linkedin')) social.linkedin = href;
            else if (text.includes('whatsapp') || href.includes('whatsapp')) social.whatsapp = href;
            else if (text.includes('twitter') || href.includes('twitter')) social.twitter = href;
          });
          elements.push({
            id: makeId(), type: 'social', content: social,
            styles: { iconSize: '32px', gap: '16px', alignment: el.style.textAlign || 'center' }
          });
        } else {
          elements.push({
            id: makeId(), type: 'button',
            content: { text: link.textContent || 'Clique Aqui', url: link.getAttribute('href') || '#' },
            styles: {
              backgroundColor: link.style.backgroundColor || '#374DA4',
              color: link.style.color || '#ffffff',
              padding: link.style.padding || '16px 32px',
              borderRadius: link.style.borderRadius || '8px',
              fontSize: link.style.fontSize || '16px',
              textAlign: (el.style.textAlign || 'center') as any,
            }
          });
        }
      }
      // Image (div > img)
      else if (img && !link) {
        elements.push({
          id: makeId(), type: 'image',
          content: { src: img.getAttribute('src') || '', alt: img.getAttribute('alt') || 'Imagem' },
          styles: {
            width: img.style.width || '100%',
            maxWidth: img.style.maxWidth || '100%',
            borderRadius: img.style.borderRadius || '8px',
            alignment: el.style.textAlign || 'center',
          }
        });
      }
      // Video (div > a > img with play overlay)
      else if (link && img) {
        elements.push({
          id: makeId(), type: 'video',
          content: { src: link.getAttribute('href') || '', thumbnail: img.getAttribute('src') || '', alt: img.getAttribute('alt') || 'Vídeo' },
          styles: {
            width: img.style.width || '100%',
            maxWidth: img.style.maxWidth || '100%',
            borderRadius: img.style.borderRadius || '8px',
            alignment: el.style.textAlign || 'center',
          }
        });
      }
      // Footer (div with unsubscribe link)
      else if (el.querySelector('a[href]') && el.textContent?.includes('©')) {
        const unsub = el.querySelector('a')?.getAttribute('href') || '#';
        const pTags = el.querySelectorAll('p');
        const mainText = pTags[0]?.textContent || '';
        const address = pTags.length > 1 ? pTags[1]?.textContent || '' : '';
        elements.push({
          id: makeId(), type: 'footer',
          content: { text: mainText, unsubscribe: unsub, address },
          styles: {
            color: el.style.color || '#888888',
            fontSize: el.style.fontSize || '12px',
            backgroundColor: el.style.backgroundColor || '#f9f9f9',
            padding: el.style.padding || '24px',
          }
        });
      }
      // Columns (div with display:flex and 2 children)
      else if (el.style.display === 'flex' && el.children.length === 2) {
        elements.push({
          id: makeId(), type: 'columns',
          content: { left: el.children[0].innerHTML, right: el.children[1].innerHTML },
          styles: {
            gap: el.style.gap || '16px',
            backgroundColor: (el.children[0] as HTMLElement).style.backgroundColor || '#f5f5f5',
            padding: (el.children[0] as HTMLElement).style.padding || '16px',
            borderRadius: (el.children[0] as HTMLElement).style.borderRadius || '8px',
          }
        });
      }
    }
  });

  // Extract global styles from wrapper/container
  const wrapper = doc.querySelector('.email-wrapper');
  const body = doc.querySelector('body');
  let parsedGlobal: any = {};
  if (wrapper) {
    parsedGlobal.backgroundColor = (wrapper as HTMLElement).style.backgroundColor || '#ffffff';
  }
  if (container) {
    parsedGlobal.contentBackgroundColor = (container as HTMLElement).style.backgroundColor || '#ffffff';
    parsedGlobal.maxWidth = (container as HTMLElement).style.maxWidth || '600px';
    parsedGlobal.padding = (container as HTMLElement).style.padding || '20px';
  }
  if (body) {
    parsedGlobal.fontFamily = body.style.fontFamily || 'Arial, sans-serif';
  }

  return { elements, globalStyles: parsedGlobal };
};

// Sortable Element Component
const SortableElement: React.FC<{ 
  element: EmailElement; 
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onUpdateText: (id: string, updates: Partial<EmailElement>) => void;
  globalStyles: any;
}> = ({ element, isSelected, onSelect, onDelete, onDuplicate, onUpdateText, globalStyles }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: element.id });
  const [isEditing, setIsEditing] = React.useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (['header', 'paragraph', 'button', 'footer', 'logo-header', 'alert'].includes(element.type)) {
      setIsEditing(true);
    }
  };

  const handleBlur = (e: React.FocusEvent<any>) => {
    setIsEditing(false);
    const newText = e.currentTarget.textContent || '';
    if (element.type === 'header' || element.type === 'paragraph' || element.type === 'button') {
      onUpdateText(element.id, { content: { ...element.content, text: newText } });
    } else if (element.type === 'footer' || element.type === 'alert') {
      onUpdateText(element.id, { content: { ...element.content, text: newText } });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      (e.target as HTMLElement).blur();
    }
  };

  const renderElement = () => {
    switch (element.type) {
      case 'header':
        const HeadingTag = element.content.level as keyof JSX.IntrinsicElements;
        return (
          <div style={{ textAlign: element.styles.textAlign as any, padding: element.styles.padding }} onDoubleClick={handleDoubleClick}>
            <HeadingTag 
              style={{ 
                fontSize: element.styles.fontSize, 
                color: element.styles.color, 
                margin: 0,
                fontWeight: element.styles.fontWeight,
                outline: isEditing ? '2px solid #374DA4' : 'none',
                borderRadius: '4px',
                padding: isEditing ? '2px 4px' : undefined,
                minWidth: '20px',
              }}
              contentEditable={isEditing}
              suppressContentEditableWarning
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
            >
              {element.content.text}
            </HeadingTag>
          </div>
        );
      case 'paragraph':
        return (
          <p 
            style={{ 
              ...element.styles, 
              margin: 0,
              textAlign: element.styles.textAlign as any,
              outline: isEditing ? '2px solid #374DA4' : 'none',
              borderRadius: '4px',
              padding: isEditing ? '2px 4px' : element.styles.padding,
              minWidth: '20px',
            }}
            contentEditable={isEditing}
            suppressContentEditableWarning
            onDoubleClick={handleDoubleClick}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
          >
            {element.content.text}
          </p>
        );
      case 'button':
        return (
          <div style={{ textAlign: element.styles.textAlign as any }} onDoubleClick={handleDoubleClick}>
            <span 
              style={{ 
                display: 'inline-block',
                backgroundColor: element.styles.backgroundColor,
                color: element.styles.color,
                padding: element.styles.padding,
                borderRadius: element.styles.borderRadius,
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: element.styles.fontSize,
                outline: isEditing ? '2px solid #374DA4' : 'none',
                minWidth: '20px',
                cursor: isEditing ? 'text' : 'pointer',
              }}
              contentEditable={isEditing}
              suppressContentEditableWarning
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
            >
              {element.content.text}
            </span>
          </div>
        );
      case 'image':
        return (
          <div style={{ textAlign: element.styles.alignment as any }}>
            {element.content.src ? (
              <img 
                src={element.content.src} 
                alt={element.content.alt} 
                style={{ 
                  maxWidth: element.styles.maxWidth, 
                  width: element.styles.width,
                  borderRadius: element.styles.borderRadius,
                  display: 'inline-block'
                }} 
              />
            ) : (
              <div className="bg-gradient-to-br from-muted to-muted/50 h-40 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30">
                <Image className="h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Arraste uma imagem ou clique para fazer upload</p>
              </div>
            )}
          </div>
        );
      case 'video':
        return (
          <div style={{ textAlign: element.styles.alignment as any }}>
            {element.content.thumbnail ? (
              <div className="relative inline-block" style={{ maxWidth: element.styles.maxWidth, width: element.styles.width }}>
                <img 
                  src={element.content.thumbnail} 
                  alt={element.content.alt}
                  style={{ 
                    width: '100%',
                    borderRadius: element.styles.borderRadius 
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
                  <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center">
                    <div className="w-0 h-0 border-l-[20px] border-l-[#374DA4] border-y-[12px] border-y-transparent ml-1" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-muted to-muted/50 h-40 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30">
                <Video className="h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Adicione um vídeo com thumbnail</p>
              </div>
            )}
          </div>
        );
      case 'divider':
        return <hr style={{ border: 'none', borderTop: `${element.styles.borderWidth} solid ${element.styles.borderColor}`, margin: element.styles.margin }} />;
      case 'spacer':
        return <div style={{ height: element.styles.height, backgroundColor: 'transparent' }} className="border-y border-dashed border-muted-foreground/20" />;
      case 'columns':
        return (
          <div style={{ display: 'flex', gap: element.styles.gap }}>
            <div style={{ flex: 1, padding: element.styles.padding, backgroundColor: element.styles.backgroundColor, borderRadius: element.styles.borderRadius }}>
              {element.content.left}
            </div>
            <div style={{ flex: 1, padding: element.styles.padding, backgroundColor: element.styles.backgroundColor, borderRadius: element.styles.borderRadius }}>
              {element.content.right}
            </div>
          </div>
        );
      case 'list':
        const listIconType = element.content.listIcon || 'bullet';
        const getIconChar = (icon: string) => {
          switch(icon) { case 'check': return '✓'; case 'arrow': return '→'; case 'star': return '★'; case 'dot': return '•'; default: return ''; }
        };
        return listIconType === 'bullet' ? (
          <ul style={{ ...element.styles, paddingLeft: '24px', margin: 0 }}>
            {element.content.items.map((item: string, i: number) => (
              <li key={i} style={{ marginBottom: '8px' }}>{item}</li>
            ))}
          </ul>
        ) : (
          <div style={{ ...element.styles, margin: 0 }}>
            {element.content.items.map((item: string, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                <span style={{ color: listIconType === 'check' ? '#22C55E' : element.styles.color, fontWeight: 'bold', flexShrink: 0 }}>{getIconChar(listIconType)}</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        );
      case 'social':
        const socialIcons = [
          { key: 'facebook', icon: Facebook, color: '#1877F2' },
          { key: 'instagram', icon: Instagram, color: '#E4405F' },
          { key: 'linkedin', icon: Linkedin, color: '#0A66C2' },
          { key: 'whatsapp', icon: MessageCircle, color: '#25D366' },
          { key: 'twitter', icon: Twitter, color: '#1DA1F2' },
        ];
        return (
          <div style={{ textAlign: element.styles.alignment as any, display: 'flex', gap: element.styles.gap, justifyContent: element.styles.alignment }}>
            {socialIcons.map(({ key, icon: Icon, color }) => 
              element.content[key] && (
                <a key={key} href={element.content[key]} style={{ color }}>
                  <Icon style={{ width: element.styles.iconSize, height: element.styles.iconSize }} />
                </a>
              )
            )}
            {!Object.values(element.content).some(v => v) && (
              <p className="text-sm text-muted-foreground">Configure os links das redes sociais</p>
            )}
          </div>
        );
      case 'footer':
        return (
          <div 
            style={{ 
              textAlign: 'center', 
              color: element.styles.color, 
              fontSize: element.styles.fontSize,
              backgroundColor: element.styles.backgroundColor,
              padding: element.styles.padding,
              borderRadius: '8px'
            }}
            onDoubleClick={handleDoubleClick}
          >
            <p 
              style={{ 
                margin: '0 0 8px 0', 
                outline: isEditing ? '2px solid #374DA4' : 'none',
                borderRadius: '4px',
                minWidth: '20px',
              }}
              contentEditable={isEditing}
              suppressContentEditableWarning
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
            >
              {element.content.text}
            </p>
            {element.content.address && <p style={{ margin: '0 0 8px 0', opacity: 0.8 }}>{element.content.address}</p>}
            <a href={element.content.unsubscribe} style={{ color: '#888', fontSize: '11px' }}>Cancelar inscrição</a>
          </div>
        );
      case 'logo-header':
        return (
          <div 
            style={{ 
              background: `linear-gradient(135deg, ${element.styles.gradientFrom} 0%, ${element.styles.gradientTo} 100%)`,
              padding: element.styles.padding,
              textAlign: element.styles.textAlign as any,
              borderRadius: element.styles.borderRadius,
            }}
            onDoubleClick={handleDoubleClick}
          >
            {element.content.logoSrc && (
              <img src={element.content.logoSrc} alt="Logo" style={{ maxHeight: '50px', marginBottom: '16px', display: 'inline-block' }} />
            )}
            {element.content.title && (
              <h1 
                style={{ color: element.styles.titleColor, fontSize: '28px', fontWeight: '700', margin: element.content.logoSrc ? '0' : '0 0 8px 0', outline: isEditing ? '2px solid #374DA4' : 'none', borderRadius: '4px' }}
                contentEditable={isEditing} suppressContentEditableWarning
                onBlur={(e) => { setIsEditing(false); onUpdateText(element.id, { content: { ...element.content, title: e.currentTarget.textContent || '' } }); }}
                onKeyDown={handleKeyDown}
              >{element.content.title}</h1>
            )}
            {element.content.subtitle && <p style={{ color: element.styles.subtitleColor, fontSize: '16px', margin: '8px 0 0' }}>{element.content.subtitle}</p>}
            {!element.content.logoSrc && !element.content.title && (
              <div style={{ color: 'rgba(255,255,255,0.6)', padding: '20px' }}>
                <Crown style={{ width: '32px', height: '32px', marginBottom: '8px' }} />
                <p>Configure o cabeçalho</p>
              </div>
            )}
          </div>
        );
      case 'alert':
        return (
          <div 
            style={{ backgroundColor: element.styles.backgroundColor, border: `${element.styles.borderWidth} solid ${element.styles.borderColor}`, borderRadius: element.styles.borderRadius, padding: element.styles.padding, color: element.styles.textColor, fontSize: element.styles.fontSize }}
            onDoubleClick={handleDoubleClick}
          >
            <p style={{ margin: 0, outline: isEditing ? '2px solid #374DA4' : 'none', borderRadius: '4px' }}
              contentEditable={isEditing} suppressContentEditableWarning
              onBlur={(e) => { setIsEditing(false); onUpdateText(element.id, { content: { ...element.content, text: e.currentTarget.textContent || '' } }); }}
              onKeyDown={handleKeyDown}
            >{element.content.text}</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative border-2 rounded-lg p-4 transition-all cursor-pointer ${
        isSelected ? 'border-[#374DA4] bg-[#374DA4]/5 shadow-lg shadow-[#374DA4]/10' : 'border-transparent hover:border-[#374DA4]/40 hover:bg-[#374DA4]/5'
      }`}
      onClick={onSelect}
    >
      {/* Drag Handle & Actions */}
      <div className={`absolute -left-4 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10`}>
        <button 
          {...attributes} 
          {...listeners}
          className="p-2 bg-background border shadow-sm rounded-lg hover:bg-muted cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
      
      <div className={`absolute -right-4 top-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10`}>
        <button 
          onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
          className="p-2 bg-background border shadow-sm rounded-lg hover:bg-muted"
          title="Duplicar"
        >
          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-2 bg-destructive/10 border border-destructive/20 shadow-sm rounded-lg hover:bg-destructive/20"
          title="Excluir"
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </button>
      </div>

      {isEditing && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[#374DA4] text-white text-[10px] px-2 py-0.5 rounded-t-md whitespace-nowrap z-20">
          Editando • Enter para salvar
        </div>
      )}

      {renderElement()}
    </div>
  );
};

const EmailTemplateBuilder: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { uploadFile, uploading } = useFileUpload();
  
  // Check if coming from wizard
  const fromWizard = location.state?.fromWizard || false;
  
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [elements, setElements] = useState<EmailElement[]>([]);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [activeTab, setActiveTab] = useState<'elements' | 'style' | 'global'>('elements');
  const [saving, setSaving] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [history, setHistory] = useState<EmailElement[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [rawHtmlContent, setRawHtmlContent] = useState<string | null>(null);
  
  // Global styles - default to white backgrounds
  const [globalStyles, setGlobalStyles] = useState({
    backgroundColor: '#ffffff',
    contentBackgroundColor: '#ffffff',
    backgroundImage: '',
    backgroundSize: 'cover',
    fontFamily: 'Arial, sans-serif',
    maxWidth: '600px',
    padding: '20px'
  });

  // Fetch company ID
  useEffect(() => {
    const fetchCompanyId = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();
      if (data) setCompanyId(data.company_id);
    };
    fetchCompanyId();
  }, [user]);

  // Load existing template for editing
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const templateId = params.get('templateId');
    if (!templateId || !user) return;

    const loadTemplate = async () => {
      setLoadingTemplate(true);
      try {
        const { data, error } = await supabase
          .from('email_templates')
          .select('*')
          .eq('id', templateId)
          .single();

        if (error) throw error;
        if (!data) return;

        setEditingTemplateId(data.id);
        setTemplateName(data.name);
        setTemplateDescription(data.description || '');

        // Check if design_data exists (block-based editing)
        const designData = (data as any).design_data;
        if (designData && designData.elements && designData.elements.length > 0) {
          setElements(designData.elements);
          saveToHistory(designData.elements);
          if (designData.globalStyles) {
            setGlobalStyles(prev => ({ ...prev, ...designData.globalStyles }));
          }
        } else {
          // Fallback: Parse HTML back into elements
          const parsed = parseHtmlToElements(data.html_content);
          if (parsed.rawHtml) {
            setRawHtmlContent(data.html_content);
          }
          if (parsed.elements.length > 0) {
            setElements(parsed.elements);
            saveToHistory(parsed.elements);
          }
          if (parsed.globalStyles) {
            setGlobalStyles(prev => ({ ...prev, ...parsed.globalStyles }));
          }
        }
      } catch (err) {
        console.error('Error loading template:', err);
        toast({ title: "Erro ao carregar template", variant: "destructive" });
      } finally {
        setLoadingTemplate(false);
      }
    };

    loadTemplate();
  }, [user, location.search]);

  // Save to history
  const saveToHistory = useCallback((newElements: EmailElement[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([...newElements]);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setElements(history[historyIndex - 1]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setElements(history[historyIndex + 1]);
    }
  };

  const addElement = (type: string) => {
    const newElement = createDefaultElement(type);
    const newElements = [...elements, newElement];
    setElements(newElements);
    setSelectedElement(newElement.id);
    saveToHistory(newElements);
  };

  const deleteElement = (id: string) => {
    const newElements = elements.filter(el => el.id !== id);
    setElements(newElements);
    if (selectedElement === id) setSelectedElement(null);
    saveToHistory(newElements);
  };

  const duplicateElement = (id: string) => {
    const elementToDuplicate = elements.find(el => el.id === id);
    if (!elementToDuplicate) return;
    
    const newElement = { 
      ...elementToDuplicate, 
      id: `element-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content: JSON.parse(JSON.stringify(elementToDuplicate.content)),
      styles: JSON.parse(JSON.stringify(elementToDuplicate.styles))
    };
    
    const index = elements.findIndex(el => el.id === id);
    const newElements = [...elements];
    newElements.splice(index + 1, 0, newElement);
    setElements(newElements);
    saveToHistory(newElements);
  };

  const updateElement = (id: string, updates: Partial<EmailElement>) => {
    const newElements = elements.map(el => 
      el.id === id ? { ...el, ...updates } : el
    );
    setElements(newElements);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    
    if (over && active.id !== over.id) {
      setElements(items => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        saveToHistory(newItems);
        return newItems;
      });
    }
  };

  // File drag and drop handler
  const handleFileDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    
    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    const videoFiles = files.filter(f => f.type.startsWith('video/'));
    
    for (const file of imageFiles) {
    const url = await uploadFile(file, 'logos');
      if (url) {
        const newElement = createDefaultElement('image');
        newElement.content.src = url;
        const newElements = [...elements, newElement];
        setElements(newElements);
        saveToHistory(newElements);
        toast({ title: "Imagem adicionada!" });
      }
    }
    
    for (const file of videoFiles) {
      // For videos, we'll need a thumbnail - for now just add with placeholder
      const newElement = createDefaultElement('video');
      newElement.content.src = URL.createObjectURL(file);
      const newElements = [...elements, newElement];
      setElements(newElements);
      saveToHistory(newElements);
      toast({ title: "Vídeo adicionado!" });
    }
  }, [elements, uploadFile, saveToHistory, toast]);

  const handleFileDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleFileDragLeave = () => {
    setIsDraggingFile(false);
  };

  // Upload image for selected element
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedElement) return;
    
    const url = await uploadFile(file, 'logos');
    if (url) {
      const element = elements.find(el => el.id === selectedElement);
      if (element?.type === 'image') {
        updateElement(selectedElement, { content: { ...element.content, src: url } });
      } else if (element?.type === 'video') {
        updateElement(selectedElement, { content: { ...element.content, thumbnail: url } });
      }
      toast({ title: "Upload concluído!" });
    }
    e.target.value = '';
  };

  const generateHTML = (): string => {
    let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; font-family: ${globalStyles.fontFamily}; background-color: ${globalStyles.backgroundColor};${globalStyles.backgroundImage ? ` background-image: url('${globalStyles.backgroundImage}'); background-size: ${globalStyles.backgroundSize}; background-position: center; background-repeat: no-repeat;` : ''} }
    .email-wrapper { background-color: ${globalStyles.backgroundImage ? 'transparent' : globalStyles.backgroundColor}; padding: 20px 0; }
    .email-container { max-width: ${globalStyles.maxWidth}; margin: 0 auto; padding: ${globalStyles.padding}; background-color: ${globalStyles.contentBackgroundColor || '#ffffff'}; }
    img { max-width: 100%; height: auto; }
    a { text-decoration: none; }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">`;

    elements.forEach(el => {
      switch (el.type) {
        case 'header':
          html += `<${el.content.level} style="color: ${el.styles.color}; font-size: ${el.styles.fontSize}; text-align: ${el.styles.textAlign}; font-weight: ${el.styles.fontWeight}; padding: ${el.styles.padding}; margin: 0;">${el.content.text}</${el.content.level}>`;
          break;
        case 'paragraph':
          html += `<p style="color: ${el.styles.color}; font-size: ${el.styles.fontSize}; line-height: ${el.styles.lineHeight}; text-align: ${el.styles.textAlign}; padding: ${el.styles.padding}; margin: 0;">${el.content.text}</p>`;
          break;
        case 'button':
          html += `<div style="text-align: ${el.styles.textAlign}; padding: 16px 0;"><a href="${el.content.url}" style="display: inline-block; background-color: ${el.styles.backgroundColor}; color: ${el.styles.color}; padding: ${el.styles.padding}; border-radius: ${el.styles.borderRadius}; font-weight: 600; font-size: ${el.styles.fontSize};">${el.content.text}</a></div>`;
          break;
        case 'image':
          if (el.content.src) {
            html += `<div style="text-align: ${el.styles.alignment}; padding: 16px 0;"><img src="${el.content.src}" alt="${el.content.alt}" style="max-width: ${el.styles.maxWidth}; width: ${el.styles.width}; border-radius: ${el.styles.borderRadius};"></div>`;
          }
          break;
        case 'video':
          if (el.content.thumbnail) {
            html += `<div style="text-align: ${el.styles.alignment}; padding: 16px 0;"><a href="${el.content.src}" target="_blank" style="display: inline-block; position: relative;"><img src="${el.content.thumbnail}" alt="${el.content.alt}" style="max-width: ${el.styles.maxWidth}; width: ${el.styles.width}; border-radius: ${el.styles.borderRadius};"><div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 60px; height: 60px; background: rgba(255,255,255,0.9); border-radius: 50%; display: flex; align-items: center; justify-content: center;"><div style="width: 0; height: 0; border-left: 20px solid #374DA4; border-top: 12px solid transparent; border-bottom: 12px solid transparent; margin-left: 4px;"></div></div></a></div>`;
          }
          break;
        case 'divider':
          html += `<hr style="border: none; border-top: ${el.styles.borderWidth} solid ${el.styles.borderColor}; margin: ${el.styles.margin};">`;
          break;
        case 'spacer':
          html += `<div style="height: ${el.styles.height};"></div>`;
          break;
        case 'columns':
          html += `<div style="display: flex; gap: ${el.styles.gap}; padding: 16px 0;"><div style="flex: 1; padding: ${el.styles.padding}; background-color: ${el.styles.backgroundColor}; border-radius: ${el.styles.borderRadius};">${el.content.left}</div><div style="flex: 1; padding: ${el.styles.padding}; background-color: ${el.styles.backgroundColor}; border-radius: ${el.styles.borderRadius};">${el.content.right}</div></div>`;
          break;
        case 'list':
          const lIcon = el.content.listIcon || 'bullet';
          if (lIcon === 'bullet') {
            html += `<ul style="color: ${el.styles.color}; font-size: ${el.styles.fontSize}; line-height: ${el.styles.lineHeight}; padding-left: 24px; margin: 16px 0;">${el.content.items.map((item: string) => `<li style="margin-bottom: 8px;">${item}</li>`).join('')}</ul>`;
          } else {
            const iconMap: Record<string, string> = { check: '✓', arrow: '→', star: '★', dot: '•' };
            const ic = iconMap[lIcon] || '•';
            const icColor = lIcon === 'check' ? '#22C55E' : el.styles.color;
            html += `<div style="color: ${el.styles.color}; font-size: ${el.styles.fontSize}; line-height: ${el.styles.lineHeight}; margin: 16px 0;">${el.content.items.map((item: string) => `<div style="display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px;"><span style="color: ${icColor}; font-weight: bold;">${ic}</span><span>${item}</span></div>`).join('')}</div>`;
          }
          break;
        case 'social':
          const socialLinks = [];
          if (el.content.facebook) socialLinks.push(`<a href="${el.content.facebook}" style="color: #1877F2; margin: 0 8px;">Facebook</a>`);
          if (el.content.instagram) socialLinks.push(`<a href="${el.content.instagram}" style="color: #E4405F; margin: 0 8px;">Instagram</a>`);
          if (el.content.linkedin) socialLinks.push(`<a href="${el.content.linkedin}" style="color: #0A66C2; margin: 0 8px;">LinkedIn</a>`);
          if (el.content.whatsapp) socialLinks.push(`<a href="${el.content.whatsapp}" style="color: #25D366; margin: 0 8px;">WhatsApp</a>`);
          if (el.content.twitter) socialLinks.push(`<a href="${el.content.twitter}" style="color: #1DA1F2; margin: 0 8px;">Twitter</a>`);
          if (socialLinks.length) {
            html += `<div style="text-align: ${el.styles.alignment}; padding: 16px 0;">${socialLinks.join('')}</div>`;
          }
          break;
        case 'footer':
          html += `<div style="text-align: center; color: ${el.styles.color}; font-size: ${el.styles.fontSize}; background-color: ${el.styles.backgroundColor}; padding: ${el.styles.padding}; border-radius: 8px; margin-top: 24px;"><p style="margin: 0 0 8px 0;">${el.content.text}</p>${el.content.address ? `<p style="margin: 0 0 8px 0; opacity: 0.8;">${el.content.address}</p>` : ''}<a href="${el.content.unsubscribe}" style="color: #888; font-size: 11px;">Cancelar inscrição</a></div>`;
          break;
        case 'logo-header':
          html += `<div style="background: linear-gradient(135deg, ${el.styles.gradientFrom} 0%, ${el.styles.gradientTo} 100%); padding: ${el.styles.padding}; text-align: ${el.styles.textAlign}; border-radius: ${el.styles.borderRadius};">`;
          if (el.content.logoSrc) html += `<img src="${el.content.logoSrc}" alt="Logo" style="max-height: 50px; margin-bottom: 16px;">`;
          if (el.content.title) html += `<h1 style="color: ${el.styles.titleColor}; font-size: 28px; font-weight: 700; margin: 0;">${el.content.title}</h1>`;
          if (el.content.subtitle) html += `<p style="color: ${el.styles.subtitleColor}; font-size: 16px; margin: 8px 0 0;">${el.content.subtitle}</p>`;
          html += `</div>`;
          break;
        case 'alert':
          html += `<div style="background-color: ${el.styles.backgroundColor}; border: ${el.styles.borderWidth} solid ${el.styles.borderColor}; border-radius: ${el.styles.borderRadius}; padding: ${el.styles.padding}; color: ${el.styles.textColor}; font-size: ${el.styles.fontSize}; margin: 16px 0;"><p style="margin: 0;">${el.content.text}</p></div>`;
          break;
      }
    });

    html += `
    </div>
  </div>
</body>
</html>`;

    return html;
  };

  const saveTemplate = async () => {
    if (!templateName.trim()) {
      toast({ title: "Nome obrigatório", description: "Digite um nome para o template", variant: "destructive" });
      return;
    }

    if (!user || !companyId) {
      toast({ title: "Erro", description: "Usuário não autenticado", variant: "destructive" });
      return;
    }

    setSaving(true);

    try {
      const htmlContent = rawHtmlContent || generateHTML();
      const designDataPayload = rawHtmlContent ? null : { elements, globalStyles };
      
      if (editingTemplateId) {
        // Update existing template
        const { error } = await supabase
          .from('email_templates')
          .update({
            name: templateName,
            description: templateDescription,
            html_content: htmlContent,
            design_data: designDataPayload,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', editingTemplateId);

        if (error) throw error;
        toast({ title: "Template atualizado!", description: "Suas alterações foram salvas" });
      } else {
        // Insert new template
        const { data, error } = await supabase
          .from('email_templates')
          .insert({
            name: templateName,
            description: templateDescription,
            html_content: htmlContent,
            design_data: designDataPayload,
            category: 'custom',
            user_id: user.id,
            company_id: companyId
          } as any)
          .select()
          .single();

        if (error) throw error;
        toast({ title: "Template salvo!", description: "Seu template foi salvo com sucesso" });

        if (fromWizard && data) {
          navigate('/dashboard/email', { 
            state: { selectedTemplate: data, returnToStep: 3 } 
          });
          return;
        }
      }
      
      navigate('/dashboard/email-templates');
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const selectedElementData = elements.find(el => el.id === selectedElement);

  // Render style editor based on element type
  const renderStyleEditor = () => {
    if (!selectedElementData) {
      return (
        <div className="text-center text-muted-foreground py-12">
          <Settings2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Selecione um elemento</p>
          <p className="text-sm">Clique em um elemento para editar seus estilos</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between pb-3 border-b">
          <Badge variant="secondary" className="text-xs uppercase tracking-wide">
            {selectedElementData.type}
          </Badge>
          <Button variant="ghost" size="sm" onClick={() => setSelectedElement(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Header styles */}
        {selectedElementData.type === 'header' && (
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Texto</Label>
              <Input 
                value={selectedElementData.content.text}
                onChange={e => updateElement(selectedElementData.id, { content: { ...selectedElementData.content, text: e.target.value }})}
                className="mt-1.5"
              />
              <DynamicVariables
                onInsertVariable={(variable) => {
                  const current = selectedElementData.content.text || '';
                  updateElement(selectedElementData.id, { content: { ...selectedElementData.content, text: current + variable }});
                }}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Nível</Label>
              <div className="flex gap-2 mt-1.5">
                {['h1', 'h2', 'h3'].map(level => (
                  <Button
                    key={level}
                    variant="outline"
                    size="sm"
                    className={`flex-1 ${selectedElementData.content.level === level ? 'bg-[#374DA4] text-white border-[#374DA4] hover:bg-[#E03E00]' : ''}`}
                    onClick={() => updateElement(selectedElementData.id, { content: { ...selectedElementData.content, level }})}
                  >
                    {level.toUpperCase()}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Alinhamento</Label>
              <div className="flex gap-2 mt-1.5">
                {[{ value: 'left', icon: AlignLeft }, { value: 'center', icon: AlignCenter }, { value: 'right', icon: AlignRight }].map(({ value, icon: Icon }) => (
                  <Button
                    key={value}
                    variant="outline"
                    size="sm"
                    className={`flex-1 ${selectedElementData.styles.textAlign === value ? 'bg-[#374DA4] text-white border-[#374DA4] hover:bg-[#E03E00]' : ''}`}
                    onClick={() => updateElement(selectedElementData.id, { styles: { ...selectedElementData.styles, textAlign: value }})}
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Cor do Texto</Label>
              <div className="flex gap-2 mt-1.5">
                <Input 
                  type="color"
                  value={selectedElementData.styles.color}
                  onChange={e => updateElement(selectedElementData.id, { styles: { ...selectedElementData.styles, color: e.target.value }})}
                  className="w-12 h-10 p-1 cursor-pointer"
                />
                <Input 
                  value={selectedElementData.styles.color}
                  onChange={e => updateElement(selectedElementData.id, { styles: { ...selectedElementData.styles, color: e.target.value }})}
                  className="flex-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Tamanho da Fonte</Label>
              <Input 
                value={selectedElementData.styles.fontSize}
                onChange={e => updateElement(selectedElementData.id, { styles: { ...selectedElementData.styles, fontSize: e.target.value }})}
                placeholder="28px"
                className="mt-1.5"
              />
            </div>
          </div>
        )}

        {/* Paragraph styles */}
        {selectedElementData.type === 'paragraph' && (
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Texto</Label>
              <Textarea 
                value={selectedElementData.content.text}
                onChange={e => updateElement(selectedElementData.id, { content: { ...selectedElementData.content, text: e.target.value }})}
                rows={4}
                className="mt-1.5"
              />
              <DynamicVariables
                onInsertVariable={(variable) => {
                  const current = selectedElementData.content.text || '';
                  updateElement(selectedElementData.id, { content: { ...selectedElementData.content, text: current + variable }});
                }}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Alinhamento</Label>
              <div className="flex gap-2 mt-1.5">
                {[{ value: 'left', icon: AlignLeft }, { value: 'center', icon: AlignCenter }, { value: 'right', icon: AlignRight }].map(({ value, icon: Icon }) => (
                  <Button
                    key={value}
                    variant="outline"
                    size="sm"
                    className={`flex-1 ${selectedElementData.styles.textAlign === value ? 'bg-[#374DA4] text-white border-[#374DA4] hover:bg-[#E03E00]' : ''}`}
                    onClick={() => updateElement(selectedElementData.id, { styles: { ...selectedElementData.styles, textAlign: value }})}
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Cor do Texto</Label>
              <div className="flex gap-2 mt-1.5">
                <Input 
                  type="color"
                  value={selectedElementData.styles.color}
                  onChange={e => updateElement(selectedElementData.id, { styles: { ...selectedElementData.styles, color: e.target.value }})}
                  className="w-12 h-10 p-1 cursor-pointer"
                />
                <Input 
                  value={selectedElementData.styles.color}
                  onChange={e => updateElement(selectedElementData.id, { styles: { ...selectedElementData.styles, color: e.target.value }})}
                  className="flex-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Tamanho da Fonte</Label>
              <Input 
                value={selectedElementData.styles.fontSize}
                onChange={e => updateElement(selectedElementData.id, { styles: { ...selectedElementData.styles, fontSize: e.target.value }})}
                placeholder="16px"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Altura da Linha</Label>
              <Input 
                value={selectedElementData.styles.lineHeight}
                onChange={e => updateElement(selectedElementData.id, { styles: { ...selectedElementData.styles, lineHeight: e.target.value }})}
                placeholder="1.6"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Padding</Label>
              <Input 
                value={selectedElementData.styles.padding || ''}
                onChange={e => updateElement(selectedElementData.id, { styles: { ...selectedElementData.styles, padding: e.target.value }})}
                placeholder="8px 0"
                className="mt-1.5"
              />
            </div>
          </div>
        )}

        {/* Button styles */}
        {selectedElementData.type === 'button' && (
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Texto do Botão</Label>
              <Input 
                value={selectedElementData.content.text}
                onChange={e => updateElement(selectedElementData.id, { content: { ...selectedElementData.content, text: e.target.value }})}
                className="mt-1.5"
              />
              <DynamicVariables
                onInsertVariable={(variable) => {
                  const current = selectedElementData.content.text || '';
                  updateElement(selectedElementData.id, { content: { ...selectedElementData.content, text: current + variable }});
                }}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">URL do Link</Label>
              <Input 
                value={selectedElementData.content.url}
                onChange={e => updateElement(selectedElementData.id, { content: { ...selectedElementData.content, url: e.target.value }})}
                placeholder="https://..."
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Alinhamento</Label>
              <div className="flex gap-2 mt-1.5">
                {[{ value: 'left', icon: AlignLeft }, { value: 'center', icon: AlignCenter }, { value: 'right', icon: AlignRight }].map(({ value, icon: Icon }) => (
                  <Button
                    key={value}
                    variant="outline"
                    size="sm"
                    className={`flex-1 ${selectedElementData.styles.textAlign === value ? 'bg-[#374DA4] text-white border-[#374DA4] hover:bg-[#E03E00]' : ''}`}
                    onClick={() => updateElement(selectedElementData.id, { styles: { ...selectedElementData.styles, textAlign: value }})}
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Cor do Fundo</Label>
                <div className="flex gap-2 mt-1.5">
                  <Input 
                    type="color"
                    value={selectedElementData.styles.backgroundColor}
                    onChange={e => updateElement(selectedElementData.id, { styles: { ...selectedElementData.styles, backgroundColor: e.target.value }})}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Cor do Texto</Label>
                <div className="flex gap-2 mt-1.5">
                  <Input 
                    type="color"
                    value={selectedElementData.styles.color}
                    onChange={e => updateElement(selectedElementData.id, { styles: { ...selectedElementData.styles, color: e.target.value }})}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                </div>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Borda Arredondada</Label>
              <Input 
                value={selectedElementData.styles.borderRadius}
                onChange={e => updateElement(selectedElementData.id, { styles: { ...selectedElementData.styles, borderRadius: e.target.value }})}
                placeholder="8px"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Tamanho da Fonte</Label>
              <Input 
                value={selectedElementData.styles.fontSize}
                onChange={e => updateElement(selectedElementData.id, { styles: { ...selectedElementData.styles, fontSize: e.target.value }})}
                placeholder="16px"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Padding</Label>
              <Input 
                value={selectedElementData.styles.padding || ''}
                onChange={e => updateElement(selectedElementData.id, { styles: { ...selectedElementData.styles, padding: e.target.value }})}
                placeholder="16px 32px"
                className="mt-1.5"
              />
            </div>
          </div>
        )}

        {/* Image styles */}
        {selectedElementData.type === 'image' && (
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Upload de Imagem</Label>
              <div className="mt-1.5">
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                  <span className="text-sm text-muted-foreground">
                    {uploading ? 'Enviando...' : 'Clique para fazer upload'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Ou cole uma URL</Label>
              <Input 
                value={selectedElementData.content.src}
                onChange={e => updateElement(selectedElementData.id, { content: { ...selectedElementData.content, src: e.target.value }})}
                placeholder="https://..."
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Texto Alternativo</Label>
              <Input 
                value={selectedElementData.content.alt}
                onChange={e => updateElement(selectedElementData.id, { content: { ...selectedElementData.content, alt: e.target.value }})}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Alinhamento</Label>
              <div className="flex gap-2 mt-1.5">
                {[{ value: 'left', icon: AlignLeft }, { value: 'center', icon: AlignCenter }, { value: 'right', icon: AlignRight }].map(({ value, icon: Icon }) => (
                  <Button
                    key={value}
                    variant="outline"
                    size="sm"
                    className={`flex-1 ${selectedElementData.styles.alignment === value ? 'bg-[#374DA4] text-white border-[#374DA4] hover:bg-[#E03E00]' : ''}`}
                    onClick={() => updateElement(selectedElementData.id, { styles: { ...selectedElementData.styles, alignment: value }})}
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Largura</Label>
                <Input 
                  value={selectedElementData.styles.width}
                  onChange={e => updateElement(selectedElementData.id, { styles: { ...selectedElementData.styles, width: e.target.value }})}
                  placeholder="100%"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Largura Máx.</Label>
                <Input 
                  value={selectedElementData.styles.maxWidth}
                  onChange={e => updateElement(selectedElementData.id, { styles: { ...selectedElementData.styles, maxWidth: e.target.value }})}
                  placeholder="100%"
                  className="mt-1.5"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Borda Arredondada</Label>
              <Input 
                value={selectedElementData.styles.borderRadius}
                onChange={e => updateElement(selectedElementData.id, { styles: { ...selectedElementData.styles, borderRadius: e.target.value }})}
                placeholder="8px"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Padding</Label>
              <Input 
                value={selectedElementData.styles.padding || ''}
                onChange={e => updateElement(selectedElementData.id, { styles: { ...selectedElementData.styles, padding: e.target.value }})}
                placeholder="0px"
                className="mt-1.5"
              />
            </div>
          </div>
        )}

        {/* Video styles */}
        {selectedElementData.type === 'video' && (
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Thumbnail do Vídeo</Label>
              <div className="mt-1.5">
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                  <span className="text-sm text-muted-foreground">
                    {uploading ? 'Enviando...' : 'Upload da thumbnail'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">URL do Vídeo (YouTube, Vimeo, etc)</Label>
              <Input 
                value={selectedElementData.content.src}
                onChange={e => updateElement(selectedElementData.id, { content: { ...selectedElementData.content, src: e.target.value }})}
                placeholder="https://youtube.com/watch?v=..."
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Alinhamento</Label>
              <div className="flex gap-2 mt-1.5">
                {[{ value: 'left', icon: AlignLeft }, { value: 'center', icon: AlignCenter }, { value: 'right', icon: AlignRight }].map(({ value, icon: Icon }) => (
                  <Button
                    key={value}
                    variant="outline"
                    size="sm"
                    className={`flex-1 ${selectedElementData.styles.alignment === value ? 'bg-[#374DA4] text-white border-[#374DA4] hover:bg-[#E03E00]' : ''}`}
                    onClick={() => updateElement(selectedElementData.id, { styles: { ...selectedElementData.styles, alignment: value }})}
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Spacer styles */}
        {selectedElementData.type === 'spacer' && (
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Altura</Label>
              <Input 
                value={selectedElementData.styles.height}
                onChange={e => updateElement(selectedElementData.id, { styles: { ...selectedElementData.styles, height: e.target.value }})}
                placeholder="40px"
                className="mt-1.5"
              />
            </div>
          </div>
        )}

        {/* Divider styles */}
        {selectedElementData.type === 'divider' && (
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Cor da Linha</Label>
              <div className="flex gap-2 mt-1.5">
                <Input 
                  type="color"
                  value={selectedElementData.styles.borderColor}
                  onChange={e => updateElement(selectedElementData.id, { styles: { ...selectedElementData.styles, borderColor: e.target.value }})}
                  className="w-12 h-10 p-1 cursor-pointer"
                />
                <Input 
                  value={selectedElementData.styles.borderColor}
                  onChange={e => updateElement(selectedElementData.id, { styles: { ...selectedElementData.styles, borderColor: e.target.value }})}
                  className="flex-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Espessura</Label>
              <Input 
                value={selectedElementData.styles.borderWidth}
                onChange={e => updateElement(selectedElementData.id, { styles: { ...selectedElementData.styles, borderWidth: e.target.value }})}
                placeholder="1px"
                className="mt-1.5"
              />
            </div>
          </div>
        )}

        {/* List styles */}
        {selectedElementData.type === 'list' && (
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Estilo da Lista</Label>
              <div className="flex gap-2 mt-1.5 flex-wrap">
                {[
                  { value: 'bullet', label: '• Lista' },
                  { value: 'check', label: '✓ Check' },
                  { value: 'arrow', label: '→ Seta' },
                  { value: 'star', label: '★ Estrela' },
                  { value: 'dot', label: '• Ponto' },
                ].map(({ value, label }) => (
                  <Button
                    key={value}
                    variant="outline"
                    size="sm"
                    className={`text-xs ${(selectedElementData.content.listIcon || 'bullet') === value ? 'bg-[#374DA4] text-white border-[#374DA4] hover:bg-[#E03E00]' : ''}`}
                    onClick={() => updateElement(selectedElementData.id, { content: { ...selectedElementData.content, listIcon: value }})}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Itens (um por linha)</Label>
              <Textarea 
                value={selectedElementData.content.items.join('\n')}
                onChange={e => updateElement(selectedElementData.id, { content: { ...selectedElementData.content, items: e.target.value.split('\n').filter(Boolean) }})}
                rows={5}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Cor do Texto</Label>
              <div className="flex gap-2 mt-1.5">
                <Input 
                  type="color"
                  value={selectedElementData.styles.color}
                  onChange={e => updateElement(selectedElementData.id, { styles: { ...selectedElementData.styles, color: e.target.value }})}
                  className="w-12 h-10 p-1 cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* Social styles */}
        {selectedElementData.type === 'social' && (
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Facebook className="h-4 w-4 text-[#1877F2]" /> Facebook
              </Label>
              <Input 
                value={selectedElementData.content.facebook}
                onChange={e => updateElement(selectedElementData.id, { content: { ...selectedElementData.content, facebook: e.target.value }})}
                placeholder="https://facebook.com/..."
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Instagram className="h-4 w-4 text-[#E4405F]" /> Instagram
              </Label>
              <Input 
                value={selectedElementData.content.instagram}
                onChange={e => updateElement(selectedElementData.id, { content: { ...selectedElementData.content, instagram: e.target.value }})}
                placeholder="https://instagram.com/..."
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Linkedin className="h-4 w-4 text-[#0A66C2]" /> LinkedIn
              </Label>
              <Input 
                value={selectedElementData.content.linkedin}
                onChange={e => updateElement(selectedElementData.id, { content: { ...selectedElementData.content, linkedin: e.target.value }})}
                placeholder="https://linkedin.com/..."
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-[#25D366]" /> WhatsApp
              </Label>
              <Input 
                value={selectedElementData.content.whatsapp}
                onChange={e => updateElement(selectedElementData.id, { content: { ...selectedElementData.content, whatsapp: e.target.value }})}
                placeholder="https://wa.me/..."
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Twitter className="h-4 w-4 text-[#1DA1F2]" /> Twitter
              </Label>
              <Input 
                value={selectedElementData.content.twitter}
                onChange={e => updateElement(selectedElementData.id, { content: { ...selectedElementData.content, twitter: e.target.value }})}
                placeholder="https://twitter.com/..."
                className="mt-1.5"
              />
            </div>
          </div>
        )}

        {/* Footer styles */}
        {selectedElementData.type === 'footer' && (
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Texto Principal</Label>
              <Textarea 
                value={selectedElementData.content.text}
                onChange={e => updateElement(selectedElementData.id, { content: { ...selectedElementData.content, text: e.target.value }})}
                rows={2}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Endereço</Label>
              <Input 
                value={selectedElementData.content.address}
                onChange={e => updateElement(selectedElementData.id, { content: { ...selectedElementData.content, address: e.target.value }})}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Link de Cancelamento</Label>
              <Input 
                value={selectedElementData.content.unsubscribe}
                onChange={e => updateElement(selectedElementData.id, { content: { ...selectedElementData.content, unsubscribe: e.target.value }})}
                placeholder="https://..."
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Cor de Fundo</Label>
              <div className="flex gap-2 mt-1.5">
                <Input 
                  type="color"
                  value={selectedElementData.styles.backgroundColor}
                  onChange={e => updateElement(selectedElementData.id, { styles: { ...selectedElementData.styles, backgroundColor: e.target.value }})}
                  className="w-12 h-10 p-1 cursor-pointer"
                />
                <Input 
                  value={selectedElementData.styles.backgroundColor}
                  onChange={e => updateElement(selectedElementData.id, { styles: { ...selectedElementData.styles, backgroundColor: e.target.value }})}
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        )}

        {/* Logo Header styles */}
        {selectedElementData.type === 'logo-header' && (
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Logo (URL ou Upload)</Label>
              <div className="mt-1.5">
                <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground">{uploading ? 'Enviando...' : 'Upload logo'}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const url = await uploadFile(file, 'logos');
                    if (url) updateElement(selectedElementData.id, { content: { ...selectedElementData.content, logoSrc: url } });
                    e.target.value = '';
                  }} disabled={uploading} />
                </label>
              </div>
              <Input value={selectedElementData.content.logoSrc} onChange={e => updateElement(selectedElementData.id, { content: { ...selectedElementData.content, logoSrc: e.target.value }})} placeholder="https://..." className="mt-2 text-xs" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Título</Label>
              <Input value={selectedElementData.content.title} onChange={e => updateElement(selectedElementData.id, { content: { ...selectedElementData.content, title: e.target.value }})} className="mt-1.5" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Subtítulo</Label>
              <Input value={selectedElementData.content.subtitle} onChange={e => updateElement(selectedElementData.id, { content: { ...selectedElementData.content, subtitle: e.target.value }})} className="mt-1.5" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Gradiente De</Label>
                <div className="flex gap-2 mt-1.5">
                  <Input type="color" value={selectedElementData.styles.gradientFrom} onChange={e => updateElement(selectedElementData.id, { styles: { ...selectedElementData.styles, gradientFrom: e.target.value }})} className="w-12 h-10 p-1 cursor-pointer" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Gradiente Para</Label>
                <div className="flex gap-2 mt-1.5">
                  <Input type="color" value={selectedElementData.styles.gradientTo} onChange={e => updateElement(selectedElementData.id, { styles: { ...selectedElementData.styles, gradientTo: e.target.value }})} className="w-12 h-10 p-1 cursor-pointer" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Cor do Título</Label>
                <Input type="color" value={selectedElementData.styles.titleColor} onChange={e => updateElement(selectedElementData.id, { styles: { ...selectedElementData.styles, titleColor: e.target.value }})} className="w-full h-10 p-1 cursor-pointer mt-1.5" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Cor Subtítulo</Label>
                <Input type="color" value={selectedElementData.styles.subtitleColor || '#ffffff'} onChange={e => updateElement(selectedElementData.id, { styles: { ...selectedElementData.styles, subtitleColor: e.target.value }})} className="w-full h-10 p-1 cursor-pointer mt-1.5" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Padding</Label>
              <Input value={selectedElementData.styles.padding} onChange={e => updateElement(selectedElementData.id, { styles: { ...selectedElementData.styles, padding: e.target.value }})} placeholder="40px" className="mt-1.5" />
            </div>
          </div>
        )}

        {/* Alert styles */}
        {selectedElementData.type === 'alert' && (
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Texto</Label>
              <Textarea value={selectedElementData.content.text} onChange={e => updateElement(selectedElementData.id, { content: { ...selectedElementData.content, text: e.target.value }})} rows={3} className="mt-1.5" />
              <DynamicVariables onInsertVariable={(variable) => {
                const current = selectedElementData.content.text || '';
                updateElement(selectedElementData.id, { content: { ...selectedElementData.content, text: current + variable }});
              }} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Tipo</Label>
              <div className="flex gap-2 mt-1.5 flex-wrap">
                {[
                  { value: 'info', label: 'Info', bg: '#EFF6FF', border: '#374DA4', text: '#1E40AF' },
                  { value: 'success', label: 'Sucesso', bg: '#F0FDF4', border: '#22C55E', text: '#166534' },
                  { value: 'warning', label: 'Aviso', bg: '#FFFBEB', border: '#F59E0B', text: '#92400E' },
                  { value: 'error', label: 'Erro', bg: '#FEF2F2', border: '#EF4444', text: '#991B1B' },
                ].map(({ value, label, bg, border, text }) => (
                  <Button key={value} variant="outline" size="sm"
                    className={`text-xs ${selectedElementData.content.alertType === value ? 'bg-[#374DA4] text-white border-[#374DA4]' : ''}`}
                    onClick={() => updateElement(selectedElementData.id, { 
                      content: { ...selectedElementData.content, alertType: value },
                      styles: { ...selectedElementData.styles, backgroundColor: bg, borderColor: border, textColor: text }
                    })}
                  >{label}</Button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-[10px] text-muted-foreground">Fundo</Label>
                <Input type="color" value={selectedElementData.styles.backgroundColor} onChange={e => updateElement(selectedElementData.id, { styles: { ...selectedElementData.styles, backgroundColor: e.target.value }})} className="w-full h-10 p-1 cursor-pointer mt-1" />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Borda</Label>
                <Input type="color" value={selectedElementData.styles.borderColor} onChange={e => updateElement(selectedElementData.id, { styles: { ...selectedElementData.styles, borderColor: e.target.value }})} className="w-full h-10 p-1 cursor-pointer mt-1" />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Texto</Label>
                <Input type="color" value={selectedElementData.styles.textColor} onChange={e => updateElement(selectedElementData.id, { styles: { ...selectedElementData.styles, textColor: e.target.value }})} className="w-full h-10 p-1 cursor-pointer mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Borda Arredondada</Label>
              <Input value={selectedElementData.styles.borderRadius} onChange={e => updateElement(selectedElementData.id, { styles: { ...selectedElementData.styles, borderRadius: e.target.value }})} placeholder="8px" className="mt-1.5" />
            </div>
          </div>
        )}

      </div>
    );
  };

  if (loadingTemplate) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#374DA4]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-card shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(fromWizard ? '/dashboard/email' : '/dashboard/email-templates')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <Input 
                placeholder="Nome do Template"
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                className="text-lg font-semibold border-none shadow-none px-0 h-auto focus-visible:ring-0 bg-transparent"
              />
              <Input 
                placeholder="Adicione uma descrição..."
                value={templateDescription}
                onChange={e => setTemplateDescription(e.target.value)}
                className="text-sm text-muted-foreground border-none shadow-none px-0 h-auto focus-visible:ring-0 bg-transparent"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Undo/Redo */}
            <div className="flex items-center border rounded-lg mr-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={undo}
                disabled={historyIndex <= 0}
                className="rounded-r-none"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
                className="rounded-l-none"
              >
                <Redo2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Preview Toggle */}
            <div className="flex items-center border rounded-lg p-1">
              <Button
                variant={previewMode === 'desktop' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setPreviewMode('desktop')}
              >
                <Monitor className="h-4 w-4" />
              </Button>
              <Button
                variant={previewMode === 'mobile' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setPreviewMode('mobile')}
              >
                <Smartphone className="h-4 w-4" />
              </Button>
            </div>
            
            <Button onClick={saveTemplate} disabled={saving} className="gap-2 ml-2 bg-[#374DA4] hover:bg-[#E03E00] text-white">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {fromWizard ? 'Salvar e Usar' : editingTemplateId ? 'Atualizar Template' : 'Salvar Template'}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Elements & Properties */}
        <div className="w-80 border-r bg-card flex flex-col">
          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="flex-1 flex flex-col">
            <TabsList className="w-full justify-start rounded-none border-b h-12 px-2 gap-1">
              <TabsTrigger value="elements" className="gap-1.5 text-xs">
                <Plus className="h-4 w-4" />
                Adicionar
              </TabsTrigger>
              <TabsTrigger value="style" className="gap-1.5 text-xs">
                <Settings2 className="h-4 w-4" />
                Estilo
              </TabsTrigger>
              <TabsTrigger value="global" className="gap-1.5 text-xs">
                <Palette className="h-4 w-4" />
                Global
              </TabsTrigger>
            </TabsList>

            <TabsContent value="elements" className="flex-1 p-4 mt-0 overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Conteúdo</p>
                  <div className="grid grid-cols-2 gap-2">
                    {ELEMENT_TYPES.filter(e => e.category === 'content').map(({ type, label, icon: Icon }) => (
                      <Button
                        key={type}
                        variant="outline"
                        className="h-auto py-3 flex-col gap-1.5 hover:border-[#374DA4] hover:bg-[#374DA4]/5"
                        onClick={() => addElement(type)}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="text-xs">{label}</span>
                      </Button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Mídia</p>
                  <div className="grid grid-cols-2 gap-2">
                    {ELEMENT_TYPES.filter(e => e.category === 'media').map(({ type, label, icon: Icon }) => (
                      <Button
                        key={type}
                        variant="outline"
                        className="h-auto py-3 flex-col gap-1.5 hover:border-[#374DA4] hover:bg-[#374DA4]/5"
                        onClick={() => addElement(type)}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="text-xs">{label}</span>
                      </Button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Layout</p>
                  <div className="grid grid-cols-2 gap-2">
                    {ELEMENT_TYPES.filter(e => e.category === 'layout').map(({ type, label, icon: Icon }) => (
                      <Button
                        key={type}
                        variant="outline"
                        className="h-auto py-3 flex-col gap-1.5 hover:border-[#374DA4] hover:bg-[#374DA4]/5"
                        onClick={() => addElement(type)}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="text-xs">{label}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="style" className="flex-1 p-4 mt-0 overflow-y-auto">
              {renderStyleEditor()}
            </TabsContent>

            <TabsContent value="global" className="flex-1 p-4 mt-0 overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Cor de Fundo Externo</Label>
                  <div className="flex gap-2 mt-1.5">
                    <Input 
                      type="color"
                      value={globalStyles.backgroundColor}
                      onChange={e => setGlobalStyles({ ...globalStyles, backgroundColor: e.target.value })}
                      className="w-12 h-10 p-1 cursor-pointer"
                    />
                    <Input 
                      value={globalStyles.backgroundColor}
                      onChange={e => setGlobalStyles({ ...globalStyles, backgroundColor: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Cor de Fundo do Email</Label>
                  <div className="flex gap-2 mt-1.5">
                    <Input 
                      type="color"
                      value={globalStyles.contentBackgroundColor}
                      onChange={e => setGlobalStyles({ ...globalStyles, contentBackgroundColor: e.target.value })}
                      className="w-12 h-10 p-1 cursor-pointer"
                    />
                    <Input 
                      value={globalStyles.contentBackgroundColor}
                      onChange={e => setGlobalStyles({ ...globalStyles, contentBackgroundColor: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Fundo branco recomendado para melhor legibilidade</p>
                </div>

                {/* Background Image */}
                <div className="pt-2 border-t">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Imagem de Fundo</Label>
                  <div className="mt-1.5">
                    <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed rounded-lg cursor-pointer hover:bg-[#374DA4]/5 hover:border-[#374DA4]/40 transition-colors">
                      <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                      <span className="text-xs text-muted-foreground">
                        {uploading ? 'Enviando...' : 'Upload imagem de fundo'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const url = await uploadFile(file, 'logos');
                          if (url) {
                            setGlobalStyles({ ...globalStyles, backgroundImage: url });
                            toast({ title: "Imagem de fundo adicionada!" });
                          }
                          e.target.value = '';
                        }}
                        disabled={uploading}
                      />
                    </label>
                  </div>
                  <Input 
                    value={globalStyles.backgroundImage}
                    onChange={e => setGlobalStyles({ ...globalStyles, backgroundImage: e.target.value })}
                    placeholder="Ou cole uma URL..."
                    className="mt-2 text-xs"
                  />
                  {globalStyles.backgroundImage && (
                    <div className="mt-2 space-y-2">
                      <div className="relative h-20 rounded-lg overflow-hidden border">
                        <img src={globalStyles.backgroundImage} alt="Background" className="w-full h-full object-cover" />
                        <button
                          onClick={() => setGlobalStyles({ ...globalStyles, backgroundImage: '' })}
                          className="absolute top-1 right-1 p-1 bg-black/60 rounded-full hover:bg-black/80"
                        >
                          <X className="h-3 w-3 text-white" />
                        </button>
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Tamanho</Label>
                        <select
                          value={globalStyles.backgroundSize}
                          onChange={e => setGlobalStyles({ ...globalStyles, backgroundSize: e.target.value })}
                          className="w-full mt-1 h-8 px-2 text-xs rounded-md border border-input bg-background"
                        >
                          <option value="cover">Cobrir (cover)</option>
                          <option value="contain">Conter (contain)</option>
                          <option value="100% 100%">Esticar</option>
                          <option value="auto">Original</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Largura Máxima</Label>
                  <Input 
                    value={globalStyles.maxWidth}
                    onChange={e => setGlobalStyles({ ...globalStyles, maxWidth: e.target.value })}
                    placeholder="600px"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Padding Interno</Label>
                  <Input 
                    value={globalStyles.padding}
                    onChange={e => setGlobalStyles({ ...globalStyles, padding: e.target.value })}
                    placeholder="20px"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Fonte</Label>
                  <select
                    value={globalStyles.fontFamily}
                    onChange={e => setGlobalStyles({ ...globalStyles, fontFamily: e.target.value })}
                    className="w-full mt-1.5 h-10 px-3 rounded-md border border-input bg-background"
                  >
                    <option value="Arial, sans-serif">Arial</option>
                    <option value="'Helvetica Neue', Helvetica, sans-serif">Helvetica</option>
                    <option value="Georgia, serif">Georgia</option>
                    <option value="'Times New Roman', Times, serif">Times New Roman</option>
                    <option value="Verdana, sans-serif">Verdana</option>
                    <option value="'Trebuchet MS', sans-serif">Trebuchet MS</option>
                  </select>
                </div>

                <div className="pt-4 border-t">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">HTML Gerado</Label>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="w-full mt-2 gap-2 hover:border-[#374DA4] hover:text-[#374DA4]"
                    onClick={() => {
                      navigator.clipboard.writeText(generateHTML());
                      toast({ title: "HTML copiado!" });
                    }}
                  >
                    <Copy className="h-4 w-4" />
                    Copiar HTML
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Canvas */}
        <div 
          className={`flex-1 p-8 overflow-y-auto transition-colors ${isDraggingFile ? 'ring-2 ring-[#374DA4] ring-inset' : ''}`}
          style={{ backgroundColor: isDraggingFile ? undefined : '#ffffff' }}
          onDrop={handleFileDrop}
          onDragOver={handleFileDragOver}
          onDragLeave={handleFileDragLeave}
        >
          {isDraggingFile && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#374DA4]/10 z-10 pointer-events-none">
              <div className="bg-background border-2 border-dashed border-[#374DA4] rounded-xl p-8 text-center">
                <Upload className="h-12 w-12 mx-auto mb-3 text-[#374DA4]" />
                <p className="text-lg font-medium">Solte a imagem aqui</p>
                <p className="text-sm text-muted-foreground">A imagem será adicionada ao seu email</p>
              </div>
            </div>
          )}
          
          <div 
            className={`mx-auto shadow-xl rounded-lg transition-all overflow-hidden ${
              previewMode === 'mobile' ? 'max-w-[375px]' : 'max-w-[600px]'
            }`}
            style={{ backgroundColor: '#ffffff' }}
          >
            <div style={{ padding: globalStyles.padding, minHeight: '500px', fontFamily: globalStyles.fontFamily, backgroundColor: '#ffffff', color: '#000000' }}>
              {rawHtmlContent ? (
                <div>
                  <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800 font-medium">📝 Template HTML importado</p>
                    <p className="text-xs text-amber-600 mt-1">Este template usa HTML personalizado. Edite o código abaixo ou salve as alterações de nome/descrição.</p>
                  </div>
                  <Textarea
                    value={rawHtmlContent}
                    onChange={(e) => setRawHtmlContent(e.target.value)}
                    rows={20}
                    className="font-mono text-xs w-full"
                    placeholder="HTML do template..."
                  />
                  <div className="mt-4 border rounded-lg overflow-hidden">
                    <p className="text-xs font-medium p-2 bg-muted">Preview:</p>
                    <iframe
                      srcDoc={rawHtmlContent}
                      className="w-full border-0"
                      style={{ height: '500px' }}
                      title="Template Preview"
                    />
                  </div>
                </div>
              ) : elements.length === 0 ? (
                <div className="h-[400px] flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-lg bg-white">
                  <Palette className="h-12 w-12 mb-4 text-gray-300" />
                  <p className="text-lg font-medium text-gray-600">Comece a construir seu email</p>
                  <p className="text-sm mb-4 text-gray-400">Adicione elementos ou arraste uma imagem</p>
                  <Button variant="outline" onClick={() => addElement('header')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Título
                  </Button>
                </div>
              ) : (
                <DndContext
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={elements.map(e => e.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-1">
                      {elements.map(element => (
                        <SortableElement
                          key={element.id}
                          element={element}
                          isSelected={selectedElement === element.id}
                          onSelect={() => {
                            setSelectedElement(element.id);
                            setActiveTab('style');
                          }}
                          onDelete={() => deleteElement(element.id)}
                          onDuplicate={() => duplicateElement(element.id)}
                          onUpdateText={updateElement}
                          globalStyles={globalStyles}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailTemplateBuilder;
