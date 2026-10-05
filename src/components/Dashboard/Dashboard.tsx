import { Routes, Route, Navigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import Home from './Home';
import MyCalendar from './MyCalendar';
import EmailDashboard from './EmailDashboard';
import ClientsManager from './ClientsManager';
import DocumentsManager from './DocumentsManager';
import Analytics from './Analytics';
import Settings from './Settings';
import GroupedSidebarEditor from './GroupedSidebarEditor';
import MeetingRooms from './MeetingRooms';
import MobileResponsiveDashboard from '@/components/Mobile/MobileResponsiveDashboard';
import { EllosuitSplash, useEllosuitSplash } from './EllosuitSplash';
import FluxosBoard from '@/components/Fluxos/FluxosBoard';
import TarefasWeb from '@/components/Tarefas/TarefasWeb';
// WhatsAppCRM is now lazy-loaded in MobileResponsiveDashboard
import DocumentTrackingDashboard from '@/components/DocumentTracking/DocumentTrackingDashboard';
import DriveManager from './DriveManager';
import ImprovedAgendaAberta from './ImprovedAgendaAberta';
import MeetingRecordings from './MeetingRecordings';

const Dashboard = () => {
  const { isMobile } = useIsMobile();
  const { show: showSplash, dismiss: dismissSplash } = useEllosuitSplash();

  const handleNavigate = (page: string) => {
    // Navigation logic can be implemented here if needed
    console.log('Navigate to:', page);
  };

  // Sempre usar o novo layout responsivo
  return (
    <div className="relative min-h-[100dvh] h-[100dvh] flex flex-col bg-white dark:bg-[#FDFDFF] overflow-hidden">
      <AnimatePresence mode="wait">
        {!showSplash ? (
          <motion.div
            key="dashboard-content"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 min-h-0 flex flex-col overflow-hidden"
          >
            <MobileResponsiveDashboard />
          </motion.div>
        ) : (
          <EllosuitSplash key="splash" onDone={dismissSplash} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;
