import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTTSAccessibility } from '@/hooks/useTTSAccessibility';
import { toast } from '@/hooks/use-toast';

const TTSAccessibilityFAB: React.FC = () => {
  const { ttsEnabled, toggleTTS } = useTTSAccessibility();

  const handleToggle = () => {
    toggleTTS();
    toast({
      title: !ttsEnabled ? '🔊 Voz ativada' : '🔇 Voz desativada',
      description: !ttsEnabled
        ? 'As respostas do assistente serão lidas em voz alta.'
        : 'As respostas do assistente não serão mais lidas.',
    });
  };

  return (
    <motion.button
      onClick={handleToggle}
      className="fixed bottom-24 right-4 z-50 flex items-center justify-center w-12 h-12 rounded-full shadow-lg transition-colors md:bottom-6"
      style={{
        background: ttsEnabled
          ? 'hsl(var(--primary))'
          : 'hsl(var(--muted))',
        color: ttsEnabled
          ? 'hsl(var(--primary-foreground))'
          : 'hsl(var(--muted-foreground))',
      }}
      whileTap={{ scale: 0.9 }}
      whileHover={{ scale: 1.1 }}
      title={ttsEnabled ? 'Desativar voz' : 'Ativar voz (acessibilidade)'}
      aria-label={ttsEnabled ? 'Desativar leitura em voz alta' : 'Ativar leitura em voz alta'}
    >
      <AnimatePresence mode="wait">
        {ttsEnabled ? (
          <motion.div key="on" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
            <Volume2 className="h-5 w-5" />
          </motion.div>
        ) : (
          <motion.div key="off" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
            <VolumeX className="h-5 w-5" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
};

export default TTSAccessibilityFAB;
