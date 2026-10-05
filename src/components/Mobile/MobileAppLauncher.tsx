import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, X, MessageSquare, Megaphone, GitBranch, Mail, FileText,
  Bot, Workflow, Key, Calendar, CheckSquare, Zap, Video, FolderOpen,
  Briefcase, Users, BarChart3, Link2, Eye, LayoutGrid, Target,
  FileSignature, CreditCard, User, Settings, Shield, HelpCircle, Sparkles,
  Star, ArrowUpRight, TrendingUp, Webhook,
} from 'lucide-react';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';
import { isPathHidden } from '@/config/featureFlags';
import { useTheme } from '@/hooks/useTheme';

const BRAND = '#374DA4';

type AppItem = {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  path: string;
  color: string;
  category: string;
  keywords?: string[];
};

const APPS: AppItem[] = [
  // Conversas & IA
  { id: 'crm', label: 'CRM WhatsApp', description: 'Atendimento com IA', icon: WhatsAppIcon, path: '/dashboard/crm-ello', color: '#25D366', category: 'Conversas & IA', keywords: ['conversa','cliente','mensagem','chat','zap','wpp','suporte','atendimento'] },
  { id: 'disparos', label: 'Disparos', description: 'Envio em massa', icon: Megaphone, path: '/dashboard/disparos', color: '#374DA4', category: 'Conversas & IA', keywords: ['envio','massa','broadcast','campanha','marketing'] },
  { id: 'chatbot', label: 'ChatBot', description: 'Fluxos automatizados', icon: GitBranch, path: '/dashboard/chatbot', color: '#8B5CF6', category: 'Conversas & IA', keywords: ['bot','fluxo','resposta automatica','automatico'] },
  { id: 'bot-ia', label: 'Agentes IA', description: 'Chatbots inteligentes', icon: Bot, path: '/dashboard/bot-ia', color: '#6366F1', category: 'Conversas & IA', keywords: ['ia','ai','inteligencia artificial','agente','gpt'] },
  { id: 'automacoes', label: 'Automações', description: 'Fluxos automáticos', icon: Workflow, path: '/dashboard/automacoes', color: '#0EA5E9', category: 'Conversas & IA', keywords: ['workflow','gatilho','trigger','automatizar'] },
  { id: 'api-wpp', label: 'API WhatsApp', description: 'Integração de sistemas', icon: Key, path: '/dashboard/api-whatsapp', color: '#10B981', category: 'Conversas & IA', keywords: ['api','token','integracao','webhook','developer'] },
  { id: 'email', label: 'Email Marketing', description: 'Campanhas', icon: Mail, path: '/dashboard/email', color: '#F59E0B', category: 'Conversas & IA', keywords: ['email','newsletter','campanha','smtp'] },

  // Agenda & Tarefas
  { id: 'agenda', label: 'Minha Agenda', description: 'Compromissos', icon: Calendar, path: '/dashboard/agenda', color: '#374DA4', category: 'Agenda & Tarefas', keywords: ['calendario','evento','compromisso','horario'] },
  { id: 'agenda-online', label: 'Agenda Online', description: 'Links de agendamento', icon: Calendar, path: '/dashboard/agenda-aberta', color: '#374DA4', category: 'Agenda & Tarefas', keywords: ['booking','link','agendar','publico'] },
  { id: 'tasks', label: 'Tarefas', description: 'Listas e lembretes', icon: CheckSquare, path: '/dashboard/tasks', color: '#22C55E', category: 'Agenda & Tarefas', keywords: ['todo','lembrete','lista','task','afazeres'] },
  { id: 'fluxos', label: 'Fluxos Kanban', description: 'Boards e cards', icon: Zap, path: '/dashboard/fluxos', color: '#4D7CFF', category: 'Agenda & Tarefas', keywords: ['kanban','trello','board','quadro','card','pipeline','projeto'] },
  { id: 'reunioes', label: 'Reuniões', description: 'Salas de vídeo', icon: Video, path: '/dashboard/reunioes', color: '#EC4899', category: 'Agenda & Tarefas', keywords: ['meet','video','call','sala','live','zoom'] },

  // Cadastros & Equipe
  { id: 'cadastros', label: 'Cadastros', description: 'Clientes e contatos', icon: Users, path: '/dashboard/cadastros', color: '#374DA4', category: 'Cadastros & Equipe', keywords: ['contato','cliente','lead','base','crm'] },
  { id: 'drive', label: 'Drive', description: 'Arquivos da empresa', icon: FolderOpen, path: '/dashboard/drive', color: '#374DA4', category: 'Cadastros & Equipe', keywords: ['arquivo','pasta','documento','storage','upload'] },

  // Rastreamento & Dados
  { id: 'rastreio', label: 'Rastrear Conteúdo', description: 'PDFs, vídeos, imagens', icon: FileText, path: '/dashboard/rastreamento', color: '#14B8A6', category: 'Rastreamento & Dados', keywords: ['pdf','video','tracking','visualizacao','arquivo'] },
  { id: 'encurtador', label: 'Encurtador', description: 'Links rastreáveis', icon: Link2, path: '/dashboard/encurtador', color: '#14B8A6', category: 'Rastreamento & Dados', keywords: ['link','url','bitly','curto','short'] },
  { id: 'email-tracker', label: 'Rastrear Emails', description: 'Aberturas', icon: Eye, path: '/dashboard/email-tracker', color: '#14B8A6', category: 'Rastreamento & Dados', keywords: ['abertura','email','pixel','tracking'] },
  { id: 'leads', label: 'Captura de Leads', description: 'Funis', icon: Target, path: '/dashboard/leads', color: '#14B8A6', category: 'Rastreamento & Dados', keywords: ['funil','formulario','captura','landing'] },

  // Vendas
  { id: 'funil-vendas', label: 'Funil de Vendas', description: 'O funil e os contatos', icon: TrendingUp, path: '/dashboard/vendas/funil', color: '#374DA4', category: 'Vendas', keywords: ['funil','vendas','etapas','conversao','contatos','negociacao'] },
  { id: 'funil-kpis', label: 'KPIs do Funil', description: 'Conversão e desempenho', icon: BarChart3, path: '/dashboard/vendas/kpis', color: '#374DA4', category: 'Vendas', keywords: ['kpi','metricas','conversao','desempenho','indicadores'] },
  { id: 'funil-pipelines', label: 'Pipelines', description: 'Etapas e kanban', icon: GitBranch, path: '/dashboard/vendas/pipelines', color: '#4D7CFF', category: 'Vendas', keywords: ['pipeline','kanban','etapas','crm'] },
  { id: 'funil-automacoes', label: 'Automações', description: 'Gatilhos e ações', icon: Workflow, path: '/dashboard/vendas/automacoes', color: '#8B5CF6', category: 'Vendas', keywords: ['automacao','gatilho','regra','acao'] },
  { id: 'funil-integracoes', label: 'Integrações', description: 'Webhook e origens', icon: Webhook, path: '/dashboard/vendas/integracoes', color: '#0EA5E9', category: 'Vendas', keywords: ['webhook','integracao','api','origem','leads'] },
  { id: 'analytics', label: 'Analytics', description: 'Métricas gerais', icon: BarChart3, path: '/dashboard/analytics', color: '#14B8A6', category: 'Rastreamento & Dados', keywords: ['relatorio','dados','metrica','dashboard','grafico'] },

  // Conta
  { id: 'perfil', label: 'Meu Perfil', description: 'Dados pessoais', icon: User, path: '/dashboard/perfil', color: '#64748B', category: 'Conta', keywords: ['conta','foto','nome','pessoal'] },
  { id: 'assinatura', label: 'Assinatura', description: 'Plano e pagamentos', icon: CreditCard, path: '/dashboard/minhassinatura', color: '#64748B', category: 'Conta', keywords: ['plano','pagamento','cartao','fatura','cobranca','billing'] },
  { id: 'config', label: 'Preferências', description: 'Configurações', icon: Settings, path: '/dashboard/configuracoes', color: '#64748B', category: 'Conta', keywords: ['ajustes','tema','idioma','preferencia'] },
  { id: 'seguranca', label: 'Segurança', description: 'Senha e privacidade', icon: Shield, path: '/dashboard/seguranca', color: '#64748B', category: 'Conta', keywords: ['senha','privacidade','2fa','login'] },
  { id: 'suporte', label: 'Suporte', description: 'Central de ajuda', icon: HelpCircle, path: '/dashboard/suporte', color: '#64748B', category: 'Conta', keywords: ['ajuda','duvida','help','contato','faq'] },
];

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const scoreApp = (app: AppItem, q: string): number => {
  const label = normalize(app.label);
  const desc = normalize(app.description);
  const cat = normalize(app.category);
  const kws = (app.keywords || []).map(normalize);
  if (label === q) return 1000;
  if (label.startsWith(q)) return 800;
  if (label.includes(q)) return 600;
  if (kws.some((k) => k === q)) return 550;
  if (kws.some((k) => k.startsWith(q))) return 500;
  if (kws.some((k) => k.includes(q))) return 400;
  if (desc.includes(q)) return 300;
  if (cat.includes(q)) return 200;
  return 0;
};

