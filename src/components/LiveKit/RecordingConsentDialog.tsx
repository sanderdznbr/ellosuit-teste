import React, { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface RecordingConsentDialogProps {
  isOpen: boolean;
  onConsent: () => void;
  onReject: () => void;
  roomId: string;
  participantName: string;
}

const RecordingConsentDialog: React.FC<RecordingConsentDialogProps> = ({
  isOpen,
  onConsent,
  onReject,
  roomId,
  participantName,
}) => {
  const { toast } = useToast();
  const [hasResponded, setHasResponded] = useState(false);

  const handleConsent = async () => {
    if (hasResponded) return;
    setHasResponded(true);

    try {
      // Registrar consentimento no banco
      await supabase
        .from('recording_consents')
        .insert({
          room_id: roomId,
          participant_name: participantName,
          consented: true,
        });

      toast({
        title: "Consentimento registrado",
        description: "Você autorizou a gravação desta reunião",
      });

      onConsent();
    } catch (error) {
      console.error('Erro ao registrar consentimento:', error);
      setHasResponded(false);
    }
  };

  const handleReject = async () => {
    if (hasResponded) return;
    setHasResponded(true);

    try {
      // Registrar rejeição no banco
      await supabase
        .from('recording_consents')
        .insert({
          room_id: roomId,
          participant_name: participantName,
          consented: false,
        });

      toast({
        title: "Gravação negada",
        description: "Você não autorizou a gravação desta reunião",
        variant: "destructive",
      });

      onReject();
    } catch (error) {
      console.error('Erro ao registrar rejeição:', error);
      setHasResponded(false);
    }
  };

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="rounded-2xl max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl flex items-center gap-2">
            🔴 Solicitação de Gravação
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base">
            O anfitrião iniciou a gravação desta reunião.
            <br />
            <br />
            <strong>Você concorda em ser gravado?</strong>
            <br />
            <br />
            <span className="text-sm text-muted-foreground">
              Se você não concordar, a reunião não será gravada e todos os participantes serão notificados.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel 
            onClick={handleReject}
            disabled={hasResponded}
            className="rounded-xl"
          >
            Não concordo
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConsent}
            disabled={hasResponded}
            className="bg-green-600 hover:bg-green-700 rounded-xl"
          >
            Sim, concordo
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default RecordingConsentDialog;
