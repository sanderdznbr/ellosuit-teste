import React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLocation, useNavigate } from 'react-router-dom';
import { MegaMenuHeader } from './MegaMenuHeader';
import AppSidebar from './AppSidebar';
 import MobileAppHeader from '@/components/Mobile/MobileAppHeader';
 import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
 import { Search, Shield, Settings, User, CreditCard, Users, HelpCircle, AlertCircle, MessageSquare, Megaphone, GitBranch, Mail, FileText, Bot, Workflow, Key, Calendar, CheckSquare, Zap, Video, Mic, FileSignature, Target, FolderOpen, Briefcase, LayoutGrid, BarChart3, Eye, Link2, TrendingUp } from "lucide-react";
 import WhatsAppIcon from "@/components/icons/WhatsAppIcon";
import ImprovedMobileNavbar from '@/components/Mobile/ImprovedMobileNavbar';
import MobileBottomNav from '@/components/Mobile/MobileBottomNav';
import MobileAppLauncher from '@/components/Mobile/MobileAppLauncher';
import { useRoutineExecutor } from '@/hooks/useRoutineExecutor';
import { PushNotificationPrompt } from '@/components/PushNotificationPrompt';
 import { useSubscription } from '@/hooks/useSubscription';
 import { useApprovalStatus } from '@/hooks/useApprovalStatus';
 import { useAdminMaster } from '@/hooks/useAdminMaster';
import { Sparkles, ArrowRight, Menu } from 'lucide-react';
import { EllosuitMark } from '@/components/shared/EllosuitMark';
// EllloCopilot removed per user request
import PageTransition from '@/components/shared/PageTransition';
import OnboardingWizard from '@/components/Onboarding/OnboardingWizard';
import { useTheme } from '@/hooks/useTheme';
import { OmniSplash, useOmniSplash } from './OmniSplash';
import { FlowSplash, useFlowSplash } from './FlowSplash';
import { MeetSplash, useMeetSplash } from './MeetSplash';
import { TrackSplash, useTrackSplash } from './TrackSplash';
import { SuiteSplash, useSuiteSplash } from './SuiteSplash';
import { EllosuitSplash, useEllosuitSplash } from './EllosuitSplash';
import { BestPracticesPanel } from './BestPracticesPanel';
import { useToolUsageTracker } from '@/hooks/useToolUsageTracker';

