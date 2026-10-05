
import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Type, Image, Mouse, Minus, Space } from 'lucide-react';

const elements = [
  { id: 'text', label: 'Texto', icon: Type, type: 'text' },
  { id: 'image', label: 'Imagem', icon: Image, type: 'image' },
  { id: 'button', label: 'Botão', icon: Mouse, type: 'button' },
  { id: 'divider', label: 'Divisor', icon: Minus, type: 'divider' },
  { id: 'spacer', label: 'Espaçador', icon: Space, type: 'spacer' },
];

interface DraggableElementProps {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  type: string;
}

const DraggableElement: React.FC<DraggableElementProps> = ({ id, label, icon: Icon, type }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: {
      type: 'palette-item',
      elementType: type,
    },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        flex items-center space-x-3 p-3 border rounded-lg cursor-grab
        hover:bg-[#F0F2FE] hover:border-[#879CE0] transition-colors
        ${isDragging ? 'opacity-50' : ''}
      `}
    >
      <Icon className="h-5 w-5 text-gray-600" />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
};

export const ElementsPalette: React.FC = () => {
  return (
    <Card className="h-full rounded-none border-0 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Elementos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-gray-600 mb-4">
          Arraste os elementos para o canvas
        </p>
        {elements.map((element) => (
          <DraggableElement
            key={element.id}
            id={element.id}
            label={element.label}
            icon={element.icon}
            type={element.type}
          />
        ))}
      </CardContent>
    </Card>
  );
};
