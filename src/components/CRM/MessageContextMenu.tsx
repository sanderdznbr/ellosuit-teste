import React, { useEffect, useRef } from 'react';
import { Copy, Trash2, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  messageId: string;
  messageContent: string;
  isFromMe: boolean;
  onClose: () => void;
  onCopy: (content: string) => void;
  onDelete: (messageId: string) => void;
  onScheduleMeeting?: () => void;
}

const MessageContextMenu: React.FC<MessageContextMenuProps> = ({
  isOpen,
  position,
  messageId,
  messageContent,
  isFromMe,
  onClose,
  onCopy,
  onDelete,
  onScheduleMeeting,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
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
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const adjustedPosition = {
    x: Math.min(position.x, window.innerWidth - 180),
    y: Math.min(position.y, window.innerHeight - 180),
  };

  const MenuItem = ({ 
    icon, 
    label, 
    onClick, 
    variant = 'default' 
  }: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    variant?: 'default' | 'destructive' | 'primary';
  }) => (
    <button
      onClick={() => {
        onClick();
        onClose();
      }}
      className={cn(
        "w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-muted/80 transition-colors",
        variant === 'destructive' && "text-destructive hover:bg-destructive/10",
        variant === 'primary' && "text-[#374DA4] hover:bg-[#374DA4]/10"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-card border rounded-lg shadow-lg py-1 min-w-[160px] overflow-hidden"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
    >
      <MenuItem
        icon={<Copy className="h-4 w-4" />}
        label="Copiar"
        onClick={() => onCopy(messageContent)}
      />

      {onScheduleMeeting && (
        <MenuItem
          icon={<Calendar className="h-4 w-4" />}
          label="Agendar Reunião"
          onClick={onScheduleMeeting}
          variant="primary"
        />
      )}

      {isFromMe && (
        <MenuItem
          icon={<Trash2 className="h-4 w-4" />}
          label="Excluir"
          onClick={() => onDelete(messageId)}
          variant="destructive"
        />
      )}
    </div>
  );
};

export default MessageContextMenu;
