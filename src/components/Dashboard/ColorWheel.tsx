
import React, { useState, useRef, useEffect } from 'react';
import { HexColorPicker } from 'react-colorful';

interface ColorWheelProps {
  color: string;
  onChange: (color: string) => void;
  onClose: () => void;
}

const ColorWheel = ({ color, onChange, onClose }: ColorWheelProps) => {
  const [selectedColor, setSelectedColor] = useState(color);
  const pickerRef = useRef<HTMLDivElement>(null);

  const handleColorChange = (newColor: string) => {
    setSelectedColor(newColor);
    onChange(newColor);
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
      onClose();
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div
      ref={pickerRef}
      className="absolute z-50 p-4 bg-white rounded-lg shadow-xl border"
      style={{ top: '100%', left: '0', marginTop: '8px' }}
    >
      <div className="mb-4">
        <h4 className="text-sm font-medium mb-2">Escolher Cor</h4>
        <HexColorPicker color={selectedColor} onChange={handleColorChange} />
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div 
            className="w-8 h-8 rounded border"
            style={{ backgroundColor: selectedColor }}
          />
          <span className="text-xs font-mono">{selectedColor}</span>
        </div>
        <button
          onClick={onClose}
          className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
        >
          Fechar
        </button>
      </div>
    </div>
  );
};

export default ColorWheel;
