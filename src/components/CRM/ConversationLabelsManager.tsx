import React, { useState } from 'react';
import { X, Plus, Tag, Check, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface ConversationLabel {
  id: string;
  name: string;
  color: string;
}

const PRESET_COLORS = [
  '#EF4444', // Red
  '#374DA4', // Blue
  '#F59E0B', // Amber
  '#84CC16', // Lime
  '#22C55E', // Green
  '#14B8A6', // Teal
  '#06B6D4', // Cyan
  '#374DA4', // Blue
  '#6366F1', // Indigo
  '#8B5CF6', // Violet
  '#A855F7', // Purple
  '#EC4899', // Pink
];

interface ConversationLabelsManagerProps {
  isOpen: boolean;
  onClose: () => void;
  labels: ConversationLabel[];
  selectedLabels: string[];
  onToggleLabel: (labelId: string) => void;
  onCreateLabel: (name: string, color: string) => void;
  onDeleteLabel: (labelId: string) => void;
  mode?: 'assign' | 'manage';
}

const ConversationLabelsManager: React.FC<ConversationLabelsManagerProps> = ({
  isOpen,
  onClose,
  labels,
  selectedLabels,
  onToggleLabel,
  onCreateLabel,
  onDeleteLabel,
  mode = 'assign',
}) => {
  const [showNewLabel, setShowNewLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState(PRESET_COLORS[0]);

  const handleCreateLabel = () => {
    if (!newLabelName.trim()) return;
    onCreateLabel(newLabelName.trim(), newLabelColor);
    setNewLabelName('');
    setNewLabelColor(PRESET_COLORS[0]);
    setShowNewLabel(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-[#374DA4]" />
            {mode === 'assign' ? 'Etiquetas da Conversa' : 'Gerenciar Etiquetas'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Existing Labels */}
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-2">
              {labels.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Tag className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhuma etiqueta criada</p>
                  <p className="text-xs">Crie etiquetas para organizar conversas</p>
                </div>
              ) : (
                labels.map(label => (
                  <div
                    key={label.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer",
                      mode === 'assign' && selectedLabels.includes(label.id) 
                        ? "border-[#374DA4] bg-[#374DA4]/10" 
                        : "hover:bg-muted/50"
                    )}
                    onClick={() => mode === 'assign' && onToggleLabel(label.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: label.color }}
                      />
                      <span className="font-medium">{label.name}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {mode === 'assign' && selectedLabels.includes(label.id) && (
                        <Check className="h-4 w-4 text-[#374DA4]" />
                      )}
                      {mode === 'manage' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteLabel(label.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* New Label Form */}
          {showNewLabel ? (
            <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
              <Input
                placeholder="Nome da etiqueta"
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateLabel()}
                autoFocus
              />
              
              {/* Color Picker */}
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map(color => (
                  <button
                    key={color}
                    className={cn(
                      "w-7 h-7 rounded-full transition-transform",
                      newLabelColor === color && "ring-2 ring-offset-2 ring-[#374DA4] scale-110"
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewLabelColor(color)}
                  />
                ))}
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewLabel(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreateLabel}
                  disabled={!newLabelName.trim()}
                  className="flex-1 bg-[#374DA4] hover:bg-[#374DA4]/90"
                >
                  Criar
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => setShowNewLabel(true)}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Etiqueta
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConversationLabelsManager;
