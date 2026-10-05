import React, { useState, useEffect } from 'react';
import { Plus, Trash2, GripVertical, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface KanbanColumn {
  id: string;
  title: string;
  color: string;
}

const PRESET_COLORS = [
  '#374DA4', // Blue
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#6B7280', // Gray
];

interface KanbanColumnConfigProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: KanbanColumn[];
  onColumnsChange: (columns: KanbanColumn[]) => void;
}

const KanbanColumnConfig: React.FC<KanbanColumnConfigProps> = ({
  open,
  onOpenChange,
  columns,
  onColumnsChange,
}) => {
  const [localColumns, setLocalColumns] = useState<KanbanColumn[]>(columns);
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [newColumnColor, setNewColumnColor] = useState(PRESET_COLORS[0]);

  // Sync local state with incoming columns whenever the dialog opens
  // or the parent columns change (e.g. after "Organize com IA" applies new columns).
  useEffect(() => {
    if (open) {
      setLocalColumns(columns);
    }
  }, [open, columns]);

  const handleAddColumn = () => {
    if (!newColumnTitle.trim()) return;
    
    const newColumn: KanbanColumn = {
      id: `col-${Date.now()}`,
      title: newColumnTitle.trim(),
      color: newColumnColor,
    };
    
    setLocalColumns([...localColumns, newColumn]);
    setNewColumnTitle('');
    setNewColumnColor(PRESET_COLORS[0]);
  };

  const handleRemoveColumn = (columnId: string) => {
    setLocalColumns(localColumns.filter(c => c.id !== columnId));
  };

  const handleUpdateColumn = (columnId: string, field: 'title' | 'color', value: string) => {
    setLocalColumns(localColumns.map(c => 
      c.id === columnId ? { ...c, [field]: value } : c
    ));
  };

  const handleSave = () => {
    onColumnsChange(localColumns);
    onOpenChange(false);
  };

  const handleReset = () => {
    setLocalColumns(columns);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Configurar Colunas do Kanban</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Existing columns */}
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-2">
              {localColumns.map((column, index) => (
                <div 
                  key={column.id}
                  className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  
                  <div 
                    className="w-6 h-6 rounded-full flex-shrink-0 cursor-pointer border-2 border-white shadow-sm"
                    style={{ backgroundColor: column.color }}
                    onClick={() => {
                      const currentIndex = PRESET_COLORS.indexOf(column.color);
                      const nextIndex = (currentIndex + 1) % PRESET_COLORS.length;
                      handleUpdateColumn(column.id, 'color', PRESET_COLORS[nextIndex]);
                    }}
                  />
                  
                  <Input
                    value={column.title}
                    onChange={(e) => handleUpdateColumn(column.id, 'title', e.target.value)}
                    className="flex-1 h-8"
                    placeholder="Nome da coluna"
                  />
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleRemoveColumn(column.id)}
                    disabled={localColumns.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Add new column */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-2">Adicionar Nova Coluna</p>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {PRESET_COLORS.map(color => (
                  <button
                    key={color}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${
                      newColumnColor === color ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewColumnColor(color)}
                  />
                ))}
              </div>
              <Input
                value={newColumnTitle}
                onChange={(e) => setNewColumnTitle(e.target.value)}
                placeholder="Nome da coluna"
                className="flex-1 h-8"
                onKeyPress={(e) => e.key === 'Enter' && handleAddColumn()}
              />
              <Button size="sm" onClick={handleAddColumn} disabled={!newColumnTitle.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-4 border-t">
            <Button variant="outline" onClick={handleReset}>
              Resetar
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                Salvar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default KanbanColumnConfig;
