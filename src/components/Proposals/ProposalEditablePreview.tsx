
import { useState } from 'react';
import { format } from 'date-fns';
import { PROPOSAL_TEMPLATES } from './ProposalThemePanel';
import {
  Bold, AlignLeft, AlignCenter, AlignRight,
  Type, Square, Trash2, Plus, GripVertical, Image as ImageIcon
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { HexColorPicker } from 'react-colorful';
import { Input } from '@/components/ui/input';

interface ProposalItem {
  name: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface EditableSection {
  id: string;
  type: 'header' | 'title' | 'client' | 'items' | 'totals' | 'notes' | 'terms' | 'footer' | 'custom-text' | 'custom-divider' | 'custom-image';
  visible: boolean;
  styles: {
    borderRadius?: number;
    padding?: number;
    marginBottom?: number;
    backgroundColor?: string;
    textColor?: string;
    fontSize?: number;
    fontWeight?: string;
    textAlign?: 'left' | 'center' | 'right';
  };
  customContent?: string;
}

interface PreviewProps {
  companyName: string;
  title: string;
  client: { name: string; company_name?: string; email?: string; phone?: string } | null;
  items: ProposalItem[];
  subtotal: number;
  discountAmount: number;
  total: number;
  notes: string;
  customTerms: string;
  validUntil: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  showHeader: boolean;
  showFooter: boolean;
  logoUrl?: string;
  headerText?: string;
  footerText?: string;
  templateId?: string;
  onTitleChange?: (title: string) => void;
  onNotesChange?: (notes: string) => void;
  onTermsChange?: (terms: string) => void;
  onItemChange?: (index: number, field: string, value: any) => void;
  onHeaderTextChange?: (text: string) => void;
  onFooterTextChange?: (text: string) => void;
}

const DEFAULT_SECTIONS: EditableSection[] = [
  { id: 'header', type: 'header', visible: true, styles: { borderRadius: 0, padding: 20 } },
  { id: 'title', type: 'title', visible: true, styles: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 } },
  { id: 'client', type: 'client', visible: true, styles: { borderRadius: 8, padding: 12, marginBottom: 8 } },
  { id: 'items', type: 'items', visible: true, styles: { borderRadius: 0, marginBottom: 8 } },
  { id: 'totals', type: 'totals', visible: true, styles: { marginBottom: 8 } },
  { id: 'notes', type: 'notes', visible: true, styles: { marginBottom: 8 } },
  { id: 'terms', type: 'terms', visible: true, styles: { marginBottom: 8 } },
  { id: 'footer', type: 'footer', visible: true, styles: { borderRadius: 0, padding: 12 } },
];

export default function ProposalEditablePreview({
  companyName, title, client, items, subtotal, discountAmount, total,
  notes, customTerms, validUntil, primaryColor, secondaryColor, fontFamily,
  showHeader, showFooter, logoUrl, headerText, footerText, templateId,
  onTitleChange, onNotesChange, onTermsChange, onItemChange,
  onHeaderTextChange, onFooterTextChange,
}: PreviewProps) {
  const [sections, setSections] = useState<EditableSection[]>(DEFAULT_SECTIONS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const fmtBRL = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  const today = format(new Date(), 'dd/MM/yyyy');
  const template = PROPOSAL_TEMPLATES.find(t => t.id === templateId) || PROPOSAL_TEMPLATES.find(t => t.id === 'ellosuit')!;
  const tStyle = template.preview;
  const selectedSection = sections.find(s => s.id === selectedId);

  const updateSectionStyle = (id: string, patch: Partial<EditableSection['styles']>) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, styles: { ...s.styles, ...patch } } : s));
  };

  const moveSection = (fromIdx: number, toIdx: number) => {
    setSections(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      return arr;
    });
  };

  const addCustomSection = (type: 'custom-text' | 'custom-divider' | 'custom-image') => {
    const newSection: EditableSection = {
      id: `custom-${Date.now()}`,
      type,
      visible: true,
      styles: { borderRadius: 0, padding: type === 'custom-image' ? 0 : 8, marginBottom: 8 },
      customContent: type === 'custom-text' ? 'Clique para editar...' : type === 'custom-image' ? '' : '',
    };
    // Insert before footer
    setSections(prev => {
      const footerIdx = prev.findIndex(s => s.type === 'footer');
      if (footerIdx >= 0) {
        const arr = [...prev];
        arr.splice(footerIdx, 0, newSection);
        return arr;
      }
      return [...prev, newSection];
    });
  };

  const removeSection = (id: string) => {
    setSections(prev => prev.filter(s => s.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleDragStart = (idx: number) => setDragIndex(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === idx) return;
    moveSection(dragIndex, idx);
    setDragIndex(idx);
  };
  const handleDragEnd = () => setDragIndex(null);

  // Separate footer from content sections
  const contentSections = sections.filter(s => s.type !== 'footer');
  const footerSection = sections.find(s => s.type === 'footer');

  const renderSection = (section: EditableSection, index: number) => {
    if (!section.visible) return null;
    const isSelected = selectedId === section.id;
    const sectionStyle: React.CSSProperties = {
      borderRadius: section.styles.borderRadius,
      marginBottom: section.styles.marginBottom,
      transition: 'box-shadow 0.15s',
    };

    const wrapperClass = `relative group cursor-pointer ${
      isSelected ? 'ring-2 ring-[#374DA4] ring-offset-1' : 'hover:ring-1 hover:ring-[#B3BFF0]'
    }`;

    const dragProps = {
      draggable: true,
      onDragStart: () => handleDragStart(index),
      onDragOver: (e: React.DragEvent) => handleDragOver(e, index),
      onDragEnd: handleDragEnd,
    };

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedId(section.id);
    };

    switch (section.type) {
      case 'header': {
        if (!showHeader) return null;
        const isGradient = tStyle.headerStyle === 'gradient';
        const isSolid = tStyle.headerStyle === 'solid';
        const isLine = tStyle.headerStyle === 'line';
        const isSoft = tStyle.headerStyle === 'soft';
        const isNone = tStyle.headerStyle === 'none';
        const lightText = isGradient || isSolid;

        if (isNone) {
          return (
            <div key={section.id} className={wrapperClass} style={sectionStyle} onClick={handleClick} {...dragProps}>
              <DragHandle />
              <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: primaryColor + '30' }}>
                <div className="flex items-center gap-3">
                  {logoUrl && <img src={logoUrl} alt="Logo" className="h-8 object-contain" />}
                  <div className="text-sm font-semibold" style={{ color: primaryColor }}>{companyName || 'Sua Empresa'}</div>
                </div>
                <div className="text-right text-[10px] text-gray-400 space-y-0.5">
                  <div>{today}</div>
                  {validUntil && <div>Válida até: {format(new Date(validUntil + 'T12:00:00'), 'dd/MM/yyyy')}</div>}
                </div>
              </div>
            </div>
          );
        }

        const headerBg = isGradient
          ? `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`
          : isSoft ? primaryColor + '10'
          : isLine ? 'transparent'
          : primaryColor;

        return (
          <div key={section.id}>
            {isLine && <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})` }} />}
            <div className={wrapperClass}
              style={{ ...sectionStyle, background: headerBg, padding: section.styles.padding }}
              onClick={handleClick} {...dragProps}>
              <DragHandle light={lightText} />
              <div className="flex items-center justify-between">
                <div>
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="h-10 object-contain mb-1" />
                  ) : (
                    <div className={`font-bold text-lg tracking-wide ${lightText ? 'text-white' : ''}`}
                      style={!lightText ? { color: primaryColor } : undefined}>
                      {companyName || 'Sua Empresa'}
                    </div>
                  )}
                  <div className={`text-[10px] mt-0.5 uppercase tracking-widest outline-none ${lightText ? 'text-white/70' : ''}`}
                    style={!lightText ? { color: primaryColor + '90' } : undefined}
                    contentEditable suppressContentEditableWarning
                    onBlur={e => onHeaderTextChange?.(e.currentTarget.textContent || '')}>
                    {headerText || 'Proposta Comercial'}
                  </div>
                </div>
                <div className={`text-right text-[10px] space-y-0.5 ${lightText ? 'text-white/80' : 'text-gray-400'}`}>
                  <div>Data: {today}</div>
                  {validUntil && <div>Válida até: {format(new Date(validUntil + 'T12:00:00'), 'dd/MM/yyyy')}</div>}
                </div>
              </div>
            </div>
          </div>
        );
      }

      case 'title':
        return (
          <div key={section.id} className={wrapperClass} style={sectionStyle} onClick={handleClick} {...dragProps}>
            <DragHandle />
            <h2 className="font-bold outline-none"
              style={{ color: primaryColor, fontSize: section.styles.fontSize, fontWeight: section.styles.fontWeight, textAlign: section.styles.textAlign }}
              contentEditable suppressContentEditableWarning
              onBlur={e => onTitleChange?.(e.currentTarget.textContent || '')}>
              {title || 'Título da Proposta'}
            </h2>
          </div>
        );

      case 'client':
        if (!client) return null;
        return (
          <div key={section.id} className={wrapperClass} onClick={handleClick} {...dragProps}
            style={{ ...sectionStyle, backgroundColor: secondaryColor + '12', padding: section.styles.padding, borderRadius: section.styles.borderRadius }}>
            <DragHandle />
            <div className="text-[9px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: primaryColor }}>Cliente</div>
            <div className="text-gray-800 font-medium text-xs">{client.name}</div>
            {client.company_name && <div className="text-gray-500 text-[10px]">{client.company_name}</div>}
            <div className="flex gap-4 mt-1 text-gray-500 text-[10px]">
              {client.email && <span>{client.email}</span>}
              {client.phone && <span>{client.phone}</span>}
            </div>
          </div>
        );

      case 'items':
        if (items.length === 0) return null;
        return (
          <div key={section.id} className={wrapperClass} style={sectionStyle} onClick={handleClick} {...dragProps}>
            <DragHandle />
            <div className="text-[9px] uppercase tracking-wider font-semibold mb-2" style={{ color: primaryColor }}>Itens</div>
            <table className="w-full border-collapse">
              <thead>
                <tr style={{ backgroundColor: primaryColor + '08' }}>
                  <th className="text-left text-[9px] font-semibold px-2 py-1.5 text-gray-500 uppercase">Item</th>
                  <th className="text-center text-[9px] font-semibold px-2 py-1.5 text-gray-500 uppercase w-12">Qtd</th>
                  <th className="text-right text-[9px] font-semibold px-2 py-1.5 text-gray-500 uppercase w-20">Valor Un.</th>
                  <th className="text-right text-[9px] font-semibold px-2 py-1.5 text-gray-500 uppercase w-20">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="px-2 py-2">
                      <div className="font-medium text-gray-800 text-[11px] outline-none"
                        contentEditable suppressContentEditableWarning
                        onBlur={e => onItemChange?.(i, 'name', e.currentTarget.textContent || '')}>
                        {it.name || 'Item sem nome'}
                      </div>
                      {it.description && <div className="text-gray-400 text-[9px] mt-0.5">{it.description}</div>}
                    </td>
                    <td className="text-center text-gray-600 px-2 py-2 text-[11px]">{it.quantity}</td>
                    <td className="text-right text-gray-600 px-2 py-2 text-[11px]">{fmtBRL(it.unit_price)}</td>
                    <td className="text-right font-medium text-gray-800 px-2 py-2 text-[11px]">{fmtBRL(it.total_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case 'totals':
        if (items.length === 0) return null;
        return (
          <div key={section.id} className={wrapperClass} style={sectionStyle} onClick={handleClick} {...dragProps}>
            <DragHandle />
            <div className="border-t border-gray-200 pt-3 space-y-1">
              <div className="flex justify-between text-gray-500 text-[10px] px-2">
                <span>Subtotal</span><span>{fmtBRL(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-red-500 text-[10px] px-2">
                  <span>Desconto</span><span>- {fmtBRL(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm px-2 pt-1" style={{ color: primaryColor }}>
                <span>TOTAL</span><span>{fmtBRL(total)}</span>
              </div>
            </div>
          </div>
        );

      case 'notes':
        if (!notes) return null;
        return (
          <div key={section.id} className={wrapperClass} style={sectionStyle} onClick={handleClick} {...dragProps}>
            <DragHandle />
            <div className="text-[9px] uppercase tracking-wider font-semibold mb-1" style={{ color: primaryColor }}>Observações</div>
            <p className="text-gray-600 text-[10px] whitespace-pre-line outline-none"
              contentEditable suppressContentEditableWarning
              onBlur={e => onNotesChange?.(e.currentTarget.textContent || '')}>
              {notes}
            </p>
          </div>
        );

      case 'terms':
        if (!customTerms) return null;
        return (
          <div key={section.id} className={wrapperClass} style={sectionStyle} onClick={handleClick} {...dragProps}>
            <DragHandle />
            <div className="text-[9px] uppercase tracking-wider font-semibold mb-1" style={{ color: primaryColor }}>Termos e Condições</div>
            <p className="text-gray-500 text-[10px] whitespace-pre-line outline-none"
              contentEditable suppressContentEditableWarning
              onBlur={e => onTermsChange?.(e.currentTarget.textContent || '')}>
              {customTerms}
            </p>
          </div>
        );

      case 'custom-text':
        return (
          <div key={section.id} className={wrapperClass} style={{ ...sectionStyle, padding: section.styles.padding, borderRadius: section.styles.borderRadius, backgroundColor: section.styles.backgroundColor }}
            onClick={handleClick} {...dragProps}>
            <DragHandle />
            <p className="outline-none"
              style={{ fontSize: section.styles.fontSize || 11, fontWeight: section.styles.fontWeight, textAlign: section.styles.textAlign, color: section.styles.textColor || '#374151' }}
              contentEditable suppressContentEditableWarning
              onBlur={e => setSections(prev => prev.map(s => s.id === section.id ? { ...s, customContent: e.currentTarget.textContent || '' } : s))}>
              {section.customContent}
            </p>
          </div>
        );

      case 'custom-divider':
        return (
          <div key={section.id} className={wrapperClass} style={sectionStyle} onClick={handleClick} {...dragProps}>
            <DragHandle />
            <hr className="border-gray-200" style={{ borderRadius: section.styles.borderRadius }} />
          </div>
        );

      case 'custom-image':
        return (
          <div key={section.id} className={wrapperClass} style={{ ...sectionStyle, borderRadius: section.styles.borderRadius }}
            onClick={handleClick} {...dragProps}>
            <DragHandle />
            {section.customContent ? (
              <img src={section.customContent} alt="" className="w-full object-contain" style={{ borderRadius: section.styles.borderRadius }} />
            ) : (
              <div className="flex flex-col items-center justify-center py-6 bg-gray-50 border-2 border-dashed border-gray-200 text-gray-400 text-[10px]"
                style={{ borderRadius: section.styles.borderRadius || 4 }}>
                <ImageIcon className="h-5 w-5 mb-1" />
                <span>Cole a URL da imagem na toolbar</span>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="relative" style={{ fontFamily }}>
      {/* Floating Toolbar */}
      {selectedSection && (
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-3 py-2 flex flex-wrap items-center gap-2 text-[10px]"
          onClick={e => e.stopPropagation()}>
          <span className="text-gray-400 font-semibold uppercase tracking-wider text-[9px] mr-1">{selectedSection.type.replace('custom-', '')}</span>
          
          <div className="h-4 w-px bg-gray-200" />

          {/* Border Radius */}
          <div className="flex items-center gap-1.5">
            <Square className="h-3 w-3 text-gray-400" />
            <Slider value={[selectedSection.styles.borderRadius || 0]} onValueChange={v => updateSectionStyle(selectedSection.id, { borderRadius: v[0] })} max={24} step={1} className="w-16" />
            <span className="text-gray-500 w-5 text-right">{selectedSection.styles.borderRadius || 0}</span>
          </div>

          <div className="h-4 w-px bg-gray-200" />

          {/* Font Size */}
          {['title', 'custom-text'].includes(selectedSection.type) && (
            <>
              <div className="flex items-center gap-1.5">
                <Type className="h-3 w-3 text-gray-400" />
                <Slider value={[selectedSection.styles.fontSize || 14]} onValueChange={v => updateSectionStyle(selectedSection.id, { fontSize: v[0] })} min={8} max={32} step={1} className="w-16" />
                <span className="text-gray-500 w-5 text-right">{selectedSection.styles.fontSize || 14}</span>
              </div>
              <div className="h-4 w-px bg-gray-200" />
            </>
          )}

          {/* Text Align */}
          {['title', 'custom-text', 'notes', 'terms'].includes(selectedSection.type) && (
            <>
              <div className="flex items-center gap-0.5">
                {(['left', 'center', 'right'] as const).map(align => (
                  <button key={align} onClick={() => updateSectionStyle(selectedSection.id, { textAlign: align })}
                    className={`p-1 rounded ${selectedSection.styles.textAlign === align ? 'bg-[#DFE4FB] text-[#2F428D]' : 'text-gray-400 hover:bg-gray-100'}`}>
                    {align === 'left' && <AlignLeft className="h-3 w-3" />}
                    {align === 'center' && <AlignCenter className="h-3 w-3" />}
                    {align === 'right' && <AlignRight className="h-3 w-3" />}
                  </button>
                ))}
              </div>
              <div className="h-4 w-px bg-gray-200" />
            </>
          )}

          {/* Bold */}
          {['title', 'custom-text'].includes(selectedSection.type) && (
            <button onClick={() => updateSectionStyle(selectedSection.id, { fontWeight: selectedSection.styles.fontWeight === 'bold' ? 'normal' : 'bold' })}
              className={`p-1 rounded ${selectedSection.styles.fontWeight === 'bold' ? 'bg-[#DFE4FB] text-[#2F428D]' : 'text-gray-400 hover:bg-gray-100'}`}>
              <Bold className="h-3 w-3" />
            </button>
          )}

          {/* Text Color */}
          {['custom-text', 'footer'].includes(selectedSection.type) && (
            <Popover>
              <PopoverTrigger asChild>
                <button className="w-4 h-4 rounded border border-gray-300" style={{ backgroundColor: selectedSection.styles.textColor || '#333' }} />
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="start">
                <HexColorPicker color={selectedSection.styles.textColor || '#333'} onChange={c => updateSectionStyle(selectedSection.id, { textColor: c })} />
              </PopoverContent>
            </Popover>
          )}

          {/* Background Color */}
          {['client', 'custom-text', 'header', 'footer'].includes(selectedSection.type) && (
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50">
                  <div className="w-3 h-3 rounded border" style={{ backgroundColor: selectedSection.styles.backgroundColor || 'transparent' }} />
                  <span>Fundo</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="start">
                <HexColorPicker color={selectedSection.styles.backgroundColor || '#ffffff'} onChange={c => updateSectionStyle(selectedSection.id, { backgroundColor: c })} />
              </PopoverContent>
            </Popover>
          )}

          {/* Image URL input */}
          {selectedSection.type === 'custom-image' && (
            <Input
              placeholder="URL da imagem..."
              className="h-6 text-[10px] rounded w-40"
              defaultValue={selectedSection.customContent || ''}
              onBlur={e => setSections(prev => prev.map(s => s.id === selectedSection.id ? { ...s, customContent: e.target.value } : s))}
            />
          )}

          <div className="flex-1" />

          {/* Delete custom sections */}
          {selectedSection.type.startsWith('custom-') && (
            <button onClick={() => removeSection(selectedSection.id)} className="p-1 rounded text-red-400 hover:bg-red-50">
              <Trash2 className="h-3 w-3" />
            </button>
          )}

          <button onClick={() => setSelectedId(null)} className="px-2 py-0.5 rounded bg-gray-100 text-gray-500 hover:bg-gray-200 text-[9px]">✕</button>
        </div>
      )}

      {/* Document - flex column for footer at bottom */}
      <div className="bg-white text-[11px] leading-relaxed flex flex-col" style={{ width: 595, minHeight: 842 }}
        onClick={() => setSelectedId(null)}>
        
        {/* Content area */}
        <div className="px-8 py-6 space-y-2 flex-1">
          {contentSections.map((s, i) => renderSection(s, i))}
        </div>

        {/* Footer - always at bottom */}
        {footerSection && showFooter && (() => {
          const isGradient = tStyle.headerStyle === 'gradient';
          const isSolid = tStyle.headerStyle === 'solid';
          const lightFooter = isGradient || isSolid;
          const footerBg = isGradient
            ? `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`
            : tStyle.headerStyle === 'soft' ? primaryColor + '08'
            : tStyle.headerStyle === 'line' || tStyle.headerStyle === 'none' ? 'transparent'
            : primaryColor;

          return (
            <div
              className={`relative group cursor-pointer text-center text-[8px] ${lightFooter ? 'text-white' : 'text-gray-400'} ${selectedId === footerSection.id ? 'ring-2 ring-[#374DA4] ring-offset-1' : 'hover:ring-1 hover:ring-[#B3BFF0]'}`}
              onClick={e => { e.stopPropagation(); setSelectedId(footerSection.id); }}
              style={{
                background: footerBg,
                padding: footerSection.styles.padding,
                borderRadius: footerSection.styles.borderRadius,
                borderTop: !lightFooter ? `1px solid ${primaryColor}20` : 'none',
              }}>
              <DragHandle light={lightFooter} />
              <span className="outline-none" contentEditable suppressContentEditableWarning
                onBlur={e => onFooterTextChange?.(e.currentTarget.textContent || '')}>
                {footerText || `Gerado por Ellosuit • ${companyName}`}
              </span>
            </div>
          );
        })()}
      </div>

      {/* Add Element Bar */}
      <div className="flex items-center justify-center gap-2 py-3 border-t border-dashed border-gray-200 bg-gray-50/50">
        <button onClick={() => addCustomSection('custom-text')}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-[10px] text-gray-600 hover:border-[#879CE0] hover:text-[#2F428D] transition-colors">
          <Plus className="h-3 w-3" /> Texto
        </button>
        <button onClick={() => addCustomSection('custom-divider')}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-[10px] text-gray-600 hover:border-[#879CE0] hover:text-[#2F428D] transition-colors">
          <Plus className="h-3 w-3" /> Divisor
        </button>
        <button onClick={() => addCustomSection('custom-image')}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-[10px] text-gray-600 hover:border-[#879CE0] hover:text-[#2F428D] transition-colors">
          <ImageIcon className="h-3 w-3" /> Imagem
        </button>
      </div>
    </div>
  );
}

function DragHandle({ light }: { light?: boolean }) {
  return (
    <div className={`absolute -left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing ${light ? 'text-white/50' : 'text-gray-300'}`}>
      <GripVertical className="h-3.5 w-3.5" />
    </div>
  );
}
