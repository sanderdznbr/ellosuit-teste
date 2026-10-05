import React, { Suspense, lazy, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
 import { useAuth } from '@/hooks/useAuth';
 import { useApprovalStatus } from '@/hooks/useApprovalStatus';
import { useAdminMaster } from '@/hooks/useAdminMaster';
import { useIsMobile } from '@/hooks/use-mobile';
import DashboardLayout from '@/components/Dashboard/DashboardLayout';
import MobileAppHeader from '@/components/Mobile/MobileAppHeader';
import MobileAppLauncher from '@/components/Mobile/MobileAppLauncher';
import ModuleGate from '@/components/shared/ModuleGate';

// Lazy loading spinner
const LazyFallback = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
  </div>
);

// ─── Lazy-loaded route components ───────────────────────────────
const Home = lazy(() => import('@/components/Dashboard/Home'));
const MyCalendar = lazy(() => import('@/components/Dashboard/MyCalendar'));
const NewMeetingWizard = lazy(() => import('@/components/Dashboard/NewMeetingWizard'));
const CleanEmailMarketing = lazy(() => import('@/components/Dashboard/CleanEmailMarketing'));
const EmailTemplateBuilder = lazy(() => import('@/components/Dashboard/EmailTemplateBuilder'));
const EmailTemplatesManager = lazy(() => import('@/components/Dashboard/EmailTemplatesManager'));
const SentEmailTracker = lazy(() => import('@/components/Dashboard/SentEmailTracker'));
const Analytics = lazy(() => import('@/components/Dashboard/Analytics'));
const GeneralSettingsPage = lazy(() => import('@/components/Dashboard/GeneralSettingsPage'));
const MeetingRooms = lazy(() => import('@/components/Dashboard/MeetingRooms'));
const FluxosBoard = lazy(() => import('@/components/Fluxos/FluxosBoard'));
const TarefasWeb = lazy(() => import('@/components/Tarefas/TarefasWeb'));
const WhatsAppCRM = lazy(() => import('@/components/CRM/WhatsAppCRM'));
const DriveManager = lazy(() => import('@/components/Dashboard/DriveManager'));
const ImprovedAgendaAberta = lazy(() => import('@/components/Dashboard/ImprovedAgendaAberta'));
const BookingThemeBuilder = lazy(() => import('@/components/Dashboard/BookingThemeBuilder'));

const MeetingRecordings = lazy(() => import('@/components/Dashboard/MeetingRecordings'));
const BotIADashboard = lazy(() => import('@/components/BotIA/BotIADashboard'));
const CreateAgentPage = lazy(() => import('@/components/BotIA/CreateAgentPage'));
const AiCreditsPage = lazy(() => import('@/components/Dashboard/AiCreditsPage'));
const AiCreditsHistoryPage = lazy(() => import('@/components/Dashboard/AiCreditsHistoryPage'));
const EditAgentPage = lazy(() => import('@/components/BotIA/EditAgentPage'));
const ChatBotBuilder = lazy(() => import('@/components/ChatBot/ChatBotBuilder'));
const ChatbotAIBuilder = lazy(() => import('@/pages/ChatbotAIBuilder'));
const ChatbotManagement = lazy(() => import('@/components/BotIA/ChatbotManagement'));

// Unified pages
const UnifiedDatabase = lazy(() => import('@/components/Dashboard/UnifiedDatabase'));
const UnifiedTracking = lazy(() => import('@/components/Dashboard/UnifiedTracking'));
const TrackUploadPage = lazy(() => import('@/components/Dashboard/TrackUploadPage'));
const LinkShortenerPage = lazy(() => import('@/components/Dashboard/LinkShortenerPage'));
const TeamManagement = lazy(() => import('@/components/Dashboard/TeamManagement'));
const HabitsPage = lazy(() => import('@/components/Dashboard/HabitsPage'));
const HabitFlowBuilder = lazy(() => import('@/components/Habits/HabitFlowBuilder'));
const ContractsPage = lazy(() => import('@/components/Contracts/ContractsPage'));
const ContractEditor = lazy(() => import('@/components/Contracts/ContractEditor'));
const ContractViewer = lazy(() => import('@/components/Contracts/ContractViewer'));
const ProposalsPage = lazy(() => import('@/components/Proposals/ProposalsPage'));
const ProposalEditor = lazy(() => import('@/components/Proposals/ProposalEditor'));
const ReceiptsPage = lazy(() => import('@/components/Receipts/ReceiptsPage'));
const ReceiptThemeBuilder = lazy(() => import('@/components/Receipts/ReceiptThemeBuilder'));
const AutomationBuilder = lazy(() => import('@/components/Automations/AutomationBuilder'));
const AutomationManagement = lazy(() => import('@/components/Automations/AutomationManagement'));
const AppsPage = lazy(() => import('@/components/Dashboard/AppsPage'));
const TrackModuleTest = lazy(() => import('@/components/Dashboard/TrackModuleTest'));

