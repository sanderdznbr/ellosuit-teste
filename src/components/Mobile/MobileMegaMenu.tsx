import React, { useState } from 'react';
import { isPathHidden } from "@/config/featureFlags";
import { useNavigate } from 'react-router-dom';
import { 
  X, Search, MessageSquare, Mail, Users, Key, Megaphone, GitBranch, Workflow,
  Calendar, Video, CheckSquare, FolderOpen, Zap, CalendarClock, Bot,
  FileText, Link2, Eye, BarChart3, Play, Shield, HelpCircle, Settings, 
  CreditCard, Target, Briefcase, FileSignature, AlertTriangle, Crosshair,
  Home, LayoutDashboard, Database, Smartphone, Globe
} from 'lucide-react';
import { Input } from '@/components/ui/input';

interface MobileMegaMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

const hubs = [
  {
    name: 'Sistema',
    emoji: '🏢',
    color: '#6366F1',
    items: [
      { icon: Home, label: 'Dashboard', path: '/dashboard' },
      { icon: Users, label: 'Usuários', path: '/dashboard/funcionarios' },
      { icon: Users, label: 'Clientes', path: '/dashboard/clientes' },
      { icon: Users, label: 'Fornecedores', path: '/dashboard/fornecedores' },
      { icon: Users, label: 'Prospectos', path: '/dashboard/prospectos' },
      { icon: Bot, label: 'Agentes IA', path: '/dashboard/bot-ia' },
      { icon: FolderOpen, label: 'Arquivos', path: '/dashboard/drive' },
      { icon: Database, label: 'Dados', path: '/dashboard/dados' },
      { icon: Smartphone, label: 'Mobile App', path: '/dashboard/mobile' },
      { icon: Globe, label: 'Website', path: '/dashboard/website' },
      { icon: LayoutDashboard, label: 'Vision', path: '/dashboard/ello-vision' },
      { icon: BarChart3, label: 'Análises', path: '/dashboard/analytics' },
    ],
  },
  {
    name: 'Ello Omni',
    emoji: '🟠',
    color: '#10B981',
    items: [
      { icon: MessageSquare, label: 'CRM Ello', path: '/dashboard/crm-ello' },
      { icon: Megaphone, label: 'Disparos', path: '/dashboard/disparos' },
      { icon: GitBranch, label: 'ChatBot', path: '/dashboard/chatbot' },
      { icon: Mail, label: 'Email', path: '/dashboard/email' },
      { icon: FileText, label: 'Templates Email', path: '/dashboard/email-templates' },
      { icon: Bot, label: 'Agentes IA', path: '/dashboard/bot-ia' },
      { icon: Workflow, label: 'Automações', path: '/dashboard/automacoes' },
      { icon: Key, label: 'API WhatsApp', path: '/dashboard/api-whatsapp' },
    ],
  },
  {
    name: 'Ello Flow',
    emoji: '🔵',
    color: '#06B6D4',
    items: [
      { icon: CheckSquare, label: 'Tarefas', path: '/dashboard/tasks' },
      { icon: Zap, label: 'Fluxos', path: '/dashboard/fluxos' },
      { icon: Calendar, label: 'Agenda', path: '/dashboard/agenda' },
      { icon: CalendarClock, label: 'Agenda Online', path: '/dashboard/agenda-aberta' },
      { icon: Video, label: 'Meet Hub', path: '/dashboard/meet-hub' },
      { icon: Bot, label: 'Skills de Reunião', path: '/dashboard/meet-skills' },
    ],
  },
  {
    name: 'Ello Track',
    emoji: '🎯',
    color: '#14B8A6',
    items: [
      { icon: FileText, label: 'Rastrear PDF', path: '/dashboard/rastreamento-documento' },
      { icon: Link2, label: 'Rastrear Link', path: '/dashboard/rastreamento-link' },
      { icon: Video, label: 'Rastrear Vídeo', path: '/dashboard/rastreamento-video' },
      { icon: Link2, label: 'Encurtador', path: '/dashboard/encurtador' },
      { icon: Eye, label: 'Rastrear Emails', path: '/dashboard/email-tracker' },
      { icon: Users, label: 'Captura Leads', path: '/dashboard/leads' },
    ],
  },
  {
    name: 'Análise & Relatório',
    emoji: '📊',
    color: '#8B5CF6',
    items: [
      { icon: LayoutDashboard, label: 'Ello Vision', path: '/dashboard/ello-vision' },
      { icon: BarChart3, label: 'Análises', path: '/dashboard/analytics' },
      { icon: FileText, label: 'Relatórios', path: '/dashboard/relatorios' },
    ],
  },
  {
    name: 'Ajuda & Suporte',
    emoji: '🆘',
    color: '#F59E0B',
    items: [
      { icon: HelpCircle, label: 'Suporte', path: '/dashboard/suporte' },
      { icon: AlertTriangle, label: 'Reportar Problema', path: '/dashboard/reportar-problema' },
      { icon: FileText, label: 'Termos & Políticas', path: '/termos' },
    ],
  },
  {
    name: 'Configurações',
    emoji: '⚙️',
    color: '#64748B',
    items: [
      { icon: Settings, label: 'Configurações', path: '/dashboard/configuracoes' },
      { icon: Shield, label: 'Segurança', path: '/dashboard/seguranca' },
      { icon: CreditCard, label: 'Assinatura', path: '/dashboard/assinatura' },
    ],
  },
];

