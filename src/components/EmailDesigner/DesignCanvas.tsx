
import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { DesignElement } from './EmailDesigner';

interface DesignCanvasProps {
  elements: DesignElement[];
  selectedElement: DesignElement | null;
  onSelectElement: (element: DesignElement | null) => void;
  onUpdateElement: (elementId: string, styles: Partial<DesignElement['styles']>) => void;
  onDeleteElement: (elementId: string) => void;
}

export const DesignCanvas: React.FC<DesignCanvasProps> = ({
  elements,
  selectedElement,
  onSelectElement,
  onDeleteElement,
}) => {
  const { setNodeRef } = useDroppable({
    id: 'canvas',
  });

  const renderElement = (element: DesignElement) => {
    const isSelected = selectedElement?.id === element.id;
    const baseStyles = `
      relative cursor-pointer transition-all
      ${isSelected ? 'ring-2 ring-[#374DA4] ring-offset-2' : 'hover:ring-1 hover:ring-gray-300'}
    `;

    const elementStyles = Object.entries(element.styles)
      .map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`)
      .join('; ');

    const handleClick = () => {
      onSelectElement(element);
    };

    const content = (() => {
      switch (element.type) {
        case 'text':
          return (
            <div
              style={{ ...element.styles }}
              className={baseStyles}
              onClick={handleClick}
            >
              {element.content || 'Texto'}
            </div>
          );
        case 'button':
          return (
            <button
              style={{ ...element.styles }}
              className={`${baseStyles} border-none outline-none`}
              onClick={handleClick}
            >
              {element.content || 'Botão'}
            </button>
          );
        case 'image':
          return (
            <img
              src={element.content || 'https://via.placeholder.com/200x150?text=Imagem'}
              alt="Design element"
              style={{ ...element.styles }}
              className={baseStyles}
              onClick={handleClick}
            />
          );
        case 'divider':
          return (
            <hr
              style={{ ...element.styles, border: 'none' }}
              className={baseStyles}
              onClick={handleClick}
            />
          );
        case 'spacer':
          return (
            <div
              style={{ ...element.styles, backgroundColor: 'transparent', border: '2px dashed #e0e0e0' }}
              className={`${baseStyles} flex items-center justify-center text-gray-400 text-sm`}
              onClick={handleClick}
            >
              Espaçador
            </div>
          );
        default:
          return null;
      }
    })();

    return (
      <div key={element.id} className="relative group">
        {content}
        {isSelected && (
          <div className="absolute -top-8 -right-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteElement(element.id);
              }}
              className="h-6 w-6 p-0"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex justify-center">
      <Card className="w-full max-w-2xl bg-white shadow-lg">
        <div
          ref={setNodeRef}
          id="canvas"
          className="min-h-[600px] p-6 space-y-4"
          onClick={() => onSelectElement(null)}
        >
          {elements.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-300 rounded-lg">
              <div className="text-center">
                <p className="text-lg font-medium">Canvas Vazio</p>
                <p className="text-sm">Arraste elementos da paleta para começar</p>
              </div>
            </div>
          ) : (
            elements.map(renderElement)
          )}
        </div>
      </Card>
    </div>
  );
};