// Hub pages (Omni/Flow/Track/Suite removed — agora redirecionam pra /dashboard)
const MeetHub = lazy(() => import('@/components/Dashboard/MeetHub'));
const SkillsHub = lazy(() => import('@/components/Dashboard/SkillsHub'));

// Additional dashboard pages
const ElloVisionDashboard = lazy(() => import('@/components/Dashboard/ElloVisionDashboard'));
const ReportsDashboard = lazy(() => import('@/components/Dashboard/ReportsDashboard'));
const SupportDashboard = lazy(() => import('@/components/Dashboard/SupportDashboard'));
const ReportProblemForm = lazy(() => import('@/components/Dashboard/ReportProblemForm'));
const SecuritySettings = lazy(() => import('@/components/Dashboard/SecuritySettings'));
const NotificationsPage = lazy(() => import('@/components/Dashboard/NotificationsPage'));
const SettingsAppearancePage = lazy(() => import('@/components/Dashboard/SettingsAppearancePage'));
const SettingsNotificationsPage = lazy(() => import('@/components/Dashboard/SettingsNotificationsPage'));
const SettingsPrivacyPage = lazy(() => import('@/components/Dashboard/SettingsPrivacyPage'));

// User profile and subscription
const UserProfilePage = lazy(() => import('@/components/Dashboard/UserProfilePage'));
const SubscriptionPage = lazy(() => import('@/components/Dashboard/SubscriptionPage'));
const MySubscriptionPage = lazy(() => import('@/components/Dashboard/MySubscriptionPage'));
const HelpCenter = lazy(() => import('@/components/Dashboard/HelpCenter'));

// Lead Capture
const LeadFunnelsManager = lazy(() => import('@/components/LeadCapture/LeadFunnelsManager'));
const LeadFunnelBuilder = lazy(() => import('@/components/LeadCapture/LeadFunnelBuilder'));
const LeadFunnelAnalytics = lazy(() => import('@/pages/LeadFunnelAnalytics'));
const LeadTrackingDashboard = lazy(() => import('@/pages/LeadTrackingDashboard'));
const WhatsAppApiPage = lazy(() => import('@/pages/WhatsAppApiPage'));
const ApiWhatsAppCheckout = lazy(() => import('@/pages/ApiWhatsAppCheckout'));
const DisparosPage = lazy(() => import('@/components/Disparos/DisparosPage'));

// Vendas (Funil)
const FunilPage = lazy(() => import('@/components/Vendas/FunilPage'));
const EtapaPage = lazy(() => import('@/components/Vendas/EtapaPage'));
const KpiPage = lazy(() => import('@/components/Vendas/KpiPage'));
const PipelinesPage = lazy(() => import('@/components/Vendas/PipelinesPage'));
const AutomacoesPage = lazy(() => import('@/components/Vendas/AutomacoesPage'));
const IntegracoesPage = lazy(() => import('@/components/Vendas/IntegracoesPage'));

// Admin
 const AdminRegistrationRequests = lazy(() => import('@/components/Admin/AdminRegistrationRequests'));
 
