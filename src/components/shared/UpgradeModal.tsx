import React from 'react';
import { ArrowRight, X, Sparkles, Users, HardDrive, MessageCircle, Bot, Calendar, Mail } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import type { ResourceType } from '@/hooks/useSubscription';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  resource?: ResourceType;
  currentUsage?: number;
  maxLimit?: number;
}

const resourceConfig: Record<ResourceType, {
  title: string;
  description: string;
  icon: React.ElementType;
  addonName: string;
  addonPrice: number;
  addonUnit: string;
}> = {
  users: {
    title: 'Limite de Usuários Atingido',
    description: 'Adicione mais usuários à sua equipe para continuar crescendo.',
    icon: Users,
    addonName: 'Usuário adicional',
    addonPrice: 29,
    addonUnit: 'usuário',
  },
  storage_gb: {
    title: 'Armazenamento Cheio',
    description: 'Expanda seu espaço no Drive para armazenar mais arquivos.',
    icon: HardDrive,
    addonName: 'Armazenamento extra',
    addonPrice: 19,
    addonUnit: '10 GB',
  },
  emails_sent: {
    title: 'Créditos de Email Esgotados',
    description: 'Compre mais créditos para continuar suas campanhas de email.',
    icon: Mail,
    addonName: 'Créditos de email',
    addonPrice: 29,
    addonUnit: '2.000 emails',
  },
  ai_agents_active: {
    title: 'Limite de Agentes de IA',
    description: 'Adicione mais agentes de IA para automatizar seu atendimento.',
    icon: Bot,
    addonName: 'Agente de IA',
    addonPrice: 39,
    addonUnit: 'agente',
  },
  whatsapp_sessions_active: {
    title: 'Limite de WhatsApp CRM',
    description: 'Adicione mais sessões de WhatsApp para gerenciar múltiplos números.',
    icon: MessageCircle,
    addonName: 'Sessão WhatsApp',
    addonPrice: 67,
    addonUnit: 'sessão',
  },
  booking_links_active: {
    title: 'Limite de Agendas Online',
    description: 'Crie mais links de agendamento para sua equipe.',
    icon: Calendar,
    addonName: 'Agenda Online',
    addonPrice: 19,
    addonUnit: 'agenda',
  },
  meeting_hours_used: {
    title: 'Horas de Gravação Esgotadas',
    description: 'Compre mais horas para gravar suas reuniões.',
    icon: Sparkles,
    addonName: 'Gravação extra',
    addonPrice: 49,
    addonUnit: '10 horas',
  },
  tracked_docs_created: {
    title: 'Limite de Documentos Rastreados',
    description: 'Aumente seu limite para rastrear mais documentos.',
    icon: Sparkles,
    addonName: 'Docs rastreados',
    addonPrice: 29,
    addonUnit: '100 docs',
  },
  tracked_links_created: {
    title: 'Limite de Links Rastreados',
    description: 'Aumente seu limite para rastrear mais links.',
    icon: Sparkles,
    addonName: 'Links rastreados',
    addonPrice: 29,
    addonUnit: '100 links',
  },
  tracked_videos_created: {
    title: 'Limite de Vídeos Rastreados',
    description: 'Aumente seu limite para rastrear mais vídeos.',
    icon: Sparkles,
    addonName: 'Vídeos rastreados',
    addonPrice: 29,
    addonUnit: '50 vídeos',
  },
};

export function UpgradeModal({ isOpen, onClose, resource, currentUsage, maxLimit }: UpgradeModalProps) {
  const navigate = useNavigate();
  
  const config = resource ? resourceConfig[resource] : null;
  const Icon = config?.icon || Sparkles;

  const handleUpgrade = () => {
    onClose();
    navigate('/dashboard/assinatura');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-xl bg-primary/10">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle>{config?.title || 'Limite Atingido'}</DialogTitle>
              {currentUsage !== undefined && maxLimit !== undefined && (
                <Badge variant="secondary" className="mt-1">
                  {currentUsage}/{maxLimit} utilizados
                </Badge>
              )}
            </div>
          </div>
          <DialogDescription>
            {config?.description || 'Faça upgrade do seu plano para continuar.'}
          </DialogDescription>
        </DialogHeader>

        {config && (
          <div className="my-4 p-4 rounded-lg bg-muted/50 border">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">{config.addonName}</p>
                <p className="text-sm text-muted-foreground">Por {config.addonUnit}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">R$ {config.addonPrice}</p>
                <p className="text-sm text-muted-foreground">/mês</p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={handleUpgrade} className="w-full">
            Ver Opções de Upgrade
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
          <Button variant="ghost" onClick={onClose} className="w-full">
            Agora Não
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
