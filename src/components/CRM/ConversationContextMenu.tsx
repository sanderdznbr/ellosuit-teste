import React, { useEffect, useRef } from 'react';
import { Tag, UserPlus, Archive, Trash2, Phone, Bot, Check, MessageSquare, Copy, GitBranch, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConversationLabel {
  id: string;
  name: string;
  color: string;
}

interface AIAgent {
  id: string;
  name: string;
  avatar_url?: string;
}

interface WhatsAppConversationData {
  id: string;
  contact_phone: string;
  contact_name?: string;
  status: string;
  assigned_agent_id?: string;
  ai_auto_reply_enabled?: boolean;
  labels?: string[];
  last_message_at?: string;
}

interface ConversationContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  conversation: WhatsAppConversationData | null;
  labels: ConversationLabel[];
  aiAgents: AIAgent[];
  onClose: () => void;
  onManageLabels: (conv: WhatsAppConversationData) => void;
  onSaveLead: (conv: WhatsAppConversationData) => void;
  onArchive: (conv: WhatsAppConversationData) => void;
  onDelete: (conv: WhatsAppConversationData) => void;
  onAssignAgent: (conv: WhatsAppConversationData, agentId: string | null) => void;
  onCopyPhone: (phone: string) => void;
  onStartChatbot?: (conv: WhatsAppConversationData) => void;
  onMarkResolved?: (conv: WhatsAppConversationData) => void;
}

const ConversationContextMenu: React.FC<ConversationContextMenuProps> = ({
  isOpen,
  position,
  conversation,
  labels,
  aiAgents,
  onClose,
  onManageLabels,
  onSaveLead,
  onArchive,
  onDelete,
  onAssignAgent,
  onCopyPhone,
  onStartChatbot,
  onMarkResolved,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !conversation) return null;

  // Adjust position to keep menu in viewport
  const adjustedPosition = {
    x: Math.min(position.x, window.innerWidth - 220),
    y: Math.min(position.y, window.innerHeight - 400),
  };

  const MenuItem: React.FC<{
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    variant?: 'default' | 'destructive' | 'warning' | 'success';
    badge?: React.ReactNode;
  }> = ({ icon, label, onClick, variant = 'default', badge }) => (
    <button
      onClick={() => {
        onClick();
        onClose();
      }}
      className={cn(
        "w-full px-3 py-2.5 text-left text-sm flex items-center gap-2.5 hover:bg-muted/80 transition-colors active:bg-muted",
        variant === 'destructive' && "text-destructive hover:bg-destructive/10",
        variant === 'warning' && "text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20",
        variant === 'success' && "text-[#374DA4] hover:bg-[#F0F2FE] dark:hover:bg-blue-950/20"
      )}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {badge}
    </button>
  );

  const Separator = () => <div className="h-px bg-border my-1" />;

  const conversationLabels = labels.filter(l => conversation.labels?.includes(l.id));

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-card border rounded-xl shadow-lg py-2 min-w-[220px] max-w-[260px] overflow-hidden"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
    >
      {/* Header with contact info */}
      <div className="px-3 py-2 border-b mb-1">
        <p className="font-medium text-sm truncate">
          {conversation.contact_name || conversation.contact_phone}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {conversation.contact_phone}
        </p>
        {conversationLabels.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {conversationLabels.slice(0, 3).map(label => (
              <span
                key={label.id}
                className="text-[10px] px-1.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: `${label.color}20`,
                  color: label.color,
                }}
              >
                {label.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      {onMarkResolved && conversation.status !== 'closed' && (
        <MenuItem
          icon={<CheckCircle2 className="h-4 w-4 text-[#374DA4]" />}
          label="Marcar como resolvido"
          onClick={() => onMarkResolved(conversation)}
          variant="success"
        />
      )}

      {onStartChatbot && (
        <MenuItem
          icon={<GitBranch className="h-4 w-4 text-[#374DA4]" />}
          label="Ativar Chatbot"
          onClick={() => onStartChatbot(conversation)}
        />
      )}

      {/* AI Agents */}
      {aiAgents.length > 0 && (
        <>
          <Separator />
          <div className="px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            Agente IA
          </div>
          {aiAgents.map(agent => (
            <MenuItem
              key={agent.id}
              icon={<Bot className="h-4 w-4 text-[#374DA4]" />}
              label={agent.name}
              onClick={() => onAssignAgent(conversation, agent.id)}
              variant={conversation.assigned_agent_id === agent.id ? 'success' : 'default'}
              badge={conversation.assigned_agent_id === agent.id ? (
                <Check className="h-3 w-3 text-[#374DA4]" />
              ) : null}
            />
          ))}
          {conversation.assigned_agent_id && (
            <MenuItem
              icon={<Trash2 className="h-4 w-4" />}
              label="Remover agente"
              onClick={() => onAssignAgent(conversation, null)}
            />
          )}
        </>
      )}

      <Separator />

      <MenuItem
        icon={<Copy className="h-4 w-4" />}
        label="Copiar número"
        onClick={() => onCopyPhone(conversation.contact_phone)}
      />

      <MenuItem
        icon={<Tag className="h-4 w-4" />}
        label="Gerenciar etiquetas"
        onClick={() => onManageLabels(conversation)}
      />

      <MenuItem
        icon={<UserPlus className="h-4 w-4" />}
        label="Salvar como lead"
        onClick={() => onSaveLead(conversation)}
      />

      <Separator />

      <MenuItem
        icon={<Archive className="h-4 w-4" />}
        label={conversation.status === 'archived' ? 'Desarquivar' : 'Arquivar'}
        onClick={() => onArchive(conversation)}
        variant="warning"
      />

      <MenuItem
        icon={<Trash2 className="h-4 w-4" />}
        label="Excluir conversa"
        onClick={() => onDelete(conversation)}
        variant="destructive"
      />
    </div>
  );
};

export default ConversationContextMenu;
