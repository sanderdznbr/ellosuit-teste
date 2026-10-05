import React from 'react';
import { MoreHorizontal, Clock, Paperclip, MessageSquare, Edit2, Trash2, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { WorkflowCard, priorityConfig, labelColors, defaultCardLabels } from './types';

const colorForTag = (name: string, index: number) => {
  const def = defaultCardLabels.find(d => d.name === name);
  if (def) return def.color;
  // stable hash by name
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return labelColors[h % labelColors.length].value;
};

interface TrelloCardProps {
  card: WorkflowCard;
  onEdit: () => void;
  onDelete: () => void;
  employees?: any[];
}

export const TrelloCard: React.FC<TrelloCardProps> = ({ card, onEdit, onDelete, employees = [] }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({

    id: card.id,
    data: { type: 'card', card }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  } as React.CSSProperties;

  const priority = priorityConfig[card.priority as keyof typeof priorityConfig] || priorityConfig.medium;
  const dueDateObj = card.due_date ? new Date(card.due_date) : null;
  const now = new Date();
  const diffMs = dueDateObj ? dueDateObj.getTime() - now.getTime() : 0;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const isOverdue = !!dueDateObj && diffMs < 0;
  const isToday = !!dueDateObj && dueDateObj.toDateString() === now.toDateString();
  const isTomorrow = !!dueDateObj && diffDays === 1 && !isToday;
  const dueLabel = dueDateObj
    ? isOverdue
      ? `Atrasado ${Math.abs(diffDays)}d`
      : isToday
        ? 'Vence hoje'
        : isTomorrow
          ? 'Vence amanhã'
          : `Vence em ${diffDays}d`
    : '';
  const dueDateStr = dueDateObj
    ? dueDateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) +
      ' · ' +
      dueDateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '';
  const assignedUser = employees.find(e => e.user_id === card.assigned_user_id);

  if (isDragging) {
    return (
      <div ref={setNodeRef} style={style} className="bg-primary/5 rounded-lg border-2 border-dashed border-primary/20 h-24" />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => { e.stopPropagation(); onEdit(); }}
      className="group rounded-lg bg-background border border-border shadow-sm hover:shadow-md hover:border-[#374DA4]/40 transition-all duration-200 cursor-pointer active:scale-[0.98] overflow-hidden"
    >
      {/* Color tags bar */}
      {card.tags && card.tags.length > 0 && (
        <div className="flex gap-1.5 px-3 pt-3 flex-wrap">
          {card.tags.slice(0, 6).map((tag, index) => (
            <span
              key={index}
              className="h-5 px-2 rounded text-[10px] font-bold text-white flex items-center"
              style={{ backgroundColor: colorForTag(tag, index) }}
              title={tag}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="p-2.5">
        <div className="flex items-start gap-1">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-[14px] leading-snug mb-2.5 text-foreground">{card.title}</p>

            <div className="flex items-center gap-2 flex-wrap">

              {/* Priority pill - só exibe quando explicitamente definida (não default) */}
              {card.priority && card.priority !== 'medium' && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${priority.bgLight} ${priority.textColor} uppercase tracking-wider`}>
                  {priority.label}
                </span>
              )}

              {/* Due date */}
              {dueDateObj && (
                <span
                  title={dueDateStr}
                  className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    isOverdue
                      ? 'bg-rose-500/15 text-rose-500'
                      : isToday
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        : diffDays <= 3
                          ? 'bg-[#374DA4]/10 text-[#374DA4]'
                          : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <CalendarClock className="h-3 w-3" />
                  {dueDateStr}
                  <span className="opacity-70">· {dueLabel}</span>
                </span>
              )}


              {/* Metadata icons */}
              {card.attachments && card.attachments.length > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/70">
                  <Paperclip className="h-2.5 w-2.5" /> {card.attachments.length}
                </span>
              )}
              {card.comments && card.comments.length > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/70">
                  <MessageSquare className="h-2.5 w-2.5" /> {card.comments.length}
                </span>
              )}

              {/* Assigned avatar - push right */}
              {assignedUser && (
                <Avatar className="h-5 w-5 ml-auto ring-2 ring-card">
                  <AvatarFallback className="text-[9px] font-bold bg-primary/10 text-primary">
                    {assignedUser.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg text-muted-foreground hover:text-foreground">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36 rounded-xl">
              <DropdownMenuItem onClick={onEdit} className="rounded-lg text-xs font-bold py-2"><Edit2 className="h-3.5 w-3.5 mr-2" />Editar</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive rounded-lg text-xs font-bold py-2 hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5 mr-2" />Excluir</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
};
