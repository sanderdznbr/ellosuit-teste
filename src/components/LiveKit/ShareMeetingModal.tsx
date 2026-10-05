import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Mail, MessageSquare, Share2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ShareMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomName: string;
}

const ShareMeetingModal: React.FC<ShareMeetingModalProps> = ({
  isOpen,
  onClose,
  roomName
}) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  
  const meetingLink = `https://www.ellosuit.app/meet/${roomName}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(meetingLink);
      setCopied(true);
      toast({
        title: "Link copiado!",
        description: "O link foi copiado para a área de transferência.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível copiar o link.",
        variant: "destructive",
      });
    }
  };

  const shareViaEmail = () => {
    const subject = encodeURIComponent(`Convite para reunião - ${roomName}`);
    const body = encodeURIComponent(`Você foi convidado para participar da reunião "${roomName}"\n\nClique no link para entrar: ${meetingLink}`);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  const shareViaWhatsApp = () => {
    const message = encodeURIComponent(`Você foi convidado para a reunião "${roomName}"\n\nLink: ${meetingLink}`);
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const shareGeneric = () => {
    if (navigator.share) {
      navigator.share({
        title: `Reunião ${roomName}`,
        text: `Você foi convidado para participar da reunião "${roomName}"`,
        url: meetingLink,
      });
    } else {
      copyToClipboard();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-[#1a1a1a] border-gray-700 text-white rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-white">
            Compartilhar Reunião
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Convide outras pessoas para participar da reunião
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Meeting Link */}
          <div className="space-y-2">
            <Label htmlFor="meeting-link" className="text-sm font-medium text-gray-300">
              Link da Reunião
            </Label>
            <div className="flex gap-2">
              <Input
                id="meeting-link"
                value={meetingLink}
                readOnly
                className="flex-1 bg-[#2a2a2a] border-gray-600 text-white"
              />
                <Button
                  onClick={copyToClipboard}
                  size="sm"
                  className="bg-primary hover:bg-primary/90 text-white"
                >
                  <Copy className="h-4 w-4" />
                </Button>
            </div>
          </div>

          {/* Quick Share Options */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-300">
              Compartilhar via
            </Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                onClick={() => shareViaEmail()}
                variant="outline"
                className="flex flex-col items-center p-4 h-auto bg-[#2a2a2a] border-gray-600 hover:bg-[#333333] text-white"
              >
                <Mail className="h-5 w-5 mb-1" />
                <span className="text-xs">Email</span>
              </Button>
              <Button
                onClick={() => shareViaWhatsApp()}
                variant="outline"
                className="flex flex-col items-center p-4 h-auto bg-[#2a2a2a] border-gray-600 hover:bg-[#333333] text-white"
              >
                <MessageSquare className="h-5 w-5 mb-1" />
                <span className="text-xs">WhatsApp</span>
              </Button>
              <Button
                onClick={() => shareGeneric()}
                variant="outline"
                className="flex flex-col items-center p-4 h-auto bg-[#2a2a2a] border-gray-600 hover:bg-[#333333] text-white"
              >
                <Share2 className="h-5 w-5 mb-1" />
                <span className="text-xs">Outros</span>
              </Button>
            </div>
          </div>

          {/* Meeting Info */}
          <div className="space-y-2 p-3 bg-[#2a2a2a] rounded-lg border border-gray-700">
            <div className="text-sm text-gray-400">
              <strong className="text-white">Sala:</strong> {roomName}
            </div>
            <div className="text-sm text-gray-400">
              <strong className="text-white">Início:</strong> Agora
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <Button
            onClick={onClose}
            variant="outline"
            className="bg-[#2a2a2a] border-gray-600 text-white hover:bg-[#333333]"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareMeetingModal;