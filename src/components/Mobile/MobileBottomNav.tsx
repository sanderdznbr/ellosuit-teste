import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home, MessageSquare, Users, Megaphone, LayoutGrid, X,
  Calendar, CheckSquare, Zap, Video, FolderOpen, Bot,
  Mail, Settings, User, CreditCard, Eye, Mic,
  Shield, HelpCircle, Key, GitBranch, CalendarClock,
} from 'lucide-react';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';
import { isPathHidden } from '@/config/featureFlags';
import { useTheme } from '@/hooks/useTheme';
import { useHubColor } from '@/hooks/useHubColor';

const BRAND = '#374DA4';

type NavItem = {
  id: string;
  icon: React.ElementType;
  label: string;
  path?: string;
  action?: 'slider';
  match: (path: string) => boolean;
  primary?: boolean;
};

const navItems: NavItem[] = [
  {
    id: 'home',
    icon: Home,
    label: 'Início',
    path: '/dashboard',
    match: (p) => p === '/dashboard' || p === '/dashboard/',
  },
  {
    id: 'conversas',
    icon: MessageSquare,
    label: 'Conversas',
    path: '/dashboard/crm-ello',
    match: (p) => p.startsWith('/dashboard/crm-ello') || p.startsWith('/dashboard/crm-whatsapp') || p.startsWith('/dashboard/chatbot') || p.startsWith('/dashboard/bot-ia'),
  },
  {
    id: 'apps',
    icon: LayoutGrid,
    label: 'Tudo',
    action: 'slider',
    match: () => false,
    primary: true,
  },
  {
    id: 'contatos',
    icon: Users,
    label: 'Contatos',
    path: '/dashboard/cadastros',
    match: (p) => p.startsWith('/dashboard/cadastros') || p.startsWith('/dashboard/contatos'),
  },
  {
    id: 'disparos',
    icon: Megaphone,
    label: 'Disparos',
    path: '/dashboard/disparos',
    match: (p) => p.startsWith('/dashboard/disparos'),
  },
];

type SliderHub = {
  name: string;
  color: string;
  items: { label: string; icon: React.ElementType; path: string }[];
};

// Mirrors the web sidebar groups (src/components/Dashboard/AppSidebar.tsx)
const rawHubs: SliderHub[] = [
  {
    name: 'Conversas',
    color: '#374DA4',
    items: [
      { label: 'CRM WhatsApp', icon: WhatsAppIcon, path: '/dashboard/crm-ello' },
      { label: 'Disparos em Massa', icon: Megaphone, path: '/dashboard/disparos' },
      { label: 'ChatBot Builder', icon: GitBranch, path: '/dashboard/chatbot' },
      { label: 'Chatbot IA Creator', icon: Bot, path: '/dashboard/criar-chatbot' },
      { label: 'Agentes de IA', icon: Bot, path: '/dashboard/bot-ia' },
      { label: 'Email Marketing', icon: Mail, path: '/dashboard/email' },
      { label: 'Rastrear Emails', icon: Eye, path: '/dashboard/email-tracker' },
      { label: 'API WhatsApp', icon: Key, path: '/dashboard/api-whatsapp' },
    ],
  },
  {
    name: 'Contatos',
    color: '#374DA4',
    items: [
      { label: 'Cadastros', icon: Users, path: '/dashboard/cadastros' },
      { label: 'Drive', icon: FolderOpen, path: '/dashboard/drive' },
    ],
  },
  {
    name: 'Agenda',
    color: '#374DA4',
    items: [
      { label: 'Minha Agenda', icon: Calendar, path: '/dashboard/agenda' },
      { label: 'Agenda Online', icon: CalendarClock, path: '/dashboard/agenda-aberta' },
      { label: 'Tarefas', icon: CheckSquare, path: '/dashboard/tasks' },
      { label: 'Fluxos (Kanban)', icon: Zap, path: '/dashboard/fluxos' },
    ],
  },
  {
    name: 'Reuniões',
    color: '#374DA4',
    items: [
      { label: 'Iniciar Reunião', icon: Video, path: '/dashboard/reunioes' },
      { label: 'Recentes', icon: Video, path: '/dashboard/reunioes/gravacoes' },
      { label: 'Gravar Presencial', icon: Mic, path: '/dashboard/reunioes?action=record' },
    ],
  },
  {
    name: 'Conta',
    color: '#374DA4',
    items: [
      { label: 'Aplicativos', icon: LayoutGrid, path: '/dashboard/apps' },
      { label: 'Meu Perfil', icon: User, path: '/dashboard/perfil' },
      { label: 'Minha Assinatura', icon: CreditCard, path: '/dashboard/minhassinatura' },
      { label: 'Preferências', icon: Settings, path: '/dashboard/configuracoes' },
      { label: 'Segurança', icon: Shield, path: '/dashboard/seguranca' },
      { label: 'Suporte', icon: HelpCircle, path: '/dashboard/suporte' },
    ],
  },
];

const sliderHubs: SliderHub[] = rawHubs
  .map((h) => ({ ...h, items: h.items.filter((i) => !isPathHidden(i.path.split('?')[0])) }))
  .filter((h) => h.items.length > 0);

const MobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const { color: hubColor } = useHubColor();
  const isDark = theme === 'dark';
  const accent = hubColor || BRAND;
  const [sliderOpen, setSliderOpen] = React.useState(false);

  const path = location.pathname;
  const activeId = navItems.find((i) => i.match(path))?.id ?? null;

  React.useEffect(() => { setSliderOpen(false); }, [path]);

  const surface = isDark ? 'rgba(26,26,26,0.92)' : 'rgba(255,255,255,0.92)';
  const hairline = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const muted = isDark ? 'rgba(255,255,255,0.5)' : '#9a978f';

  const go = (p: string) => { setSliderOpen(false); navigate(p); };

  return (
    <>
      {/* Backdrop */}
      {sliderOpen && (
        <div
          className="fixed inset-0 z-[59] md:hidden animate-in fade-in duration-200"
          style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(20,20,20,0.28)', backdropFilter: 'blur(2px)' }}
          onClick={() => setSliderOpen(false)}
        />
      )}

      {/* Function slider */}
      {sliderOpen && (
        <div
          className="fixed left-0 right-0 z-[61] md:hidden animate-in slide-in-from-bottom-4 fade-in duration-250"
          style={{ bottom: 'calc(84px + env(safe-area-inset-bottom))' }}
        >
          <div
            className="mx-3 rounded-[26px] border overflow-hidden"
            style={{
              backgroundColor: surface,
              borderColor: hairline,
              backdropFilter: 'blur(24px)',
              boxShadow: '0 24px 50px -18px rgba(0,0,0,0.35)',
            }}
          >
            <div className="flex items-center justify-between px-4 pt-3.5 pb-1">
              <span className="text-[13px] font-semibold" style={{ color: isDark ? '#fff' : '#2b2b28' }}>
                Todas as funções
              </span>
              <button
                onClick={() => setSliderOpen(false)}
                className="h-7 w-7 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }}
                aria-label="Fechar"
              >
                <X className="h-3.5 w-3.5" style={{ color: muted }} />
              </button>
            </div>

            <div className="max-h-[52vh] overflow-y-auto overscroll-contain pb-3 px-4">
              {sliderHubs.map((hub) => (
                <div key={hub.name} className="mt-4 first:mt-2">
                  <div className="flex items-center gap-2 mb-2.5">
                    <span
                      className="text-[10px] font-bold uppercase tracking-[0.14em]"
                      style={{ color: isDark ? 'rgba(255,255,255,0.75)' : '#5a5752' }}
                    >
                      {hub.name}
                    </span>
                    <div
                      className="flex-1 h-px ml-1"
                      style={{ backgroundColor: hub.color + '22' }}
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {hub.items.map((it) => {
                      const Icon = it.icon;
                      const active = path === it.path || path.startsWith(it.path + '/');
                      return (
                        <button
                          key={it.path + it.label}
                          onClick={() => go(it.path)}
                          className="rounded-2xl p-2.5 flex flex-col items-center gap-2 active:scale-95 transition-transform"
                          style={{
                            backgroundColor: active
                              ? (isDark ? hub.color + '28' : hub.color + '12')
                              : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'),
                          }}
                        >
                          <div
                            className="w-10 h-10 rounded-[14px] flex items-center justify-center"
                            style={{ backgroundColor: active ? hub.color + '18' : hub.color + '0d' }}
                          >
                            <Icon
                              className="h-[18px] w-[18px]"
                              style={{ color: active ? hub.color : (isDark ? 'rgba(255,255,255,0.75)' : '#4a4842') }}
                              strokeWidth={2}
                            />
                          </div>
                          <span
                            className="text-[10px] leading-tight text-center line-clamp-2"
                            style={{ color: active ? hub.color : (isDark ? 'rgba(255,255,255,0.7)' : '#5a5752'), fontWeight: active ? 700 : 500 }}
                          >
                            {it.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Floating dock */}
      <nav
        className="fixed left-0 right-0 z-[60] md:hidden"
        style={{ bottom: 'calc(10px + env(safe-area-inset-bottom))' }}
      >
        <div
          className="mx-3 h-[62px] rounded-[24px] border flex items-center justify-between px-1.5"
          style={{
            backgroundColor: surface,
            borderColor: hairline,
            backdropFilter: 'blur(24px)',
            boxShadow: '0 14px 34px -14px rgba(0,0,0,0.28)',
          }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeId === item.id;

            const handleClick = () => {
              if (item.action === 'slider') { setSliderOpen((v) => !v); return; }
              if (item.path) navigate(item.path);
            };

            if (item.primary) {
              return (
                <button
                  key={item.id}
                  onClick={handleClick}
                  aria-label="Abrir todas as funções"
                  className="flex-1 flex items-center justify-center active:scale-90 transition-transform duration-150"
                >
                  <span
                    className="flex items-center justify-center h-[46px] w-[46px] rounded-[18px]"
                    style={{
                      background: `linear-gradient(145deg, ${accent}, ${accent}cc)`,
                      boxShadow: `0 8px 18px -6px ${accent}80`,
                      transform: sliderOpen ? 'rotate(45deg)' : 'none',
                      transition: 'transform 220ms cubic-bezier(0.16,1,0.3,1)',
                    }}
                  >
                    <Icon className="h-[21px] w-[21px] text-white" strokeWidth={2.1} />
                  </span>
                </button>
              );
            }

            return (
              <button
                key={item.id}
                onClick={handleClick}
                className="relative flex-1 h-full flex flex-col items-center justify-center gap-[3px] active:scale-95 transition-transform"
              >
                <Icon
                  className="h-[20px] w-[20px] transition-colors duration-200"
                  style={{ color: isActive ? accent : muted }}
                  strokeWidth={isActive ? 2.4 : 1.9}
                />
                <span
                  className="text-[9.5px] leading-none line-clamp-1 px-0.5 transition-colors duration-200"
                  style={{ color: isActive ? accent : muted, fontWeight: isActive ? 700 : 500 }}
                >
                  {item.label}
                </span>
                <span
                  aria-hidden
                  className="absolute bottom-1.5 h-[3px] rounded-full transition-all duration-250"
                  style={{ width: isActive ? 16 : 0, backgroundColor: accent, opacity: isActive ? 1 : 0 }}
                />
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default MobileBottomNav;
