 import React, { useState, useMemo, useEffect } from 'react';
 import { useNavigate, useLocation } from 'react-router-dom';
 import { Home, MessageSquare, Workflow, FileText, Video, Briefcase, ChevronLeft, ChevronRight } from 'lucide-react';
import QuickActionsModal from './QuickActionsModal';
 import { useHubColor } from '@/hooks/useHubColor';
 import { motion, AnimatePresence } from 'framer-motion';

const ImprovedMobileNavbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showQuickActions, setShowQuickActions] = useState(false);
  const { color: hubColor } = useHubColor();

   const isActive = (path: string) => {
     if (path === '/dashboard') {
       return location.pathname === '/dashboard' || location.pathname === '/dashboard/';
     }
     
     if (path === '/dashboard/omni') {
       return location.pathname.startsWith('/dashboard/omni') || 
              location.pathname.startsWith('/dashboard/crm-ello') ||
              location.pathname.startsWith('/dashboard/disparos') ||
              location.pathname.startsWith('/dashboard/chatbot') ||
              location.pathname.startsWith('/dashboard/email');
     }

     if (path === '/dashboard/flows') {
       return location.pathname.startsWith('/dashboard/flows') || 
              location.pathname.startsWith('/dashboard/agenda') ||
              location.pathname.startsWith('/dashboard/tasks') ||
              location.pathname.startsWith('/dashboard/fluxos');
     }

     if (path === '/dashboard/track') {
       return location.pathname.startsWith('/dashboard/track') || 
              location.pathname.startsWith('/dashboard/rastreamento') ||
              location.pathname.startsWith('/dashboard/encurtador') ||
              location.pathname.startsWith('/dashboard/leads');
     }

     if (path === '/dashboard/meet-hub') {
       return location.pathname.startsWith('/dashboard/meet') || 
              location.pathname.startsWith('/dashboard/reunioes');
     }

     if (path === '/dashboard/suite') {
       return location.pathname.startsWith('/dashboard/suite') || 
              location.pathname.startsWith('/dashboard/cadastros') ||
              location.pathname.startsWith('/dashboard/drive') ||
              location.pathname.startsWith('/dashboard/apps');
     }

     return location.pathname.startsWith(path);
   };

   const hubs = useMemo(() => [
     { id: 'home', path: '/dashboard', icon: Home, label: 'Home', activeColor: hubColor },
     { id: 'omni', path: '/dashboard/omni', icon: MessageSquare, label: 'Omni', activeColor: '#374DA4' },
     { id: 'flow', path: '/dashboard/flows', icon: Workflow, label: 'Flow', activeColor: '#4D7CFF' },
     { id: 'track', path: '/dashboard/track', icon: FileText, label: 'Track', activeColor: '#2ECC71' },
     { id: 'meet', path: '/dashboard/meet-hub', icon: Video, label: 'Meet', activeColor: '#FFFFFF' },
     { id: 'suite', path: '/dashboard/suite', icon: Briefcase, label: 'Suite', activeColor: '#3600FF' },
   ], [hubColor]);

  const currentIndex = hubs.findIndex(h => isActive(h.path));
  const currentHub = hubs[currentIndex !== -1 ? currentIndex : 0];

  const navigatePrev = () => {
    const prevIndex = (currentIndex - 1 + hubs.length) % hubs.length;
    navigate(hubs[prevIndex].path);
  };

  const navigateNext = () => {
    const nextIndex = (currentIndex + 1) % hubs.length;
    navigate(hubs[nextIndex].path);
  };

  // Gesture handling for swipe
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe) navigateNext();
    if (isRightSwipe) navigatePrev();
  };

   return (
     <>
       {/* Full screen swipe detector */}
       <div 
         className="fixed inset-0 z-[40] pointer-events-none" 
         onTouchStart={onTouchStart}
         onTouchMove={onTouchMove}
         onTouchEnd={onTouchEnd}
         style={{ height: '100dvh', width: '100vw' }}
       >
         <div className="absolute inset-0 pointer-events-auto" style={{ height: '80%', marginTop: '10%' }} />
       </div>
 
       <nav className="fixed bottom-6 left-0 right-0 bg-transparent z-50 pointer-events-none safe-bottom">
         <div className="flex items-center justify-center relative pointer-events-auto">
           <div className="flex items-center justify-between w-[220px] bg-white/5 backdrop-blur-2xl rounded-full px-2 py-1.5 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
             <button 
               onClick={navigatePrev}
               className="p-2.5 text-white/30 active:text-white/80 active:scale-90 transition-all duration-200"
             >
               <ChevronLeft className="h-5 w-5" />
             </button>
 
              <div className="relative h-11 w-28 overflow-hidden">
               <AnimatePresence mode="wait">
                 <motion.button
                   key={currentHub.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.2 }}
                    transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                   onClick={() => navigate(currentHub.path)}
                   className="absolute inset-0 flex flex-col items-center justify-center gap-0.5"
                   style={{ color: currentHub.activeColor }}
                 >
                    <currentHub.icon className="h-5 w-5 stroke-[2px]" />
                    <motion.span 
                      initial={{ y: 2, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="text-[10px] font-medium tracking-wider"
                    >
                      {currentHub.label}
                    </motion.span>
                 </motion.button>
               </AnimatePresence>
             </div>
 
             <button 
               onClick={navigateNext}
               className="p-2.5 text-white/30 active:text-white/80 active:scale-90 transition-all duration-200"
             >
               <ChevronRight className="h-5 w-5" />
             </button>
           </div>
         </div>
       </nav>
 
       {/* Quick Actions Modal */}
       <QuickActionsModal 
         isOpen={showQuickActions} 
         onClose={() => setShowQuickActions(false)} 
       />
     </>
   );
};

export default ImprovedMobileNavbar;
