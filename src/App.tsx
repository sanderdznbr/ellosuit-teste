
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ScrollToTop } from "@/components/ScrollToTop";
import { AuthProvider } from "@/components/AuthProvider";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { OneSignalProvider } from "@/components/OneSignalProvider";
import Index from "./pages/Index";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import BookingPage from "./pages/BookingPage";
import Team from "./pages/Team";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import Tarefas from "./pages/Tarefas";
import BookingPublic from '@/pages/BookingPublic';
import ImprovedBookingPublic from '@/pages/ImprovedBookingPublic';
import ImprovedBookingCalendar from '@/pages/ImprovedBookingCalendar';
import MeetingRoom from "./components/Dashboard/MeetingRoom";
import LiveKitMeeting from "./pages/LiveKitMeeting";
import DocumentViewer from './pages/DocumentViewer';
import SharedContent from './pages/SharedContent';
import RecoverMeeting from './pages/RecoverMeeting';
import LinkRedirect from './pages/LinkRedirect';
import PublicVideoPlayer from './pages/PublicVideoPlayer';
import PublicLeadFunnel from './pages/PublicLeadFunnel';
import LeadFunnelAnalytics from './pages/LeadFunnelAnalytics';
import DocsApiCrm from './pages/DocsApiCrm';
import DocsConectarGmail from './pages/DocsConectarGmail';
import DocsEnviarEmail from './pages/DocsEnviarEmail';
import AcceptInvite from './pages/AcceptInvite';
import CheckoutActivate from './pages/CheckoutActivate';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
 import Plans from './pages/Plans';
 import StatusServer from './pages/StatusServer';
 import PendingApproval from './pages/PendingApproval';

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <AuthProvider>
          <OneSignalProvider>
          <SubscriptionProvider>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Index />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
               <Route path="/plans" element={<Plans />} />
               <Route path="/pending-approval" element={<PendingApproval />} />
              <Route path="/dashboard/*" element={<Dashboard />} />
              <Route path="/meeting/:roomCode" element={<MeetingRoom />} />
              <Route path="/meet/:roomCode" element={<LiveKitMeeting />} />
              <Route path="/recover-meeting/:roomCode" element={<RecoverMeeting />} />
              <Route path="/checkout/ativar" element={<CheckoutActivate />} />
              <Route path="/tarefas" element={<Tarefas />} />
              <Route path="/tasks" element={<Tarefas />} />
              <Route path="/booking-public/:slug" element={<ImprovedBookingPublic />} />
              <Route path="/agendamentos/:slug" element={<ImprovedBookingCalendar />} />
              <Route path="/:companyName/:slug" element={<ImprovedBookingCalendar />} />
              <Route path="/document/:linkId" element={<DocumentViewer />} />
              <Route path="/shared/:shareId" element={<SharedContent />} />
              <Route path="/l/:code" element={<LinkRedirect />} />
              <Route path="/video/:videoId" element={<PublicVideoPlayer />} />
              <Route path="/f/:slug" element={<PublicLeadFunnel />} />
              <Route path="/convite/:token" element={<AcceptInvite />} />
              <Route path="/docs-apicrm" element={<DocsApiCrm />} />
              <Route path="/docs/conectar-gmail" element={<DocsConectarGmail />} />
              <Route path="/docs/enviar-email" element={<DocsEnviarEmail />} />
              <Route path="/team" element={<Team />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/status-server" element={<StatusServer />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </SubscriptionProvider>
          </OneSignalProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
