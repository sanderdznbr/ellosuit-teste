import { Lock, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useSubscription, type ModuleType } from '@/hooks/useSubscription';

const moduleInfo: Record<ModuleType, { name: string; color: string; description: string }> = {
  omni: {
    name: 'Ellosuit Omni',
    color: '#374DA4',
    description: 'CRM WhatsApp, Email Marketing, Agentes de IA e mais',
  },
  flow: {
    name: 'Ellosuit Flow',
    color: '#007DE3',
    description: 'Agenda, Tarefas, Videoconferência, Fluxos de Trabalho e mais',
  },
  track: {
    name: 'Ellosuit Track',
    color: '#2ECC71',
    description: 'Rastreamento de Documentos, Links e Emails',
  },
  suite: {
    name: 'Ellosuit Suite',
    color: '#374DA4',
    description: 'Cadastros, Drive, Equipe, Contratos, Propostas, Recibos e Analytics',
  },
};

interface LockedFeaturePageProps {
  module: ModuleType;
  children?: React.ReactNode;
}

export default function LockedFeaturePage({ module, children }: LockedFeaturePageProps) {
  const navigate = useNavigate();
  const { isFree, isTrialExpired, trialEndsAt } = useSubscription();
  const info = moduleInfo[module];

  const getMessage = () => {
    if (isFree) {
      return 'Você está no plano gratuito. Ative o plano Business para desbloquear todas as funcionalidades com 7 dias de teste grátis.';
    }
    if (isTrialExpired) {
      return 'Seu período de teste gratuito terminou. Ative um plano para continuar usando este módulo.';
    }
    return 'Este módulo não está incluído no seu plano atual. Faça upgrade para acessar.';
  };

  const getButtonAction = () => {
    if (isFree) {
      return { label: 'Ativar Teste Grátis', path: '/checkout/ativar' };
    }
    return { label: 'Ver Planos e Preços', path: '/dashboard/assinatura' };
  };

  const action = getButtonAction();

  return (
    <div className="relative min-h-[80vh]">
      {/* Blurred preview of the actual content */}
      {children && (
        <div className="pointer-events-none select-none" style={{ filter: 'blur(4px)', opacity: 0.5 }}>
          {children}
        </div>
      )}

      {/* Lock overlay */}
      <div className={`${children ? 'absolute inset-0' : ''} flex items-center justify-center p-6 z-10`}>
        <div className="max-w-md w-full text-center space-y-6 bg-background/95 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-border">
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto"
            style={{ backgroundColor: `${info.color}12` }}
          >
            <Lock className="h-10 w-10" style={{ color: info.color }} />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">{info.name}</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">{getMessage()}</p>
          </div>

          <div className="bg-muted rounded-2xl p-4 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4" style={{ color: info.color }} />
              <span className="text-sm font-medium text-foreground">O que está incluído:</span>
            </div>
            <p className="text-sm text-muted-foreground">{info.description}</p>
          </div>

          {isTrialExpired && trialEndsAt && (
            <p className="text-xs text-muted-foreground">
              Teste expirou em {trialEndsAt.toLocaleDateString('pt-BR')}
            </p>
          )}

          <div className="space-y-3">
            <Button
              onClick={() => navigate(action.path)}
              className="w-full"
              style={{ backgroundColor: info.color }}
            >
              {action.label}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate('/dashboard')}
              className="w-full text-muted-foreground"
            >
              Voltar ao Dashboard
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
