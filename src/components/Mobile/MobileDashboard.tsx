
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDeviceRegistration } from '@/hooks/useDeviceRegistration';
import MobileBottomNavigation from './MobileBottomNavigation';
import MobileHome from './MobileHome';
import MobileCalendarView from './MobileCalendarView';
import MobileEmailDashboard from './MobileEmailDashboard';
import MobileClientsManager from './MobileClientsManager';
import MobileAnalytics from './MobileAnalytics';
import MobileSettings from './MobileSettings';
import TarefasMobile from '@/components/Tarefas/TarefasMobile';
import MobileAgendaAberta from './MobileAgendaAberta';
import MobileDriveManager from './MobileDriveManager';

const MobileDashboard = () => {
  const { user, loading } = useAuth();
  const { isMobile } = useIsMobile();
  const { requestNotificationPermission } = useDeviceRegistration();
  const [activeItem, setActiveItem] = useState('home');

  useEffect(() => {
    // Auto-registrar para notificações quando entrar no dashboard mobile
    if (user && isMobile) {
      requestNotificationPermission();
    }
  }, [user, isMobile]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-300 border-t-[hsl(var(--primary))] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isMobile) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleNavigation = (item: string) => {
    setActiveItem(item);
  };

  const renderContent = () => {
    switch (activeItem) {
      case 'home':
        return <MobileHome onNavigate={handleNavigation} />;
      case 'calendar':
        return <MobileCalendarView />;
      case 'email':
        return <MobileEmailDashboard />;
      case 'clients':
        return <MobileClientsManager />;
      case 'analytics':
        return <MobileAnalytics />;
      case 'settings':
        return <MobileSettings />;
      case 'documents':
        return <MobileDriveManager />;
      case 'agenda-aberta':
        return <MobileAgendaAberta />;
      case 'tasks':
        return <TarefasMobile />;
      default:
        return <MobileHome onNavigate={handleNavigation} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="pb-20">
        {renderContent()}
      </main>
      <MobileBottomNavigation
        activeItem={activeItem}
        onItemClick={handleNavigation}
      />
    </div>
  );
};

export default MobileDashboard;
