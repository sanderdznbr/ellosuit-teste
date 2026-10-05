import React, { useState } from 'react';
import {
  Clock, Calendar, CalendarDays, CheckSquare, Video, MessageCircle,
  User, Search, X, Zap, Repeat, GitBranch, Bell, CalendarPlus,
  CalendarClock, Mail, FileText, Link, UserPlus, Filter,
  Send, Target, BarChart3, FileSpreadsheet, Megaphone,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { HabitBlockCategory, HabitBlockDefinition } from './types';

const SUITE_COLOR = '#374DA4';

const BLOCK_CATEGORIES: HabitBlockCategory[] = [
  {
    id: 'triggers',
    label: 'GATILHO',
    emoji: '▶',
    blocks: [
      {
        type: 'trigger', subType: 'daily',
        label: 'Diário', description: 'Executa todos os dias no horário definido.',
        icon: 'Clock', defaultConfig: { time: '09:00' },
      },
      {
        type: 'trigger', subType: 'weekly',
        label: 'Semanal', description: 'Executa em dias da semana específicos.',
        icon: 'Calendar', defaultConfig: { time: '09:00', days: [1, 2, 3, 4, 5] },
      },
      {
        type: 'trigger', subType: 'monthly',
        label: 'Mensal', description: 'Executa em um dia do mês específico.',
        icon: 'CalendarDays', defaultConfig: { time: '09:00', dayOfMonth: 1 },
      },
    ],
  },
  {
    id: 'actions',
    label: 'AÇÕES',
    emoji: '⚡',
    blocks: [
      {
        type: 'action', subType: 'create_task',
        label: 'Criar Tarefa', description: 'Adiciona tarefa ao Tasks e à Agenda.',
        icon: 'CheckSquare', defaultConfig: { title: '', description: '', priority: 'medium', duration: 60 },
      },
      {
        type: 'action', subType: 'add_calendar_event',
        label: 'Adicionar à Agenda', description: 'Cria evento direto na Agenda/Calendário.',
        icon: 'CalendarPlus', defaultConfig: { title: '', description: '', duration: 60, eventType: 'task', color: '#374DA4' },
      },
      {
        type: 'action', subType: 'create_meeting',
        label: 'Criar Reunião', description: 'Gera link de reunião ElloMeeting.',
        icon: 'Video', defaultConfig: { title: '', duration: 30 },
      },
      {
        type: 'action', subType: 'create_booking',
        label: 'Criar Agendamento', description: 'Gera link de agenda aberta para clientes.',
        icon: 'CalendarClock', defaultConfig: { title: '', duration: 30, buffer: 15 },
      },
      {
        type: 'action', subType: 'send_whatsapp',
        label: 'Enviar WhatsApp', description: 'Envia mensagem via WhatsApp CRM.',
        icon: 'MessageCircle', defaultConfig: { phone: '', message: '' },
      },
      {
        type: 'action', subType: 'send_email',
        label: 'Enviar E-mail', description: 'Envia e-mail para contato ou equipe.',
        icon: 'Mail', defaultConfig: { to: '', subject: '', body: '', templateId: '' },
      },
      {
        type: 'action', subType: 'notification',
        label: 'Notificação', description: 'Envia notificação interna.',
        icon: 'Bell', defaultConfig: { message: '' },
      },
      {
        type: 'action', subType: 'create_document',
        label: 'Criar Documento', description: 'Cria documento no módulo Documentos.',
        icon: 'FileText', defaultConfig: { name: '', fileType: 'document', description: '' },
      },
      {
        type: 'action', subType: 'create_tracked_link',
        label: 'Criar Link Rastreável', description: 'Gera link rastreado no módulo Track.',
        icon: 'Link', defaultConfig: { originalUrl: '', title: '' },
      },
      {
        type: 'action', subType: 'add_crm_contact',
        label: 'Adicionar Contato CRM', description: 'Cadastra novo contato/lead no CRM.',
        icon: 'UserPlus', defaultConfig: { name: '', email: '', phone: '', tags: [] },
      },
      {
        type: 'action', subType: 'create_campaign',
        label: 'Disparo em Massa', description: 'Cria campanha de e-mail ou WhatsApp.',
        icon: 'Megaphone', defaultConfig: { type: 'email', templateId: '', groupId: '' },
      },
      {
        type: 'action', subType: 'generate_report',
        label: 'Gerar Relatório', description: 'Gera relatório automático de métricas.',
        icon: 'BarChart3', defaultConfig: { reportType: 'tasks', period: 'weekly' },
      },
    ],
  },
  {
    id: 'config',
    label: 'CONFIGURAÇÃO',
    emoji: '⚙️',
    blocks: [
      {
        type: 'config', subType: 'assign_user',
        label: 'Atribuir a Colaborador', description: 'Vincula a ação a um membro da equipe.',
        icon: 'User', defaultConfig: { userId: '' },
      },
      {
        type: 'config', subType: 'repeat',
        label: 'Repetir Ação', description: 'Repete a ação conectada várias vezes.',
        icon: 'Repeat', defaultConfig: { times: 1 },
      },
      {
        type: 'config', subType: 'delay',
        label: 'Aguardar / Delay', description: 'Espera X minutos antes de continuar.',
        icon: 'Clock', defaultConfig: { delayMinutes: 30 },
      },
      {
        type: 'config', subType: 'filter_contacts',
        label: 'Filtrar Contatos', description: 'Filtra contatos por tags, status ou grupo.',
        icon: 'Filter', defaultConfig: { filterType: 'tag', filterValue: '' },
      },
    ],
  },
  {
    id: 'conditions',
    label: 'CONDIÇÕES',
    emoji: '🔀',
    blocks: [
      {
        type: 'condition', subType: 'if_weekday',
        label: 'Se dia útil', description: 'Executa somente em dias úteis.',
        icon: 'GitBranch', defaultConfig: { days: [1, 2, 3, 4, 5] },
      },
      {
        type: 'condition', subType: 'if_time',
        label: 'Se horário', description: 'Executa somente no intervalo.',
        icon: 'Clock', defaultConfig: { startHour: 8, endHour: 18 },
      },
      {
        type: 'condition', subType: 'if_contact_exists',
        label: 'Se contato existe', description: 'Verifica se contato já está no CRM.',
        icon: 'UserPlus', defaultConfig: { field: 'phone' },
      },
    ],
  },
];

const iconMap: Record<string, React.ComponentType<any>> = {
  Clock, Calendar, CalendarDays, CheckSquare, Video, MessageCircle,
  User, Zap, Repeat, GitBranch, Bell, CalendarPlus, CalendarClock,
  Mail, FileText, Link, UserPlus, Filter, Send, Target, BarChart3,
  FileSpreadsheet, Megaphone,
};

interface HabitSidebarProps {
  onDragStart: (block: HabitBlockDefinition) => void;
}

const HabitSidebar: React.FC<HabitSidebarProps> = ({ onDragStart }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(true);

  const filteredCategories = BLOCK_CATEGORIES
    .map(cat => ({
      ...cat,
      blocks: cat.blocks.filter(b =>
        b.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.description.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter(cat => cat.blocks.length > 0);

  if (!isOpen) {
    return (
      <div
        className="w-12 bg-white border-r flex flex-col items-center py-4 cursor-pointer hover:bg-muted/50"
        onClick={() => setIsOpen(true)}
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: SUITE_COLOR + '15' }}>
          <Zap className="h-4 w-4" style={{ color: SUITE_COLOR }} />
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-white border-r flex flex-col h-full shadow-sm">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🧩</span>
            <span className="font-semibold text-foreground">Arraste os blocos</span>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar bloco..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 bg-muted/50 border-border rounded-xl"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {filteredCategories.map(cat => (
            <div key={cat.id}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm">{cat.emoji}</span>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{cat.label}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {cat.blocks.map(block => {
                  const Icon = iconMap[block.icon] || Zap;
                  return (
                    <div
                      key={`${block.type}-${block.subType}`}
                      draggable
                      onDragStart={e => {
                        e.dataTransfer.setData('habit-block', JSON.stringify(block));
                        e.dataTransfer.effectAllowed = 'copy';
                        onDragStart(block);
                      }}
                      className="relative p-3 rounded-xl border bg-white border-border cursor-grab active:cursor-grabbing hover:border-primary/30 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start gap-2">
                        <div
                          className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: SUITE_COLOR + '15', color: SUITE_COLOR }}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-medium text-foreground block leading-tight">{block.label}</span>
                          <span className="text-[10px] text-muted-foreground block leading-snug mt-0.5 line-clamp-2">{block.description}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default HabitSidebar;
