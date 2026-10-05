
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HexColorPicker } from 'react-colorful';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { DesignElement } from './EmailDesigner';
import { DynamicVariables } from './DynamicVariables';

interface PropertiesPanelProps {
  selectedElement: DesignElement | null;
  onUpdateStyles: (elementId: string, styles: Partial<DesignElement['styles']>) => void;
  onUpdateContent: (elementId: string, content: string) => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedElement,
  onUpdateStyles,
  onUpdateContent,
}) => {
  if (!selectedElement) {
    return (
      <Card className="h-full rounded-none border-0 shadow-none">
        <CardHeader>
          <CardTitle className="text-lg">Propriedades</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            Selecione um elemento para editar suas propriedades
          </p>
        </CardContent>
      </Card>
    );
  }

  const updateStyle = (key: string, value: string) => {
    onUpdateStyles(selectedElement.id, { [key]: value });
  };

  const ColorPicker = ({ label, value, onChange }: { label: string; value: string; onChange: (color: string) => void }) => (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-start"
            style={{ backgroundColor: value }}
          >
            <div className="w-4 h-4 rounded border mr-2" style={{ backgroundColor: value }} />
            {value}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3">
          <HexColorPicker color={value} onChange={onChange} />
        </PopoverContent>
      </Popover>
    </div>
  );

  return (
    <Card className="h-full rounded-none border-0 shadow-none overflow-y-auto">
      <CardHeader>
        <CardTitle className="text-lg">Propriedades</CardTitle>
        <p className="text-sm text-gray-600 capitalize">{selectedElement.type}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Content */}
        {(selectedElement.type === 'text' || selectedElement.type === 'button') && (
          <div className="space-y-2">
            <Label htmlFor="content">Conteúdo</Label>
            <Textarea
              id="content"
              value={selectedElement.content || ''}
              onChange={(e) => onUpdateContent(selectedElement.id, e.target.value)}
              rows={3}
            />
            <DynamicVariables
              onInsertVariable={(variable) => {
                const currentContent = selectedElement.content || '';
                onUpdateContent(selectedElement.id, currentContent + variable);
              }}
            />
          </div>
        )}

        {selectedElement.type === 'image' && (
          <div className="space-y-2">
            <Label htmlFor="src">URL da Imagem</Label>
            <Input
              id="src"
              value={selectedElement.content || ''}
              onChange={(e) => onUpdateContent(selectedElement.id, e.target.value)}
              placeholder="https://..."
            />
          </div>
        )}

        {/* Typography */}
        {(selectedElement.type === 'text' || selectedElement.type === 'button') && (
          <>
            <div className="space-y-2">
              <Label htmlFor="fontSize">Tamanho da Fonte</Label>
              <Input
                id="fontSize"
                value={selectedElement.styles.fontSize || '16px'}
                onChange={(e) => updateStyle('fontSize', e.target.value)}
                placeholder="16px"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fontWeight">Peso da Fonte</Label>
              <Select
                value={selectedElement.styles.fontWeight || 'normal'}
                onValueChange={(value) => updateStyle('fontWeight', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="bold">Negrito</SelectItem>
                  <SelectItem value="lighter">Mais Fino</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="textAlign">Alinhamento</Label>
              <Select
                value={selectedElement.styles.textAlign || 'left'}
                onValueChange={(value) => updateStyle('textAlign', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Esquerda</SelectItem>
                  <SelectItem value="center">Centro</SelectItem>
                  <SelectItem value="right">Direita</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <ColorPicker
              label="Cor do Texto"
              value={selectedElement.styles.color || '#000000'}
              onChange={(color) => updateStyle('color', color)}
            />
          </>
        )}

        {/* Background */}
        {selectedElement.type !== 'divider' && selectedElement.type !== 'spacer' && (
          <ColorPicker
            label="Cor de Fundo"
            value={selectedElement.styles.backgroundColor || '#ffffff'}
            onChange={(color) => updateStyle('backgroundColor', color)}
          />
        )}

        {/* Dimensions */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label htmlFor="width">Largura</Label>
            <Input
              id="width"
              value={selectedElement.styles.width || 'auto'}
              onChange={(e) => updateStyle('width', e.target.value)}
              placeholder="auto"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="height">Altura</Label>
            <Input
              id="height"
              value={selectedElement.styles.height || 'auto'}
              onChange={(e) => updateStyle('height', e.target.value)}
              placeholder="auto"
            />
          </div>
        </div>

        {/* Spacing */}
        <div className="space-y-2">
          <Label htmlFor="padding">Padding</Label>
          <Input
            id="padding"
            value={selectedElement.styles.padding || '10px'}
            onChange={(e) => updateStyle('padding', e.target.value)}
            placeholder="10px"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="margin">Margin</Label>
          <Input
            id="margin"
            value={selectedElement.styles.margin || '5px'}
            onChange={(e) => updateStyle('margin', e.target.value)}
            placeholder="5px"
          />
        </div>

        {/* Border */}
        {selectedElement.type === 'button' && (
          <div className="space-y-2">
            <Label htmlFor="borderRadius">Border Radius</Label>
            <Input
              id="borderRadius"
              value={selectedElement.styles.borderRadius || '5px'}
              onChange={(e) => updateStyle('borderRadius', e.target.value)}
              placeholder="5px"
            />
          </div>
        )}

        {selectedElement.type === 'divider' && (
          <ColorPicker
            label="Cor do Divisor"
            value={selectedElement.styles.backgroundColor || '#e0e0e0'}
            onChange={(color) => updateStyle('backgroundColor', color)}
          />
        )}
      </CardContent>
    </Card>
  );
};
