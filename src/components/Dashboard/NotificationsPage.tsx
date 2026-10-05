import React, { useState } from 'react';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bell, CheckCheck, Archive, Trash2, AlertCircle, Calendar, MessageSquare, CheckCircle, Video, Mail, FolderOpen, ChevronLeft, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  system: AlertCircle,
  calendar: Calendar,
  crm: MessageSquare,
  task: CheckCircle,
  meeting: Video,
  email: Mail,
  drive: FolderOpen,
};

const CATEGORY_COLORS: Record<string, string> = {
  system: '#6366f1',
  calendar: '#007DE3',
  crm: '#374DA4',
  task: '#22c55e',
  meeting: '#8b5cf6',
  email: '#f59e0b',
  drive: '#374DA4',
};

const CATEGORY_LABELS: Record<string, string> = {
  system: 'Sistema',
  calendar: 'Agenda',
  crm: 'CRM',
  task: 'Tarefas',
  meeting: 'Reuniões',
  email: 'E-mail',
  drive: 'Drive',
};

const NotificationsPage = () => {
  const navigate = useNavigate();
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, deleteNotification, archiveNotification } = useNotifications();
  const [selected, setSelected] = useState<Notification | null>(null);

  const handleClick = (notif: Notification) => {
    if (!notif.is_read) markAsRead(notif.id);
    setSelected(notif);
  };

  if (selected) {
    const Icon = CATEGORY_ICONS[selected.category] || AlertCircle;
    const color = CATEGORY_COLORS[selected.category] || '#6366f1';
    return (
      <div className="max-w-2xl mx-auto p-4 md:p-6">
        <button onClick={() => setSelected(null)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ChevronLeft className="h-4 w-4" /> Voltar
        </button>
        <div className="bg-card border border-border rounded-xl p-5 md:p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}15` }}>
              <Icon className="h-5 w-5" style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-foreground">{selected.title}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${color}15`, color }}>{CATEGORY_LABELS[selected.category] || selected.category}</span>
                <span className="text-xs text-muted-foreground">{format(new Date(selected.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
              </div>
            </div>
          </div>
          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{selected.message}</p>
          {selected.action_url && (
            <Button size="sm" className="mt-4" onClick={() => navigate(selected.action_url!)}>
              Ir para o recurso
            </Button>
          )}
          <div className="flex items-center gap-2 mt-6 pt-4 border-t border-border">
            <Button size="sm" variant="outline" onClick={() => { archiveNotification(selected.id); setSelected(null); }}>
              <Archive className="h-3.5 w-3.5 mr-1.5" /> Arquivar
            </Button>
            <Button size="sm" variant="destructive" onClick={() => { deleteNotification(selected.id); setSelected(null); }}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Excluir
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Notificações</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">{unreadCount} não {unreadCount === 1 ? 'lida' : 'lidas'}</p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button size="sm" variant="outline" onClick={() => markAllAsRead()}>
            <CheckCheck className="h-4 w-4 mr-1.5" /> Marcar todas como lidas
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Bell className="h-12 w-12 text-muted-foreground/20 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
        </div>
      ) : (
        <div className="space-y-1">
          {notifications.map((notif) => {
            const Icon = CATEGORY_ICONS[notif.category] || AlertCircle;
            const color = CATEGORY_COLORS[notif.category] || '#6366f1';
            return (
              <button
                key={notif.id}
                onClick={() => handleClick(notif)}
                className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition-colors hover:bg-muted/50 ${!notif.is_read ? 'bg-primary/5' : ''}`}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: `${color}15` }}>
                  <Icon className="h-4 w-4" style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {!notif.is_read && <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />}
                    <span className="font-medium text-sm text-foreground truncate">{notif.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{notif.message}</p>
                  <span className="text-[10px] text-muted-foreground/70 mt-1 block">
                    {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0 mt-1">
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); archiveNotification(notif.id); }}
                    className="p-1.5 rounded-lg hover:bg-muted-foreground/10"
                  >
                    <Archive className="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); deleteNotification(notif.id); }}
                    className="p-1.5 rounded-lg hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
