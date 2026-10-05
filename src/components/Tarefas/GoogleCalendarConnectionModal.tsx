import React from 'react';
import { X, Calendar, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { GOOGLE_OAUTH_ENABLED } from '@/config/featureFlags';

interface GoogleCalendarConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GoogleCalendarConnectionModal: React.FC<GoogleCalendarConnectionModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { connectGoogleCalendar, loading, isConnected } = useGoogleCalendar();

  if (!isOpen) return null;

  // Enquanto a verificação do Google não estiver concluída, não exibimos
  // o prompt de conexão para evitar a tela de "app não verificado".
  if (!GOOGLE_OAUTH_ENABLED) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('google-calendar-modal-shown', 'true');
    }
    return null;
  }

  const handleConnect = async () => {
    try {
      await connectGoogleCalendar();
      // Close modal and mark as connected
      localStorage.setItem('google-calendar-modal-shown', 'true');
      onClose();
    } catch (error) {
      console.error('Erro ao conectar Google Calendar:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 relative">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-[#DFE4FB] rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="h-8 w-8 text-[#2F428D]" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Conecte seu Google Calendar
          </h2>
          <p className="text-gray-600 text-sm">
            Para criar reuniões com Google Meet automaticamente, conecte sua conta Google.
          </p>
        </div>

        {/* Benefits */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center space-x-3">
            <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
            <span className="text-sm text-gray-700">Criação automática de links Google Meet</span>
          </div>
          <div className="flex items-center space-x-3">
            <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
            <span className="text-sm text-gray-700">Sincronização de eventos em tempo real</span>
          </div>
          <div className="flex items-center space-x-3">
            <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
            <span className="text-sm text-gray-700">Convites automáticos para participantes</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="space-y-3">
          <Button
            onClick={handleConnect}
            disabled={loading}
            className="w-full bg-[#2F428D] hover:bg-[#253573] text-white"
          >
            {loading ? 'Conectando...' : 'Conectar Google Calendar'}
          </Button>
          
          <Button
            onClick={onClose}
            variant="outline"
            className="w-full"
          >
            Conectar depois
          </Button>
        </div>

        {/* Footer */}
        <div className="text-center mt-4">
          <p className="text-xs text-gray-500">
            Você pode desconectar a qualquer momento nas configurações
          </p>
        </div>
      </div>
    </div>
  );
};

export default GoogleCalendarConnectionModal;