const MobileMegaMenu: React.FC<MobileMegaMenuProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const handleNavigate = (path: string) => {
    navigate(path);
    onClose();
    setSearch('');
  };

  if (!isOpen) return null;

  const allItems = hubs.flatMap(h => h.items.filter((it: any) => !isPathHidden(it.path)).map(i => ({ ...i, hubColor: h.color, hubName: h.name })));
  const filtered = search
    ? allItems.filter(i => i.label.toLowerCase().includes(search.toLowerCase()))
    : null;

  return (
    <div className="fixed inset-0 z-50 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />

      <div className="absolute bottom-0 left-0 right-0 bg-background rounded-t-[28px] animate-in slide-in-from-bottom duration-300 max-h-[88vh] flex flex-col shadow-2xl">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3">
          <h2 className="text-xl font-bold text-foreground">Acesso Rápido</h2>
          <button onClick={onClose} className="p-2 -mr-2 rounded-full hover:bg-muted active:scale-95 transition-all">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pb-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar funcionalidade..." 
              value={search} 
              onChange={e => setSearch(e.target.value)}
              className="pl-10 h-11 rounded-2xl bg-muted/60 border-0 text-sm placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-primary/30"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-10 overscroll-contain">
          {filtered ? (
            <div className="grid grid-cols-4 gap-3 mt-1">
              {filtered.map(item => (
                <button key={item.path} onClick={() => handleNavigate(item.path)}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl active:scale-95 transition-all hover:bg-muted/50">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm" 
                    style={{ backgroundColor: item.hubColor + '14' }}>
                    <item.icon className="h-5 w-5" style={{ color: item.hubColor }} />
                  </div>
                  <span className="text-[11px] font-medium text-foreground text-center leading-tight line-clamp-2">{item.label}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="col-span-4 text-center py-12 text-sm text-muted-foreground">
                  Nenhum resultado encontrado
                </div>
              )}
            </div>
          ) : (
            hubs.map(hub => (
              <div key={hub.name} className="mb-6">
                {/* Hub header */}
                <div className="flex items-center gap-2 mb-3 px-0.5">
                  <span className="text-sm">{hub.emoji}</span>
                  <h3 className="text-[13px] font-bold uppercase tracking-widest text-foreground">
                    {hub.name}
                  </h3>
                  <div className="flex-1 h-px ml-1" style={{ backgroundColor: hub.color + '20' }} />
                </div>

                {/* Items grid */}
                <div className="grid grid-cols-4 gap-2">
                  {hub.items.filter((it: any) => !isPathHidden(it.path)).map(item => (
                    <button key={item.path} onClick={() => handleNavigate(item.path)}
                      className="flex flex-col items-center gap-2 p-2.5 rounded-2xl active:scale-95 transition-all hover:bg-muted/50">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center" 
                        style={{ backgroundColor: hub.color + '12' }}>
                        <item.icon className="h-[22px] w-[22px]" style={{ color: hub.color }} />
                      </div>
                      <span className="text-[11px] font-medium text-foreground text-center leading-tight line-clamp-2">
                        {item.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default MobileMegaMenu;