const AdminLayout = lazy(() => import('@/components/Admin/AdminLayout'));
const AdminMasterDashboard = lazy(() => import('@/components/Admin/AdminMasterDashboard'));
const AdminUsersPanel = lazy(() => import('@/components/Admin/AdminUsersPanel'));
const AdminSubscriptionsPanel = lazy(() => import('@/components/Admin/AdminSubscriptionsPanel'));
const AdminSystemHealth = lazy(() => import('@/components/Admin/AdminSystemHealth'));
const AdminSupportPanel = lazy(() => import('@/components/Admin/AdminSupportPanel'));
const AdminNotificationsLog = lazy(() => import('@/components/Admin/AdminNotificationsLog'));
const AdminCostsPanel = lazy(() => import('@/components/Admin/AdminCostsPanel'));
const AdminTutorialsPanel = lazy(() => import('@/components/Admin/AdminTutorialsPanel'));
const AdminIconsDownload = lazy(() => import('@/components/Admin/AdminIconsDownload'));
const AdminEvolutionCRM = lazy(() => import('@/components/Admin/AdminEvolutionCRM'));
const AdminHubLogos = lazy(() => import('@/components/Admin/AdminHubLogos'));
const AdminLogsPanel = lazy(() => import('@/components/Admin/AdminLogsPanel'));
const AdminChargesPanel = lazy(() => import('@/components/Admin/AdminChargesPanel'));
const YCloudCRM = lazy(() => import('@/components/CRM/YCloudCRM'));
const MetaWhatsAppCRM = lazy(() => import('@/components/CRMMeta/MetaWhatsAppCRM'));

