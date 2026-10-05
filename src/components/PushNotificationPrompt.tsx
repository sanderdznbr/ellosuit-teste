import React, { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOneSignal } from '@/hooks/useOneSignal';
import { useAuth } from '@/hooks/useAuth';

export function PushNotificationPrompt() {
  const { permission, ready, requestPermission } = useOneSignal();
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show if: user is logged in, OneSignal is ready, permission not granted/denied, not dismissed
    if (!user || !ready || permission !== 'default' || dismissed) {
      setVisible(false);
      return;
    }
    // Check if user already dismissed recently (24h)
    const lastDismissed = localStorage.getItem('push_prompt_dismissed');
    if (lastDismissed && Date.now() - Number(lastDismissed) < 24 * 60 * 60 * 1000) {
      setVisible(false);
      return;
    }
    // Show after a short delay
    const timer = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(timer);
  }, [user, ready, permission, dismissed]);

  const handleAllow = async () => {
    await requestPermission();
    setVisible(false);
  };

  const handleDismiss = () => {
    setDismissed(true);
    setVisible(false);
    localStorage.setItem('push_prompt_dismissed', String(Date.now()));
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="fixed bottom-24 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-[380px] z-[100] pointer-events-auto"
        >
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-5 backdrop-blur-xl">
            <button
              onClick={handleDismiss}
              className="absolute top-3 right-3 p-1 rounded-full hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                <Bell className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground text-[15px] leading-tight mb-1">
                  Ativar notificações
                </h3>
                <p className="text-muted-foreground text-sm leading-snug">
                  Receba alertas sobre eventos, tarefas e mensagens em tempo real.
                </p>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={handleDismiss}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                Agora não
              </button>
              <button
                onClick={handleAllow}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Permitir
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
