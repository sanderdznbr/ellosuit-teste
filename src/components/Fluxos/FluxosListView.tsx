import React from 'react';
import { Clock, CheckSquare, Paperclip, MessageSquare, GripVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { WorkflowColumn, WorkflowCard, priorityConfig } from './types';

interface FluxosListViewProps {
  columns: WorkflowColumn[];
  cards: WorkflowCard[];
  employees?: any[];
  onEditCard: (card: WorkflowCard) => void;
}

export const FluxosListView: React.FC<FluxosListViewProps> = ({ columns, cards, employees = [], onEditCard }) => {
  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-6">
      {columns.map(column => {
        const columnCards = cards.filter(c => c.column_id === column.id);
        return (
          <div key={column.id} className="bg-white dark:bg-card rounded-2xl border border-border shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
            {/* Column Header */}
            <div className="px-5 py-3 border-b border-border/40 flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: column.color }} />
              <h3 className="font-semibold text-sm">{column.name}</h3>
              <Badge variant="secondary" className="text-xs rounded-full">{columnCards.length}</Badge>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-[1fr_100px_120px_100px_60px] px-5 py-2 text-xs font-medium text-muted-foreground border-b border-border/30 bg-[#faf9f7] dark:bg-white/5 uppercase tracking-tight">
              <span>Título</span>
              <span>Prioridade</span>
              <span>Data Limite</span>
              <span>Responsável</span>
              <span className="text-center">Info</span>
            </div>

            {/* Cards as rows */}
            {columnCards.length === 0 ? (
              <div className="px-5 py-6 text-center text-sm text-muted-foreground">
                Nenhum card nesta lista
              </div>
            ) : (
              columnCards.map(card => {
                const priority = priorityConfig[card.priority as keyof typeof priorityConfig] || priorityConfig.medium;
                const isOverdue = card.due_date && new Date(card.due_date) < new Date();
                const assignedUser = employees.find(e => e.user_id === card.assigned_user_id);

                return (
                  <div
                    key={card.id}
                    onClick={() => onEditCard(card)}
                    className="grid grid-cols-[1fr_100px_120px_100px_60px] px-5 py-3 border-b border-border/20 hover:bg-muted/30 cursor-pointer transition-colors items-center group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
                      <span className="text-sm font-medium truncate">{card.title}</span>
                      {card.tags && card.tags.length > 0 && (
                        <div className="flex gap-0.5 shrink-0">
                          {card.tags.slice(0, 2).map((_, i) => (
                            <div key={i} className="w-4 h-1.5 rounded-full" style={{ backgroundColor: ['#22c55e', '#eab308', '#f97316', '#ef4444'][i % 4] }} />
                          ))}
                        </div>
                      )}
                    </div>

                    {card.priority && card.priority !== 'medium' && (
                      <Badge variant="outline" className={`text-[10px] px-2 py-0.5 rounded-lg ${priority.bgLight} ${priority.textColor} border-0 w-fit`}>
                        {priority.label}
                      </Badge>
                    )}

                    <span className={`text-xs ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                      {card.due_date ? (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(card.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                        </span>
                      ) : '—'}
                    </span>

                    {assignedUser ? (
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                          {assignedUser.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}

                    <div className="flex items-center justify-center gap-2">
                      {card.attachments && card.attachments.length > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <Paperclip className="h-3 w-3" />{card.attachments.length}
                        </span>
                      )}
                      {card.comments && card.comments.length > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <MessageSquare className="h-3 w-3" />{card.comments.length}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        );
      })}
    </div>
  );
};
