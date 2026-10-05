import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { APP_CONFIG } from '@/config/app';

interface InviteUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
  onNavigateSameTab?: (url: string) => void;
}

const InviteUsersModal: React.FC<InviteUsersModalProps> = ({
  isOpen,
  onClose,
  roomCode,
  onNavigateSameTab,
}) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  
  const meetingLink = APP_CONFIG.getMeetingUrl(roomCode);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(meetingLink);
      setCopied(true);
      console.log("Link copiado para o clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Erro ao copiar link");
    }
  };

  const shareOnWhatsApp = () => {
    const text = encodeURIComponent(`Junte-se à reunião: ${meetingLink}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const shareOnGmail = () => {
    const subject = encodeURIComponent('Convite para reunião');
    const body = encodeURIComponent(`Olá!\n\nVocê foi convidado para participar de uma reunião.\n\nClique no link abaixo para entrar:\n${meetingLink}\n\nAté logo!`);
    window.open(`https://mail.google.com/mail/?view=cm&su=${subject}&body=${body}`, '_blank');
  };

  const shareOnTelegram = () => {
    const text = encodeURIComponent(`Junte-se à reunião: ${meetingLink}`);
    window.open(`https://t.me/share/url?url=${meetingLink}&text=${text}`, '_blank');
  };

  const goToMeeting = () => {
    const meetingPath = `/meet/${roomCode}`;
    if (onNavigateSameTab) {
      onNavigateSameTab(meetingPath);
    } else {
      window.location.href = meetingPath;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Convidar usuários</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Compartilhe este link para convidar pessoas para a reunião:
          </p>
          <div className="flex items-center gap-2">
            <Input
              value={meetingLink}
              readOnly
              className="flex-1"
            />
            <Button
              onClick={handleCopy}
              size="icon"
              variant="outline"
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Share Buttons */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Compartilhar via:</p>
            <div className="flex gap-2">
              {/* WhatsApp */}
              <Button
                onClick={shareOnWhatsApp}
                className="flex-1 gap-2"
                style={{ backgroundColor: '#25D366' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" fill="white"/>
                </svg>
                WhatsApp
              </Button>

              {/* Gmail */}
              <Button
                onClick={shareOnGmail}
                className="flex-1 gap-2"
                style={{ backgroundColor: '#EA4335' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" fill="white"/>
                </svg>
                Gmail
              </Button>

              {/* Telegram */}
              <Button
                onClick={shareOnTelegram}
                className="flex-1 gap-2"
                style={{ backgroundColor: '#0088cc' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" fill="white"/>
                </svg>
                Telegram
              </Button>
            </div>
          </div>

          <div className="flex justify-between items-center gap-2 pt-2">
            <Button 
              onClick={goToMeeting} 
              className="flex-1 gap-2 bg-[#374DA4] hover:bg-[#374DA4]/90"
            >
              <ExternalLink className="h-4 w-4" />
              Ir para reunião agora
            </Button>
            <Button onClick={onClose} style={{ backgroundColor: '#374DA4' }}>
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InviteUsersModal;