const MobileResponsiveDashboard = () => {
    const { user, loading } = useAuth();
    const { isMobile } = useIsMobile();
    const [launcherOpen, setLauncherOpen] = useState(false);
    const { status, loading: statusLoading } = useApprovalStatus();
   const { isAdminMaster, loading: adminLoading } = useAdminMaster();

  const handleNavigate = (_page: string) => {
    // Legacy prop - kept for Analytics compatibility
  };

   if (loading || adminLoading || statusLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

   if (!user) {
     return <Navigate to="/auth" replace />;
   }
 
    if (status !== 'approved') {
     return <Navigate to="/pending-approval" replace />;
   }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
      {isMobile && <MobileAppHeader />}
      {isMobile && <MobileAppLauncher open={launcherOpen} onClose={() => setLauncherOpen(false)} />}
      <Suspense fallback={<LazyFallback />}>
      <Routes>
        {/* Admin Master */}
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<AdminMasterDashboard />} />
          <Route path="users" element={<AdminUsersPanel />} />
          <Route path="subs" element={<AdminSubscriptionsPanel />} />
          <Route path="notifications" element={<AdminNotificationsLog />} />
          <Route path="system" element={<AdminSystemHealth />} />
          <Route path="support" element={<AdminSupportPanel />} />
          <Route path="costs" element={<AdminCostsPanel />} />
          <Route path="tutorials" element={<AdminTutorialsPanel />} />
          <Route path="icons" element={<AdminIconsDownload />} />
           <Route path="evolution" element={<AdminEvolutionCRM />} />
           <Route path="hub-logos" element={<AdminHubLogos />} />
           <Route path="registrations" element={<AdminRegistrationRequests />} />
           <Route path="logs" element={<AdminLogsPanel />} />
           <Route path="charges" element={<AdminChargesPanel />} />
        </Route>

        {/* Dashboard padrão com MegaMenu */}
        <Route path="*" element={
          <DashboardLayout>
            <Suspense fallback={<LazyFallback />}>
              <Routes>
                <Route path="/" element={<Home />} />
                
                 {/* CRM Ello (Evolution API) */}
                 <Route path="/crm-ello" element={<WhatsAppCRM />} />
 
                {/* Hub pages removidas — redirecionam pra dashboard */}
                <Route path="/omni" element={<Navigate to="/dashboard" replace />} />
                <Route path="/flows" element={<Navigate to="/dashboard" replace />} />
                <Route path="/track" element={<Navigate to="/dashboard" replace />} />
                <Route path="/suite" element={<Navigate to="/dashboard" replace />} />
                <Route path="/meet" element={<Home />} />
                <Route path="/meet-hub" element={<MeetHub />} />
                <Route path="/meet-skills" element={<SkillsHub />} />
                
                {/* IA - Omni */}
                <Route path="/bot-ia" element={<ModuleGate module="omni"><BotIADashboard /></ModuleGate>} />
                <Route path="/bot-ia/novo" element={<ModuleGate module="omni"><CreateAgentPage /></ModuleGate>} />
                <Route path="/bot-ia/editar/:id" element={<ModuleGate module="omni"><EditAgentPage /></ModuleGate>} />
                <Route path="/creditos-ia" element={<AiCreditsPage />} />
                <Route path="/creditos-ia/historico" element={<AiCreditsHistoryPage />} />
                <Route path="/chatbot" element={<ModuleGate module="omni"><ChatbotManagement /></ModuleGate>} />
                <Route path="/chatbot-builder" element={<ModuleGate module="omni"><ChatBotBuilder /></ModuleGate>} />
                <Route path="/criar-chatbot" element={<ModuleGate module="omni"><ChatbotAIBuilder /></ModuleGate>} />
                <Route path="/criar-chatbot/:sessionId" element={<ModuleGate module="omni"><ChatbotAIBuilder /></ModuleGate>} />
                <Route path="/automacoes" element={<AutomationManagement />} />
                <Route path="/automacoes/builder" element={<AutomationBuilder />} />
                <Route path="/apps" element={<ModuleGate module="suite"><AppsPage /></ModuleGate>} />
                
                {/* Comunicação - Omni */}
                <Route path="/crm-meta" element={<MetaWhatsAppCRM />} />
                <Route path="/crm-whatsapp" element={<ModuleGate module="omni"><WhatsAppCRM /></ModuleGate>} />
                <Route path="/api-whatsapp" element={<ModuleGate module="omni"><WhatsAppApiPage /></ModuleGate>} />
                <Route path="/api-whatsapp/checkout" element={<ModuleGate module="omni"><ApiWhatsAppCheckout /></ModuleGate>} />
                <Route path="/disparos" element={<ModuleGate module="omni"><DisparosPage /></ModuleGate>} />
                <Route path="/email" element={<ModuleGate module="omni"><CleanEmailMarketing /></ModuleGate>} />
                <Route path="/email/builder" element={<ModuleGate module="omni"><EmailTemplateBuilder /></ModuleGate>} />
                <Route path="/email-builder" element={<ModuleGate module="omni"><EmailTemplateBuilder /></ModuleGate>} />
                <Route path="/email-templates" element={<ModuleGate module="omni"><EmailTemplatesManager /></ModuleGate>} />
                <Route path="/email-tracker" element={<ModuleGate module="omni"><SentEmailTracker /></ModuleGate>} />
                <Route path="/leads" element={<ModuleGate module="omni"><LeadFunnelsManager /></ModuleGate>} />
                <Route path="/leads/builder" element={<ModuleGate module="omni"><LeadFunnelBuilder /></ModuleGate>} />
                <Route path="/leads/analytics/:funnelId" element={<ModuleGate module="omni"><LeadFunnelAnalytics /></ModuleGate>} />
                
                {/* Produtividade - Flow */}
                <Route path="/agenda" element={<ModuleGate module="flow"><MyCalendar /></ModuleGate>} />
                <Route path="/agenda/nova-reuniao" element={<ModuleGate module="flow"><NewMeetingWizard /></ModuleGate>} />
                <Route path="/agenda-aberta" element={<ModuleGate module="flow"><ImprovedAgendaAberta /></ModuleGate>} />
                <Route path="/agenda-aberta/editor" element={<ModuleGate module="flow"><BookingThemeBuilder /></ModuleGate>} />
                <Route path="/tasks" element={<ModuleGate module="flow"><TarefasWeb /></ModuleGate>} />
                <Route path="/reunioes" element={<Navigate to="/dashboard/meet-hub" replace />} />
                <Route path="/reunioes/gravacoes" element={<Navigate to="/dashboard/meet-hub" replace />} />
                <Route path="/fluxos" element={<ModuleGate module="flow"><FluxosBoard /></ModuleGate>} />
                <Route path="/fluxos/:boardId" element={<ModuleGate module="flow"><FluxosBoard /></ModuleGate>} />
                
                {/* Vendas - Funil */}
                <Route path="/vendas" element={<Navigate to="/dashboard/vendas/funil" replace />} />
                <Route path="/vendas/funil" element={<FunilPage />} />
                <Route path="/vendas/funil/:stageId" element={<EtapaPage />} />
                <Route path="/vendas/kpis" element={<KpiPage />} />
                <Route path="/vendas/pipelines" element={<PipelinesPage />} />
                <Route path="/vendas/automacoes" element={<AutomacoesPage />} />
                <Route path="/vendas/integracoes" element={<IntegracoesPage />} />
                
                {/* Rastreamento - Track */}
                <Route path="/rastreamento" element={<ModuleGate module="track"><TrackUploadPage /></ModuleGate>} />
                <Route path="/track/leads" element={<ModuleGate module="track"><LeadTrackingDashboard /></ModuleGate>} />
                <Route path="/track/test" element={<ModuleGate module="track"><TrackModuleTest /></ModuleGate>} />
                
                {/* Gestão - Suite */}
                <Route path="/cadastros" element={<ModuleGate module="suite"><UnifiedDatabase /></ModuleGate>} />
                <Route path="/drive" element={<ModuleGate module="suite"><DriveManager /></ModuleGate>} />
                <Route path="/habitos" element={<ModuleGate module="suite"><HabitsPage /></ModuleGate>} />
                <Route path="/habitos/builder" element={<ModuleGate module="suite"><HabitFlowBuilder /></ModuleGate>} />
                <Route path="/contratos" element={<ModuleGate module="suite"><ContractsPage /></ModuleGate>} />
                <Route path="/contratos/editor" element={<ModuleGate module="suite"><ContractEditor /></ModuleGate>} />
                <Route path="/contratos/visualizar" element={<ModuleGate module="suite"><ContractViewer /></ModuleGate>} />
                <Route path="/propostas" element={<ModuleGate module="suite"><ProposalsPage /></ModuleGate>} />
                <Route path="/propostas/editor" element={<ModuleGate module="suite"><ProposalEditor /></ModuleGate>} />
                <Route path="/recibos" element={<ModuleGate module="suite"><ReceiptsPage /></ModuleGate>} />
                <Route path="/recibos/design" element={<ModuleGate module="suite"><ReceiptThemeBuilder /></ModuleGate>} />
                
                {/* Legacy redirects */}
                <Route path="/clientes" element={<Navigate to="/dashboard/cadastros" replace />} />
                <Route path="/fornecedores" element={<Navigate to="/dashboard/cadastros" replace />} />
                <Route path="/prospectos" element={<Navigate to="/dashboard/cadastros" replace />} />
                <Route path="/funcionarios" element={<Navigate to="/dashboard/cadastros" replace />} />
                <Route path="/rastreamento-documento" element={<Navigate to="/dashboard/rastreamento" replace />} />
                <Route path="/rastreamento-link" element={<Navigate to="/dashboard/rastreamento" replace />} />
                <Route path="/rastreamento-video" element={<Navigate to="/dashboard/rastreamento" replace />} />
                
                {/* Insights - Suite */}
                <Route path="/ello-vision" element={<ModuleGate module="suite"><ElloVisionDashboard /></ModuleGate>} />
                <Route path="/relatorios" element={<ModuleGate module="suite"><ReportsDashboard /></ModuleGate>} />
                
                
                {/* Configurações */}
                <Route path="/configuracoes" element={<GeneralSettingsPage />} />
                <Route path="/configuracoes/aparencia" element={<SettingsAppearancePage />} />
                <Route path="/configuracoes/notificacoes" element={<SettingsNotificationsPage />} />
                <Route path="/configuracoes/privacidade" element={<SettingsPrivacyPage />} />
                
                <Route path="/seguranca" element={<SecuritySettings />} />
                <Route path="/suporte" element={<SupportDashboard />} />
                <Route path="/notificacoes" element={<NotificationsPage />} />
                <Route path="/reportar-problema" element={<ReportProblemForm />} />
                <Route path="/ajuda" element={<HelpCenter />} />
                
                {/* Profile & Subscription */}
                <Route path="/perfil" element={<UserProfilePage />} />
                <Route path="/assinatura" element={<SubscriptionPage />} />
                <Route path="/minhassinatura" element={<MySubscriptionPage />} />
                <Route path="/ativar" element={<Navigate to="/checkout/ativar" replace />} />
                
                {/* Fallback */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Suspense>
          </DashboardLayout>
        } />
      </Routes>
      </Suspense>
    </div>
  );
};

export default MobileResponsiveDashboard;
