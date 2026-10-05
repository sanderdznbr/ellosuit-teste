
 import React, { useState, useEffect } from 'react';
 import { Home, Calendar, Mail, Users, ChevronLeft, ChevronRight } from 'lucide-react';
 import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface MobileBottomNavigationProps {
  activeItem: string;
  onItemClick: (item: string) => void;
}

const MobileBottomNavigation: React.FC<MobileBottomNavigationProps> = ({
  activeItem,
  onItemClick
}) => {
  const navItems = [
     { id: 'home', icon: Home, label: 'Início' },
     { id: 'agenda', icon: Calendar, label: 'Agenda' },
     { id: 'email', icon: Mail, label: 'Email' },
     { id: 'clientes', icon: Users, label: 'Clientes' },
  ];

   const currentIndex = navItems.findIndex(item => item.id === activeItem);
   const activeNavItem = navItems[currentIndex] || navItems[0];
 
   const goToPrevious = () => {
     const newIndex = (currentIndex - 1 + navItems.length) % navItems.length;
     onItemClick(navItems[newIndex].id);
   };
 
   const goToNext = () => {
     const newIndex = (currentIndex + 1) % navItems.length;
     onItemClick(navItems[newIndex].id);
   };
 
   const [touchStart, setTouchStart] = useState<number | null>(null);
   const [touchEnd, setTouchEnd] = useState<number | null>(null);
 
   const handleTouchStart = (e: React.TouchEvent) => {
     setTouchStart(e.targetTouches[0].clientX);
   };
 
   const handleTouchMove = (e: React.TouchEvent) => {
     setTouchEnd(e.targetTouches[0].clientX);
   };
 
   const handleTouchEnd = () => {
     if (!touchStart || !touchEnd) return;
     const distance = touchStart - touchEnd;
     const isSwipe = Math.abs(distance) > 50;
     if (isSwipe) {
       if (distance > 0) goToNext();
       else goToPrevious();
     }
     setTouchStart(null);
     setTouchEnd(null);
   };
 
  return (
     <div 
       className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] md:hidden w-auto max-w-[280px]"
       onTouchStart={handleTouchStart}
       onTouchMove={handleTouchMove}
       onTouchEnd={handleTouchEnd}
     >
        <div className="flex items-center bg-black/20 backdrop-blur-2xl border border-white/5 rounded-full px-4 py-2.5 shadow-2xl">
         <button 
           onClick={goToPrevious}
            className="p-1.5 text-white/40 hover:text-white transition-colors active:scale-90"
         >
           <ChevronLeft className="h-5 w-5" />
         </button>
 
          <div className="flex-1 px-5 flex flex-col items-center min-w-[110px] relative overflow-hidden">
           <AnimatePresence mode="wait">
             <motion.div
               key={activeNavItem.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
               className="flex items-center gap-2"
             >
                <activeNavItem.icon className="h-4 w-4 text-[#5A74D1]/80" />
                <span className="text-sm font-medium text-white/90 tracking-wide">
                 {activeNavItem.label}
               </span>
             </motion.div>
           </AnimatePresence>
           
            <div className="flex gap-1.5 mt-2">
             {navItems.map((_, idx) => (
               <div 
                 key={idx}
                 className={cn(
                    "h-0.5 rounded-full transition-all duration-300",
                    currentIndex === idx ? "w-4 bg-[#374DA4]/60" : "w-1 bg-white/10"
                 )}
               />
             ))}
           </div>
         </div>
 
         <button 
           onClick={goToNext}
            className="p-1.5 text-white/40 hover:text-white transition-colors active:scale-90"
         >
           <ChevronRight className="h-5 w-5" />
         </button>
      </div>
    </div>
  );
};

export default MobileBottomNavigation;
