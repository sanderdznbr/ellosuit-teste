import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, Zap } from 'lucide-react';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface CalendarIntegrationsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const GoogleCalendarLogo = () => (
  <img
    src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg"
    alt="Google Calendar"
    className="h-10 w-10"
    loading="lazy"
  />
);

const AUTOMATION_KEY = (userId?: string) => `calendar-google-auto-sync-${userId || 'anon'}`;

export const CalendarIntegrationsModal: React.FC<CalendarIntegrationsModalProps> = ({ open, onOpenChange }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isConnected, connectGoogle, disconnectGoogle, loading } = useGoogleCalendar();
  const [automationEnabled, setAutomationEnabled] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const stored = localStorage.getItem(AUTOMATION_KEY(user.id));
    setAutomationEnabled(stored === null ? isConnected : stored === 'true');
  }, [user?.id, isConnected]);

  const toggleAutomation = (enabled: boolean) => {
    if (!isConnected && enabled) {
      toast({
        title: 'Conecte primeiro',
        description: 'Conecte o Google Calendar antes de ativar a automação.',
        variant: 'destructive',
      });
      return;
    }
    setAutomationEnabled(enabled);
    if (user?.id) {
      localStorage.setItem(AUTOMATION_KEY(user.id), String(enabled));
    }
    toast({
      title: enabled ? 'Automação ativada' : 'Automação desativada',
      description: enabled
        ? 'Eventos do Google Calendar serão sincronizados automaticamente.'
        : 'A sincronização automática foi pausada.',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Integrações da agenda</DialogTitle>
          <DialogDescription>
            Vincule canais externos à sua agenda e ative a sincronização automática.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-3">
          {/* Google Calendar Card */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start gap-4">
              <div className="shrink-0 rounded-xl bg-background p-1 ring-1 ring-border/60">
                <GoogleCalendarLogo />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-semibold text-foreground truncate">Google Calendar</h4>
                  {isConnected && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400 px-2 py-0.5 text-[10px] font-semibold">
                      <CheckCircle2 className="h-3 w-3" /> Conectado
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Sincronize eventos, criações e alterações em tempo real com seu Google Calendar.
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {isConnected ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => disconnectGoogle()}
                      disabled={loading}
                      className="rounded-full"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Desconectar'}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => connectGoogle()}
                      disabled={loading}
                      className="rounded-full"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Conectar'}
                    </Button>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    <div>
                      <div className="text-xs font-semibold text-foreground">Automação de sincronização</div>
                      <div className="text-[11px] text-muted-foreground">Importa novos eventos automaticamente</div>
                    </div>
                  </div>
                  <Switch
                    checked={automationEnabled && isConnected}
                    onCheckedChange={toggleAutomation}
                    disabled={!isConnected}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Placeholder for future integrations */}
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-center">
            <p className="text-xs text-muted-foreground">
              Mais integrações em breve: Outlook, Apple Calendar, Zoom e mais.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CalendarIntegrationsModal;