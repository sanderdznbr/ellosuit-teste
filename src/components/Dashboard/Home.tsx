import React, { useEffect, useState } from 'react';
import AIAssistantHome from './AIAssistantHome';
import { BestPracticesPanel } from './BestPracticesPanel';
import { useIsMobile } from '@/hooks/use-mobile';
import { ChevronDown } from 'lucide-react';

const Home = () => {
  const { isMobile } = useIsMobile();
  const [showBestPractices, setShowBestPractices] = useState(false);
  const [hasChat, setHasChat] = useState(false);
  const [hubHidden, setHubHidden] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem('knowledge-hub-hidden');
    return stored === null ? true : stored === 'true';
  });

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setHubHidden(!!detail?.hidden);
      if (detail?.hidden) setShowBestPractices(false);
    };
    window.addEventListener('knowledge-hub-visibility-changed', handler as EventListener);
    return () => window.removeEventListener('knowledge-hub-visibility-changed', handler as EventListener);
  }, []);

  useEffect(() => {
    if (isMobile) return;
    const check = () => {
      setHasChat(!!document.querySelector('[data-dashboard-home][data-has-chat]'));
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { subtree: true, attributes: true, childList: true, attributeFilter: ['data-has-chat'] });
    return () => observer.disconnect();
  }, [isMobile]);

  useEffect(() => {
    if (hasChat && showBestPractices) setShowBestPractices(false);
  }, [hasChat, showBestPractices]);

  useEffect(() => {
    const handler = () => setShowBestPractices(true);
    window.addEventListener('open-knowledge-hub', handler);
    return () => window.removeEventListener('open-knowledge-hub', handler);
  }, []);

  useEffect(() => {
    if (isMobile) return;

    const open = () => {
      if (hubHidden) return;
      // Não abrir se houver chat em progresso
      if (document.querySelector('[data-dashboard-home][data-has-chat]')) {
        return;
      }
      // Não abrir se houver qualquer popup/modal/dialog aberto
      if (
        document.querySelector('[role="dialog"][data-state="open"]') ||
        document.querySelector('[data-state="open"][role="alertdialog"]') ||
        document.querySelector('[data-radix-popper-content-wrapper]') ||
        document.body.hasAttribute('data-scroll-locked') ||
        document.querySelector('[data-mega-header][data-menu-open="true"]')
      ) {
        return;
      }
      setShowBestPractices((prev) => (prev ? prev : true));
    };

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY > 0) open();
    };

    let touchStartY: number | null = null;
    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0]?.clientY ?? null;
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartY == null) return;
      const y = e.touches[0]?.clientY ?? touchStartY;
      if (touchStartY - y > 20) open();
    };

    const handleScroll = () => {
      const el = document.querySelector('main');
      if (!el) return;
      if (el.scrollTop > 10) open();
    };

    const main = document.querySelector('main');
    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    main?.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      main?.removeEventListener('scroll', handleScroll);
    };
  }, [isMobile, showBestPractices, hubHidden]);

  return (
    <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden">
      <AIAssistantHome />
      
      {!isMobile ? (
        <>
          {/* Aba centralizada inferior — clique para abrir o Knowledge Hub */}
          {!showBestPractices && !hasChat && !hubHidden && (
            <button
              onClick={() => setShowBestPractices(true)}
              title="Knowledge Hub"
              aria-label="Abrir Knowledge Hub"
              className="group fixed bottom-0 left-1/2 -translate-x-1/2 z-[101] flex flex-col items-center"
            >
              <div
                className="flex items-center justify-center w-20 h-7 rounded-t-2xl bg-[hsl(0_0%_100%)] transition-transform duration-300 group-hover:-translate-y-0.5"
              >
                <ChevronDown
                  className="h-4 w-4 rotate-180 animate-bounce-slow text-[hsl(0_0%_0%)]"
                />
              </div>
            </button>
          )}

          {!hasChat && !hubHidden && (
            <BestPracticesPanel 
              isOpen={showBestPractices} 
              onOpenChange={setShowBestPractices} 
            />
          )}
        </>
      ) : (
        !hubHidden && (
          <BestPracticesPanel
            isOpen={showBestPractices}
            onOpenChange={setShowBestPractices}
          />
        )
      )}
    </div>
  );
};

export default Home;
