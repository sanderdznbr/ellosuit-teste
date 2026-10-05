import React, { useState } from 'react';
import { ModularSidebar } from '@/components/Dashboard/ModularSidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import ImprovedMobileNavbar from './ImprovedMobileNavbar';
import { useOnboarding } from '@/hooks/useOnboarding';
import ConversationalOnboarding from '@/components/Onboarding/ConversationalOnboarding';
import { GuidedTour } from '@/components/Onboarding/GuidedTour';
 import { ArrowLeft } from 'lucide-react';
 import { ElloLogo } from '@/components/shared/ElloLogo';
import { useHubColor, DEFAULT_COLOR } from '@/hooks/useHubColor';

interface MobileLayoutProps {
  children: React.ReactNode;
}

const MobileLayout: React.FC<MobileLayoutProps> = ({ children }) => {
  const { isMobile } = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { color: hubColor, isDark } = useHubColor();
  const { 
    hasCompletedOnboarding, 
    hasSeenTour, 
    loading,
    completeOnboarding, 
    completeTour,
    skipOnboarding 
  } = useOnboarding();

  // Check if we're on the CRM WhatsApp page
  const isCrmWhatsApp = location.pathname.includes('/crm-whatsapp') || location.pathname.includes('/crm');

  // Show onboarding wizard for new users
  if (!loading && !hasCompletedOnboarding) {
    return (
      <ConversationalOnboarding 
        onComplete={(preferences) => {
          completeOnboarding(preferences);
        }}
        onSkip={skipOnboarding}
      />
    );
  }

  // Desktop view - mostrar a sidebar azul completa fixa
  if (!isMobile) {
    return (
      <div className="flex min-h-screen w-full">
        <ModularSidebar isMobile={false} />
        <main className="flex-1 w-full bg-background">
          {children}
        </main>
        
        {/* Guided tour for new users */}
        {!hasSeenTour && (
          <GuidedTour 
            onComplete={completeTour}
            onSkip={completeTour}
          />
        )}
      </div>
    );
  }

  // Mobile CRM WhatsApp - fullscreen, no header, no navbar
  if (isCrmWhatsApp) {
    return (
      <div className="h-[100dvh] w-full bg-background relative overflow-hidden">
        <main className="w-full h-full bg-background">
          {children}
        </main>
      </div>
    );
  }

  // Mobile view - com nova navbar inferior
  return (
    <div className="min-h-screen w-full bg-background relative">
      {/* Mobile Top Navbar - Fixed (color follows current hub) */}
      <div
        className="fixed top-0 left-0 right-0 h-14 flex items-center justify-center px-4 z-50 transition-colors duration-300"
        style={{ backgroundColor: isDark ? 'hsl(0, 0%, 8%)' : (hubColor || DEFAULT_COLOR) }}
      >
         {/* Menu Hambúrguer - Posição Absoluta Esquerda */}
         <div className="absolute left-4">
           <ModularSidebar 
             isMobile={true} 
             isOpen={sidebarOpen} 
             onOpenChange={setSidebarOpen} 
             iconColor={isDark ? hubColor : 'white'}
           />
         </div>
         
         {/* Logo Centralizada */}
         <Link to="/dashboard" className="flex items-center justify-center">
           <ElloLogo 
             className="h-7 w-auto transition-colors duration-300" 
             color={isDark ? hubColor : 'white'} 
           />
         </Link>
      </div>
      
      {/* Spacer para compensar o header fixo */}
      <div className="h-14" />
      
      {/* Main content - com padding inferior para a navbar */}
      <main className="w-full bg-background px-4 pt-4 pb-24">
        {children}
      </main>

      {/* Bottom Navigation */}
      <ImprovedMobileNavbar />
      
      {/* Guided tour for new users */}
      {!hasSeenTour && (
        <GuidedTour 
          onComplete={completeTour}
          onSkip={completeTour}
        />
      )}
    </div>
  );
};

export default MobileLayout;