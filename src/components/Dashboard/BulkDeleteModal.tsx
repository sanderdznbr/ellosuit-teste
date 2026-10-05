import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Search, Calendar, AlertTriangle, CheckSquare, Square } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Event {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  event_type: string;
  recurrence_rule?: string;
  color?: string;
}

interface BulkDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: Event[];
  onDelete: (eventIds: string[]) => Promise<void>;
}

const BulkDeleteModal: React.FC<BulkDeleteModalProps> = ({
  isOpen,
  onClose,
  events,
  onDelete
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'recurring' | 'single'>('all');

  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === 'all' || 
        (filterType === 'recurring' && event.recurrence_rule) ||
        (filterType === 'single' && !event.recurrence_rule);
      return matchesSearch && matchesType;
    }).sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
  }, [events, searchQuery, filterType]);

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    if (selectedIds.size === filteredEvents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEvents.map(e => e.id)));
    }
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    
    setIsDeleting(true);
    try {
      await onDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
      onClose();
    } catch (error) {
      console.error('Error deleting events:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'meeting': return 'bg-[#DFE4FB] text-[#1A2551]';
      case 'appointment': return 'bg-green-100 text-green-800';
      case 'reminder': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case 'meeting': return 'Reunião';
      case 'appointment': return 'Compromisso';
      case 'reminder': return 'Lembrete';
      default: return type;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Trash2 className="h-5 w-5 text-red-500" />
            Excluir Eventos em Massa
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar eventos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              {(['all', 'recurring', 'single'] as const).map((type) => (
                <Button
                  key={type}
                  variant={filterType === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterType(type)}
                  className="text-xs"
                >
                  {type === 'all' ? 'Todos' : type === 'recurring' ? 'Recorrentes' : 'Únicos'}
                </Button>
              ))}
            </div>
          </div>

          {/* Selecionar todos */}
          <div className="flex items-center justify-between px-2 py-2 bg-gray-50 rounded-lg">
            <button
              onClick={selectAll}
              className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900"
            >
              {selectedIds.size === filteredEvents.length && filteredEvents.length > 0 ? (
                <CheckSquare className="h-4 w-4 text-[#3600FF]" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              Selecionar todos ({filteredEvents.length})
            </button>
            {selectedIds.size > 0 && (
              <Badge variant="secondary" className="bg-red-100 text-red-700">
                {selectedIds.size} selecionado(s)
              </Badge>
            )}
          </div>

          {/* Lista de eventos */}
          <ScrollArea className="flex-1 border rounded-lg">
            <div className="p-2 space-y-2">
              {filteredEvents.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum evento encontrado</p>
                </div>
              ) : (
                filteredEvents.map((event) => (
                  <div
                    key={event.id}
                    onClick={() => toggleSelect(event.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                      selectedIds.has(event.id)
                        ? 'bg-red-50 border-2 border-red-200'
                        : 'bg-white border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <Checkbox
                      checked={selectedIds.has(event.id)}
                      onCheckedChange={() => toggleSelect(event.id)}
                      className="pointer-events-none"
                    />
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: event.color || '#3600FF' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 truncate">{event.title}</p>
                        {event.recurrence_rule && (
                          <Badge variant="outline" className="text-xs">
                            Recorrente
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {format(new Date(event.start_date), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <Badge className={getEventTypeColor(event.event_type)}>
                      {getEventTypeLabel(event.event_type)}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="flex-shrink-0 border-t pt-4">
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 text-sm text-amber-600 mr-auto">
              <AlertTriangle className="h-4 w-4" />
              Esta ação não pode ser desfeita
            </div>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={selectedIds.size === 0 || isDeleting}
          >
            {isDeleting ? 'Excluindo...' : `Excluir ${selectedIds.size} evento(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkDeleteModal;