export function DashboardLayout({ children }: { children?: React.ReactNode }) {
   const { isMobile, isLoading: mobileLoading } = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
   const { isFree, isLoading: subscriptionLoading } = useSubscription();
   const { status, loading: statusLoading } = useApprovalStatus();
   const { isAdminMaster, loading: adminLoading } = useAdminMaster();
    const isApproved = status === 'approved';
    const isLoading = subscriptionLoading || statusLoading || adminLoading || mobileLoading;
  const { theme } = useTheme();
  useRoutineExecutor();
  useToolUsageTracker();
  // Splash pages are disabled as per user request
  const showOmniSplash = false;
  const showFlowSplash = false;
  const showMeetSplash = false;
  const showTrackSplash = false;
  const showSuiteSplash = false;
  const showElloSplash = false;
  const dismissOmniSplash = () => {};
  const dismissFlowSplash = () => {};
  const dismissMeetSplash = () => {};
  const dismissTrackSplash = () => {};
  const dismissSuiteSplash = () => {};
  const dismissElloSplash = () => {};

  // CRM hub detection: CRM WhatsApp page OR any page accessed from CRM sidebar (?hub=crm)
  const searchParams = new URLSearchParams(location.search);
  const isCrmHub = searchParams.get('hub') === 'crm';
   const isCrmWhatsApp = location.pathname.includes('/crm-whatsapp') || location.pathname.includes('/crm-ello');
  const isCrmContext = isCrmWhatsApp || isCrmHub;
  const isCrmWhatsAppMobile = isMobile && isCrmWhatsApp;
  const isChatbotAIBuilderMobile = isMobile && location.pathname.includes('/criar-chatbot');
  const isCrmContextDesktop = !isMobile && isCrmContext;
  const isOnActivatePage = location.pathname.includes('/ativar');
  const path = location.pathname;
  const isMeetHub = path.startsWith('/dashboard/meet') || path === '/dashboard/meet' || path === '/meet' || path.startsWith('/dashboard/reunioes') || path === '/dashboard/meet-hub';
  const isChatbotBuilder = path.includes('/chatbot-builder') || path.includes('/criar-chatbot');

  // Fullscreen pages: no header, no navbar
  const isFullscreen = isCrmWhatsAppMobile || isChatbotAIBuilderMobile || isChatbotBuilder;

  const isDark = theme === 'dark';
  const isLightMode = !isDark;
  // Unified surface across every dashboard page (same as the AI home)
  const pageBg = isDark ? '#141414' : '#faf9f7';

   const [searchOpen, setSearchOpen] = React.useState(false);
   const [launcherOpen, setLauncherOpen] = React.useState(false);

   React.useEffect(() => {
     const handler = () => setLauncherOpen(true);
     window.addEventListener('open-app-launcher', handler);
     return () => window.removeEventListener('open-app-launcher', handler);
   }, []);

    // Search Palette Listener (Keyboard & Custom Event)
    React.useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key?.toLowerCase() === 'k') {
          e.preventDefault();
          setSearchOpen((v) => !v);
        }
      };

      const handleMobileSearch = () => {
        setSearchOpen(true);
      };

      document.addEventListener('keydown', handleKeyDown);
      window.addEventListener('open-global-search', handleMobileSearch);
      
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('open-global-search', handleMobileSearch);
      };
    }, []);

   const searchItems = [
     { id: "crm", label: "CRM Ello", description: "API Oficial Meta", icon: WhatsAppIcon, path: "/dashboard/crm-ello", group: "Omni" },
     { id: "disparos", label: "Disparos em Massa", description: "Envio em massa via WhatsApp", icon: Megaphone, path: "/dashboard/disparos", group: "Omni" },
     { id: "chatbot", label: "ChatBot Builder", description: "Fluxos automatizados", icon: GitBranch, path: "/dashboard/chatbot", group: "Omni" },
     { id: "criar-chatbot", label: "Criação de Chatbot com IA", description: "Crie chatbots conversando com a IA", icon: Bot, path: "/dashboard/criar-chatbot", group: "Omni" },
     { id: "email", label: "Email Marketing", description: "Campanhas e automações", icon: Mail, path: "/dashboard/email", group: "Omni" },
     { id: "email-builder", label: "Templates de Email", description: "Editor visual de emails", icon: FileText, path: "/dashboard/email-templates", group: "Omni" },
     { id: "agentes", label: "Agentes de IA", description: "Chatbots inteligentes", icon: Bot, path: "/dashboard/bot-ia", group: "Omni" },
     { id: "automacoes", label: "Automações", description: "Fluxos automatizados", icon: Workflow, path: "/dashboard/automacoes", group: "Omni" },
     { id: "api-whatsapp", label: "API WhatsApp", description: "Integração de sistemas", icon: Key, path: "/dashboard/api-whatsapp", group: "Omni" },
     { id: "agenda", label: "Minha Agenda", description: "Compromissos e eventos", icon: Calendar, path: "/dashboard/agenda", group: "Flow" },
     { id: "agenda-online", label: "Agenda Online", description: "Links de agendamento", icon: Calendar, path: "/dashboard/agenda-aberta", group: "Flow" },
     { id: "tasks", label: "Tarefas", description: "Listas e lembretes", icon: CheckSquare, path: "/dashboard/tasks", group: "Flow" },
     { id: "fluxos", label: "Fluxos", description: "Kanban e automações", icon: Zap, path: "/dashboard/fluxos", group: "Flow" },
     { id: "funil", label: "Funil de Vendas", description: "O funil e os contatos por etapa", icon: TrendingUp, path: "/dashboard/vendas/funil", group: "Vendas" },
     { id: "funil-kpis", label: "KPIs do Funil", description: "Conversão e desempenho", icon: BarChart3, path: "/dashboard/vendas/kpis", group: "Vendas" },
     { id: "funil-pipelines", label: "Pipelines de Vendas", description: "Etapas e kanban comercial", icon: GitBranch, path: "/dashboard/vendas/pipelines", group: "Vendas" },
     { id: "funil-automacoes", label: "Automações do Funil", description: "Gatilhos e ações", icon: Workflow, path: "/dashboard/vendas/automacoes", group: "Vendas" },
     { id: "funil-integracoes", label: "Integrações do Funil", description: "Webhook e origens", icon: Link2, path: "/dashboard/vendas/integracoes", group: "Vendas" },
     { id: "reunioes", label: "Iniciar Reunião", description: "Salas de reunião", icon: Video, path: "/dashboard/reunioes", group: "Meet" },
     { id: "gravacoes", label: "Reuniões Recentes", description: "Histórico e transcrições", icon: Video, path: "/dashboard/reunioes/gravacoes", group: "Meet" },
     { id: "docs", label: "Rastrear Conteúdo", description: "PDFs, vídeos e imagens", icon: FileText, path: "/dashboard/rastreamento", group: "Track" },
     { id: "links", label: "Encurtador Rastreável", description: "Encurte URLs e cliques", icon: Link2, path: "/dashboard/encurtador", group: "Track" },
     { id: "emails-track", label: "Rastrear Emails", description: "Aberturas rastreadas", icon: Eye, path: "/dashboard/email-tracker", group: "Track" },
     { id: "leads", label: "Captura de Leads", description: "Funis interativos", icon: Users, path: "/dashboard/leads", group: "Track" },
      { id: "cadastros", label: "Cadastros", description: "Clientes e contatos", icon: Users, path: "/dashboard/cadastros", group: "Suite" },
      { id: "arquivos", label: "Arquivos", description: "Drive de documentos", icon: FolderOpen, path: "/dashboard/drive", group: "Suite" },
      { id: "habitos", label: "Hábitos", description: "Rotinas diárias", icon: Target, path: "/dashboard/habitos", group: "Suite" },
     { id: "contratos", label: "Contratos", description: "Modelos editáveis", icon: FileSignature, path: "/dashboard/contratos", group: "Suite" },
     { id: "propostas", label: "Ordem de Serviço", description: "Orçamentos", icon: FileText, path: "/dashboard/propostas", group: "Suite" },
     { id: "recibos", label: "Recibos", description: "Pagamentos", icon: FileText, path: "/dashboard/recibos", group: "Suite" },
     { id: "apps", label: "Templates Prontos", description: "Automações rápidas", icon: LayoutGrid, path: "/dashboard/apps", group: "Suite" },
     { id: "analytics", label: "Analytics", description: "Métricas gerais", icon: BarChart3, path: "/dashboard/analytics", group: "Suite" },
     { id: "profile", label: "Meu Perfil", description: "Dados pessoais", icon: User, path: "/dashboard/perfil", group: "Config" },
     { id: "subscription", label: "Minha Assinatura", description: "Plano e pagamentos", icon: CreditCard, path: "/dashboard/minhassinatura", group: "Config" },
     { id: "prefs", label: "Preferências", description: "Configurações gerais", icon: Settings, path: "/dashboard/configuracoes", group: "Config" },
   ];

   if (isCrmContextDesktop && isApproved) {
     return (
       <div className="flex h-[100dvh] overflow-hidden" style={{ backgroundColor: pageBg }}>
         <AppSidebar />
         <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
           {children}
         </main>
          <PushNotificationPrompt />
       </div>
     );
   }

  return (
    <div className="flex h-[100dvh] overflow-hidden" style={{ backgroundColor: pageBg }}>
      {!isFullscreen && !isMobile && isApproved && <AppSidebar />}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
      {/* Free plan banner - above header */}
      {isFree && !isLoading && !isOnActivatePage && !isFullscreen && (
        <div
          className="bg-primary text-primary-foreground px-4 py-2.5 flex items-center justify-center gap-3 cursor-pointer hover:opacity-90 transition-opacity shrink-0"
          onClick={() => navigate('/checkout/ativar')}
        >
          <Sparkles className="h-4 w-4" />
          <span className="text-sm font-medium">
            Você está no plano gratuito. Ative o Business com 7 dias grátis!
          </span>
          <ArrowRight className="h-4 w-4" />
        </div>
      )}

        {/* Mobile Header (Claude Style) */}
        {!isFullscreen && isMobile && (
          <header 
            className="sticky top-0 left-0 right-0 z-[60] backdrop-blur-md border-b shrink-0"
            style={{ 
              backgroundColor: isDark ? 'rgba(20, 20, 20, 0.8)' : 'rgba(250, 249, 247, 0.8)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
              paddingTop: 'env(safe-area-inset-top)'
            }}
          >
            <div className="flex items-center justify-between h-14 px-4">
              <button onClick={() => navigate('/dashboard')} className="p-2 -ml-2 rounded-xl transition-colors active:bg-black/5 dark:active:bg-white/5">
                <EllosuitMark className="h-6 w-6" />
              </button>
              
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => window.dispatchEvent(new CustomEvent('open-global-search'))}
                  className="p-2 rounded-xl transition-colors active:bg-black/5 dark:active:bg-white/5"
                  style={{ color: isDark ? 'rgba(255,255,255,0.7)' : '#5c594f' }}
                >
                  <Search className="h-5 w-5" />
                </button>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('open-mobile-menu'))}
                  className="p-2 rounded-xl transition-colors active:bg-black/5 dark:active:bg-white/5"
                  style={{ color: isDark ? 'rgba(255,255,255,0.7)' : '#5c594f' }}
                >
                  <Menu className="h-5 w-5" />
                </button>
              </div>
            </div>
          </header>
        )}

        <div className="flex-1 relative overflow-hidden flex flex-col min-h-0">
          <main
            className="flex-1 relative w-full overflow-y-auto overscroll-none flex flex-col"
            style={{
              scrollbarGutter: 'stable',
              backgroundColor: pageBg,
              paddingBottom: !isFullscreen && isMobile
                ? 'calc(86px + env(safe-area-inset-bottom))'
                : undefined,
            }}
          >
           {isFullscreen ? (
             children
           ) : (
             <PageTransition>
               {children}
             </PageTransition>
           )}
         </main>
       </div>

      {/* Mobile Bottom Navigation */}
      {!isFullscreen && isMobile && isApproved && <MobileBottomNav />}
      </div>


      {/* Push Notification Permission Prompt */}
      <PushNotificationPrompt />
       <OnboardingWizard />
       {showOmniSplash && <OmniSplash onDone={dismissOmniSplash} />}
       {showFlowSplash && <FlowSplash onDone={dismissFlowSplash} />}
       {showMeetSplash && <MeetSplash onDone={dismissMeetSplash} />}
      {showTrackSplash && <TrackSplash onDone={dismissTrackSplash} />}
      {showSuiteSplash && <SuiteSplash onDone={dismissSuiteSplash} />}
        {(location.pathname === '/dashboard' || location.pathname === '/dashboard/') && showElloSplash && <EllosuitSplash onDone={dismissElloSplash} />}

       <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
         <CommandInput placeholder="Buscar funcionalidades..." />
         <CommandList>
           <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
           {["Omni", "Flow", "Meet", "Track", "Suite", "Vendas", "Config"].map((groupName) => (
             <CommandGroup key={groupName} heading={groupName}>
               {searchItems
                 .filter(i => i.group === groupName || (groupName === "Omni" && ["omni", "flow", "track", "suite", "meet"].includes(i.id)))
                 .map((item) => {
                   const Icon = item.icon;
                   return (
                     <CommandItem
                       key={item.id}
                       onSelect={() => {
                         setSearchOpen(false);
                         navigate(item.path);
                       }}
                     >
                       <div className="shrink-0 h-7 w-7 rounded-md flex items-center justify-center bg-muted border border-border/40 mr-2">
                         <Icon className="h-4 w-4" />
                       </div>
                       <div className="flex flex-col">
                         <span className="text-sm font-medium">{item.label}</span>
                         <span className="text-[11px] text-muted-foreground">{item.description}</span>
                       </div>
                     </CommandItem>
                   );
                 })}
             </CommandGroup>
           ))}
         </CommandList>
       </CommandDialog>
     </div>
   );
 }

export default DashboardLayout;
