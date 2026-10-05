
import React from 'react';
import { Settings, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MobileModal from '@/components/ui/mobile-modal';
import { cn } from '@/lib/utils';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActivateNotifications: () => void;
  isRegistered: boolean;
  isRegistering: boolean;
  permissionStatus: 'prompt' | 'granted' | 'denied';
  isIOSWebView: boolean;
}

const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  isOpen,
  onClose,
  onActivateNotifications,
  isRegistered,
  isRegistering,
  permissionStatus,
  isIOSWebView
}) => {
  const getButtonText = () => {
    if (isRegistering) return 'Ativando...';
    if (isRegistered) return 'Testar Notificação';
    if (permissionStatus === 'denied') return 'Configurar nas Definições';
    return 'Ativar Notificações';
  };

  const getButtonStyle = () => {
    if (isRegistered) {
      return "bg-green-500 hover:bg-green-600 text-white";
    }
    if (permissionStatus === 'denied') {
      return "bg-red-500 hover:bg-red-600 text-white";
    }
    return "bg-[#374DA4] hover:bg-[#2F428D] text-white";
  };

  const getStatusMessage = () => {
    if (!isIOSWebView) {
      return "Para receber notificações push, use o app iOS nativo";
    }
    if (isRegistered) {
      return "Notificações ativas! Toque em 'Testar' para verificar";
    }
    if (permissionStatus === 'denied') {
      return "Vá em Configurações > Notificações > [Nome do App] e ative as notificações";
    }
    return "Ative as notificações para receber lembretes mesmo quando o app estiver fechado";
  };

  return (
    <MobileModal
      isOpen={isOpen}
      onClose={onClose}
      title="Configurações de Notificações"
      size="md"
    >
      <div className="px-6 pb-6 space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#DFE4FB] rounded-full flex items-center justify-center mx-auto mb-4">
            <Bell className="h-8 w-8 text-[#2F428D]" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Notificações Push
          </h3>
          <p className="text-gray-600 text-sm">
            {getStatusMessage()}
          </p>
        </div>

        <div className="space-y-4">
          <div className="bg-gray-50 rounded-xl p-4">
            <h4 className="font-medium text-gray-900 mb-2">Status Atual</h4>
            <div className="flex items-center space-x-2">
              <div className={cn(
                "w-3 h-3 rounded-full",
                isRegistered ? "bg-green-500" : 
                permissionStatus === 'denied' ? "bg-red-500" : "bg-yellow-500"
              )} />
              <span className="text-sm text-gray-700">
                {isRegistered ? 'Ativo' : 
                 permissionStatus === 'denied' ? 'Desativado' : 'Pendente'}
              </span>
            </div>
          </div>

          {isIOSWebView && (
            <div className="bg-[#F0F2FE] border border-[#B3BFF0] rounded-xl p-4">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-[#2F428D]">🍎</span>
                <span className="text-sm font-medium text-[#1A2551]">App iOS Detectado</span>
              </div>
              <p className="text-xs text-[#253573]">
                Notificações push nativas disponíveis
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl"
          >
            Fechar
          </Button>
          <Button
            onClick={onActivateNotifications}
            disabled={isRegistering}
            className={cn(
              "flex-1 py-3 rounded-xl font-medium transition-all",
              getButtonStyle()
            )}
          >
            {getButtonText()}
          </Button>
        </div>
      </div>
    </MobileModal>
  );
};

export default NotificationSettingsModal;
