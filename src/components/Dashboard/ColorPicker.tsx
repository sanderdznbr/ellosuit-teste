
import React from 'react';
import { Button } from '@/components/ui/button';

interface ColorPickerProps {
  selectedColor: string;
  onColorChange: (color: string) => void;
  onClose: () => void;
}

const ColorPicker = ({ selectedColor, onColorChange, onClose }: ColorPickerProps) => {
  const colors = [
    '#3600FF', // Roxo padrão
    '#10B981', // Verde
    '#F59E0B', // Amarelo/Laranja
    '#EF4444', // Vermelho
    '#8B5CF6', // Roxo claro
    '#06B6D4', // Azul claro
    '#84CC16', // Verde lima
    '#F97316', // Laranja
    '#EC4899', // Rosa
    '#6B7280', // Cinza
    '#1F2937', // Cinza escuro
    '#059669'  // Verde escuro
  ];

  return (
    <div className="p-4 border rounded-lg bg-white shadow-lg">
      <h4 className="text-sm font-medium mb-3">Escolher Cor</h4>
      <div className="grid grid-cols-6 gap-2 mb-4">
        {colors.map((color) => (
          <button
            key={color}
            className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
              selectedColor === color ? 'border-gray-800 ring-2 ring-offset-2 ring-gray-400' : 'border-gray-300'
            }`}
            style={{ backgroundColor: color }}
            onClick={() => onColorChange(color)}
          />
        ))}
      </div>
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </div>
  );
};

export default ColorPicker;