const Highlight: React.FC<{ text: string; q: string; color: string }> = ({ text, q, color }) => {
  if (!q) return <>{text}</>;
  const nq = normalize(q);
  const nt = normalize(text);
  const i = nt.indexOf(nq);
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark style={{ background: 'transparent', color, fontWeight: 700, padding: 0 }}>
        {text.slice(i, i + q.length)}
      </mark>
      {text.slice(i + q.length)}
    </>
  );
};

interface Props {
  open: boolean;
  onClose: () => void;
}

const MobileAppLauncher: React.FC<Props> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveCategory(null);
    }
  }, [open]);

  const visibleApps = useMemo(
    () => APPS.filter((a) => !isPathHidden(a.path)),
    []
  );

  const categories = useMemo(() => {
    const seen: string[] = [];
    visibleApps.forEach((a) => {
      if (!seen.includes(a.category)) seen.push(a.category);
    });
    return seen;
  }, [visibleApps]);

  const ranked = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return [];
    return visibleApps
      .map((a) => ({ app: a, score: scoreApp(a, q) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [query, visibleApps]);

  const filtered = useMemo(() => {
    let list = ranked.length ? ranked.map((r) => r.app) : visibleApps;
    if (!query.trim() && activeCategory) {
      list = list.filter((a) => a.category === activeCategory);
    }
    return list;
  }, [ranked, visibleApps, activeCategory, query]);

  const highlights = ranked.slice(0, 3).map((r) => r.app);

  const grouped = useMemo(() => {
    const map = new Map<string, AppItem[]>();
    for (const app of filtered) {
      if (!map.has(app.category)) map.set(app.category, []);
      map.get(app.category)!.push(app);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const handleOpen = (path: string) => {
    onClose();
    navigate(path);
  };

  if (!open) return null;

  const isSearching = query.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col animate-in slide-in-from-bottom duration-200 md:hidden"
      style={{ backgroundColor: isDark ? '#0a0a0a' : '#F8FAFC' }}
    >
      {/* Header */}
      <div
        className="shrink-0 px-4 pb-3 flex flex-col gap-3"
        style={{
          backgroundColor: BRAND,
          paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <LayoutGrid className="h-5 w-5" />
            <span className="text-base font-semibold">Todas as ferramentas</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 rounded-lg active:bg-white/10 text-white"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/70" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar: conversa, agenda, kanban, ia..."
            className="w-full h-11 pl-10 pr-4 rounded-xl bg-white/15 text-white placeholder:text-white/60 text-sm outline-none focus:bg-white/20 transition-colors"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-white/80 active:bg-white/10"
              aria-label="Limpar busca"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Category chips */}
        <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5 scrollbar-none">
          <button
            onClick={() => { setActiveCategory(null); setQuery(''); }}
            className={`shrink-0 h-7 px-3 rounded-full text-[11px] font-medium transition-colors ${
              !activeCategory && !isSearching
                ? 'bg-white'
                : 'bg-white/15 text-white active:bg-white/25'
            }`}
            style={!activeCategory && !isSearching ? { color: BRAND } : undefined}
          >
            Todas
          </button>
          {categories.map((cat) => {
            const active = activeCategory === cat && !isSearching;
            return (
              <button
                key={cat}
                onClick={() => { setActiveCategory(cat); setQuery(''); }}
                className={`shrink-0 h-7 px-3 rounded-full text-[11px] font-medium transition-colors ${
                  active ? 'bg-white' : 'bg-white/15 text-white active:bg-white/25'
                }`}
                style={active ? { color: BRAND } : undefined}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
        {/* Highlighted results */}
        {isSearching && highlights.length > 0 && (
          <div className="px-4 pt-5">
            <p
              className="text-[11px] font-semibold uppercase tracking-wider mb-2.5 px-1 flex items-center gap-1.5"
              style={{ color: isDark ? 'rgba(255,255,255,0.55)' : '#94A3B8' }}
            >
              <Star className="h-3 w-3" style={{ color: BRAND }} fill={BRAND} />
              Melhores resultados
            </p>
            <div className="flex flex-col gap-2">
              {highlights.map((app) => {
                const Icon = app.icon;
                return (
                  <button
                    key={`hl-${app.id}`}
                    onClick={() => handleOpen(app.path)}
                    className="flex items-center gap-3 p-3 rounded-2xl active:scale-[0.98] transition-transform shadow-sm"
                    style={{
                      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                      border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #EEF2F7',
                    }}
                  >
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: app.color + (isDark ? '26' : '18') }}
                    >
                      <Icon className="h-5 w-5" style={{ color: app.color }} />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p
                        className="text-sm font-semibold truncate"
                        style={{ color: isDark ? '#fff' : '#0F172A' }}
                      >
                        <Highlight text={app.label} q={query} color={BRAND} />
                      </p>
                      <p
                        className="text-[11.5px] truncate"
                        style={{ color: isDark ? 'rgba(255,255,255,0.55)' : '#64748B' }}
                      >
                        {app.category} · <Highlight text={app.description} q={query} color={BRAND} />
                      </p>
                    </div>
                    <ArrowUpRight
                      className="h-4 w-4 shrink-0"
                      style={{ color: isDark ? 'rgba(255,255,255,0.4)' : '#94A3B8' }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <Sparkles className="h-10 w-10 mb-3 opacity-30" style={{ color: isDark ? '#fff' : '#64748B' }} />
            <p className="text-sm mb-4" style={{ color: isDark ? 'rgba(255,255,255,0.7)' : '#64748B' }}>
              Nenhuma ferramenta encontrada para "{query}"
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-xs">
              {['conversa','kanban','ia','agenda','disparo','drive'].map((s) => (
                <button
                  key={s}
                  onClick={() => setQuery(s)}
                  className="h-7 px-3 rounded-full text-[11px] font-medium"
                  style={{
                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#EEF2F7',
                    color: isDark ? 'rgba(255,255,255,0.8)' : '#475569',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          grouped.map(([category, items]) => (
            <div key={category} className="px-4 pt-5">
              <p
                className="text-[11px] font-semibold uppercase tracking-wider mb-2.5 px-1"
                style={{ color: isDark ? 'rgba(255,255,255,0.5)' : '#94A3B8' }}
              >
                {category}
              </p>
              <div className="grid grid-cols-4 gap-3">
                {items.map((app) => {
                  const Icon = app.icon;
                  return (
                    <button
                      key={app.id}
                      onClick={() => handleOpen(app.path)}
                      className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
                    >
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm"
                        style={{
                          backgroundColor: app.color + (isDark ? '26' : '18'),
                        }}
                      >
                        <Icon className="h-6 w-6" style={{ color: app.color }} />
                      </div>
                      <span
                        className="text-[10.5px] leading-tight text-center line-clamp-2 font-medium px-0.5"
                        style={{ color: isDark ? 'rgba(255,255,255,0.85)' : '#1E293B' }}
                      >
                        <Highlight text={app.label} q={isSearching ? query : ''} color={BRAND} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
        <div className="h-6" />
      </div>
    </div>
  );
};

export default MobileAppLauncher;