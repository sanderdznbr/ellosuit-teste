import React, { useState } from 'react';
import { Plus, MoreHorizontal, X, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TrelloCard } from './TrelloCard';
import { WorkflowColumn, WorkflowCard } from './types';

interface TrelloColumnProps {
  column: WorkflowColumn;
  cards: WorkflowCard[];
  onAddCard: (columnId: string, title?: string) => void;
  onEditCard: (card: WorkflowCard) => void;
  onDeleteCard: (cardId: string) => void;
  onDeleteColumn: () => void;
  onEditColumn: () => void;
  employees?: any[];
  lightMode?: boolean;
}

export const TrelloColumnComponent: React.FC<TrelloColumnProps> = ({
  column, cards, onAddCard, onEditCard, onDeleteCard, onDeleteColumn, onEditColumn, employees = [], lightMode = false
}) => {
  const [isAddingCard, setIsAddingCard] = useState(false);

  const [newCardTitle, setNewCardTitle] = useState('');

  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: 'column', column }
  });

  return (
    <div
      ref={setNodeRef}
      className={`w-[290px] flex-shrink-0 flex flex-col rounded-2xl max-h-[calc(100vh-220px)] bg-white dark:bg-card border border-border shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-300 ${
        isOver ? 'ring-2 ring-[#374DA4]/50 scale-[1.005]' : ''
      }`}
    >
      {/* Column Header */}
      <div className="px-3 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <h3 className="font-semibold text-[13px] leading-tight truncate text-foreground">
            {column.name}
          </h3>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-[#ecebe4] dark:bg-white/10 text-muted-foreground">
            {cards.length}
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-xl w-48">
            <DropdownMenuItem onClick={() => onAddCard(column.id)} className="rounded-lg text-xs py-2"><Plus className="h-4 w-4 mr-2" />Adicionar cartão</DropdownMenuItem>
            <DropdownMenuItem onClick={onEditColumn} className="rounded-lg text-xs py-2"><Edit2 className="h-4 w-4 mr-2" />Editar lista</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDeleteColumn} className="text-destructive rounded-lg text-xs py-2"><Trash2 className="h-4 w-4 mr-2" />Excluir lista</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>


      {/* Cards */}
      <ScrollArea className="flex-1 px-2">
        <div className="space-y-2 pb-2">
          <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
            {cards.map(card => (
              <TrelloCard key={card.id} card={card} onEdit={() => onEditCard(card)} onDelete={() => onDeleteCard(card.id)} employees={employees} />
            ))}
          </SortableContext>

          {cards.length === 0 && !isAddingCard && (
            <div className={`text-center py-6 text-[11px] transition-all ${isOver ? 'text-foreground' : 'text-muted-foreground/60'}`}>
              <div className={`border border-dashed rounded-xl p-4 transition-all ${
                isOver ? 'border-[#374DA4]/40 bg-[#374DA4]/5 scale-[1.02]' : 'border-border'
              }`}>
                {isOver ? 'Solte aqui' : 'Arraste cards aqui'}
              </div>
            </div>
          )}


          {isAddingCard && (
            <div className="bg-card rounded-xl shadow-sm border border-border/60 p-3 space-y-2">
              <Textarea
                value={newCardTitle}
                onChange={(e) => setNewCardTitle(e.target.value)}
                placeholder="Digite o título..."
                className="min-h-[52px] text-sm resize-none rounded-lg border-0 bg-transparent p-0 focus-visible:ring-0 placeholder:text-muted-foreground/40"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => { if (!newCardTitle.trim()) return; onAddCard(column.id, newCardTitle.trim()); setNewCardTitle(''); setIsAddingCard(false); }} className="rounded-lg h-7 text-xs px-3">
                  Adicionar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsAddingCard(false)} className="rounded-lg h-7 w-7 p-0">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Add Card Button */}
      {!isAddingCard && (
        <div className="p-2 pt-0">
          <Button
            variant="ghost"
            className="w-full justify-start h-9 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-background/60"
            onClick={() => setIsAddingCard(true)}
          >
            <Plus className="h-4 w-4 mr-2" />Adicionar um cartão
          </Button>
        </div>
      )}
    </div>
  );
};
