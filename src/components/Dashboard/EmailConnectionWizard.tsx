import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Mail, 
  Check, 
  ArrowRight, 
  ArrowLeft, 
  Shield, 
  Key, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { useGmail } from '@/hooks/useGmail';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { GOOGLE_OAUTH_ENABLED } from '@/config/featureFlags';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';

const OMNI_COLOR = '#374DA4';

const EmailConnectionWizard = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const { isConnected, loading, emailAccount, connectGmail, disconnectGmail, checkConnection } = useGmail();
  const { toast } = useToast();

  if (!GOOGLE_OAUTH_ENABLED) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-4">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
          style={{ background: `linear-gradient(135deg, ${OMNI_COLOR}, ${OMNI_COLOR}dd)` }}
        >
          <Mail className="h-8 w-8 text-white" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            <h3 className="text-lg font-semibold text-foreground">Conexão de Email</h3>
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" /> Em breve
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            A integração com Gmail estará disponível assim que concluirmos a verificação
            oficial junto ao Google. Enquanto isso, você pode usar os demais recursos
            de email da plataforma.
          </p>
        </div>
      </div>
    );
  }

  const steps = [
    { id: 'intro', title: 'Bem-vindo', description: 'Conecte seu email comercial' },
    { id: 'requirements', title: 'Requisitos', description: 'O que você precisa' },
    { id: 'permissions', title: 'Permissões', description: 'Autorização necessária' },
    { id: 'connect', title: 'Conectar', description: 'Autenticação Google' },
    { id: 'verify', title: 'Verificação', description: 'Confirmar conexão' }
  ];

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleConnect = async () => {
    await connectGmail();
  };

  const renderStepContent = () => {
    switch (steps[currentStep].id) {
      case 'intro':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div 
                className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg"
                style={{ background: `linear-gradient(135deg, ${OMNI_COLOR}, ${OMNI_COLOR}dd)` }}
              >
                <Mail className="h-10 w-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-3">
                Conecte seu Email Comercial
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Integre sua conta Gmail ou Google Workspace para enviar emails 
                profissionais diretamente da plataforma.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              <div className="rounded-2xl p-5 text-center" style={{ backgroundColor: `${OMNI_COLOR}10` }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: `${OMNI_COLOR}20` }}>
                  <Mail className="h-6 w-6" style={{ color: OMNI_COLOR }} />
                </div>
                <h4 className="font-semibold text-foreground mb-1">Envio Direto</h4>
                <p className="text-sm text-muted-foreground">Envie emails sem sair da plataforma</p>
              </div>
              <div className="bg-green-50 dark:bg-green-500/15 dark:bg-green-950/30 rounded-2xl p-5 text-center">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-500/20 dark:bg-green-900/50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Shield className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <h4 className="font-semibold text-foreground mb-1">100% Seguro</h4>
                <p className="text-sm text-muted-foreground">Conexão OAuth2 criptografada</p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-950/30 rounded-2xl p-5 text-center">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="h-6 w-6 text-purple-600" />
                </div>
                <h4 className="font-semibold text-foreground mb-1">Rastreamento</h4>
                <p className="text-sm text-muted-foreground">Acompanhe aberturas e cliques</p>
              </div>
            </div>
          </div>
        );

      case 'requirements':
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-foreground mb-2">Requisitos para Conexão</h2>
              <p className="text-muted-foreground">Verifique se você atende aos requisitos abaixo</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-4 p-5 bg-card rounded-2xl border border-border">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${OMNI_COLOR}15` }}>
                  <Mail className="h-5 w-5" style={{ color: OMNI_COLOR }} />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground mb-1">Conta Google/Gmail</h4>
                  <p className="text-sm text-muted-foreground">Gmail pessoal ou Google Workspace.</p>
                </div>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>

              <div className="flex items-start gap-4 p-5 bg-card rounded-2xl border border-border">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Key className="h-5 w-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground mb-1">Acesso à Conta</h4>
                  <p className="text-sm text-muted-foreground">Tenha suas credenciais em mãos.</p>
                </div>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
            </div>
          </div>
        );

      case 'permissions':
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-foreground mb-2">Permissões Necessárias</h2>
              <p className="text-muted-foreground">Entenda quais permissões serão solicitadas</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-4 p-5 bg-card rounded-2xl border border-border">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${OMNI_COLOR}15` }}>
                  <Mail className="h-5 w-5" style={{ color: OMNI_COLOR }} />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-foreground">Ler emails</h4>
                  <p className="text-sm text-muted-foreground">Para sincronizar sua caixa</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: `${OMNI_COLOR}15`, color: OMNI_COLOR }}>
                  Leitura
                </span>
              </div>

              <div className="flex items-center gap-4 p-5 bg-card rounded-2xl border border-border">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-500/20 dark:bg-green-900/50 rounded-xl flex items-center justify-center">
                  <ArrowRight className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-foreground">Enviar emails</h4>
                  <p className="text-sm text-muted-foreground">Para enviar em seu nome</p>
                </div>
                <span className="text-xs bg-green-100 dark:bg-green-500/20 text-green-700 px-2 py-1 rounded-full">Envio</span>
              </div>
            </div>

            <div className="bg-green-50 dark:bg-green-500/15 dark:bg-green-950/30 rounded-2xl p-5">
              <div className="flex gap-3">
                <Shield className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-green-800 dark:text-green-200 mb-1">Sua Privacidade</h4>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Não armazenamos senhas. OAuth2 seguro do Google.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'connect':
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-foreground mb-2">Conectar com Google</h2>
              <p className="text-muted-foreground">Clique no botão para autorizar</p>
            </div>

            {isConnected ? (
              <div className="text-center space-y-6">
                <div className="w-20 h-20 bg-green-100 dark:bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Email Conectado!</h3>
                  <p className="text-muted-foreground mb-4">{emailAccount?.provider_email}</p>
                  <Button variant="outline" onClick={disconnectGmail} className="text-red-600 dark:text-red-400 border-red-200 hover:bg-red-50 rounded-xl">
                    Desconectar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-card rounded-2xl p-6">
                  <h4 className="font-semibold text-foreground mb-4">Passo a Passo:</h4>
                  <ol className="space-y-3">
                    {['Clique em "Conectar com Google"', 'Selecione sua conta', 'Aceite as permissões', 'Aguarde o redirecionamento'].map((step, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0" 
                          style={{ backgroundColor: `${OMNI_COLOR}15`, color: OMNI_COLOR }}>
                          {idx + 1}
                        </span>
                        <span className="text-sm text-muted-foreground">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="flex justify-center">
                  <Button
                    size="lg"
                    onClick={handleConnect}
                    disabled={loading}
                    className="text-white px-8 py-6 text-lg rounded-2xl shadow-lg transition-all hover:scale-105"
                    style={{ background: `linear-gradient(135deg, ${OMNI_COLOR}, ${OMNI_COLOR}dd)` }}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Conectando...
                      </>
                    ) : (
                      <>
                        <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                          <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Conectar com Google
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        );

      case 'verify':
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-foreground mb-2">Verificação</h2>
              <p className="text-muted-foreground">Confirme se tudo está funcionando</p>
            </div>

            {isConnected ? (
              <div className="space-y-6">
                <div className="bg-green-50 dark:bg-green-500/15 dark:bg-green-950/30 rounded-2xl p-8 text-center">
                  <CheckCircle2 className="h-16 w-16 text-green-600 dark:text-green-400 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-green-800 dark:text-green-200 mb-2">Conexão Verificada!</h3>
                  <p className="text-green-700 dark:text-green-300 mb-4">Seu email está pronto.</p>
                  <div className="inline-flex items-center gap-2 bg-white dark:bg-card dark:bg-gray-800 px-4 py-2 rounded-xl border border-green-200">
                    <Mail className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <span className="font-medium text-foreground">{emailAccount?.provider_email}</span>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground">Você pode começar a enviar emails!</p>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-6">
                <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
                  <AlertCircle className="h-10 w-10 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Email não conectado</h3>
                  <p className="text-muted-foreground mb-4">Volte ao passo anterior.</p>
                  <Button onClick={() => setCurrentStep(3)} className="rounded-xl text-white" style={{ backgroundColor: OMNI_COLOR }}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Voltar
                  </Button>
                </div>
                <Button variant="outline" onClick={checkConnection} className="rounded-xl">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Verificar Novamente
                </Button>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Progress Header */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-6">
          {steps.map((step, index) => (
            <div key={step.id} className={cn("flex items-center", index < steps.length - 1 && "flex-1")}>
              <div 
                className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs transition-all shadow-sm border border-border/40",
                  index < currentStep ? "bg-green-500 text-white border-green-500" : index === currentStep ? "text-white shadow-lg" : "bg-white dark:bg-card dark:bg-white/5 text-muted-foreground"
                )}
                style={index === currentStep ? { backgroundColor: OMNI_COLOR, borderColor: OMNI_COLOR } : {}}
              >
                {index < currentStep ? <Check className="h-5 w-5" strokeWidth={3} /> : index + 1}
              </div>
              {index < steps.length - 1 && (
                <div className={cn("flex-1 h-[2px] mx-3 rounded-full transition-all", index < currentStep ? "bg-green-500" : "bg-border/40")} />
              )}
            </div>
          ))}
        </div>
        <div className="text-center space-y-1">
          <h3 className="text-lg font-bold text-foreground tracking-tight">{steps[currentStep].title}</h3>
          <p className="text-sm text-muted-foreground">{steps[currentStep].description}</p>
        </div>
      </div>

      {/* Content Card */}
      <div className="bg-gray-50/50 dark:bg-white/5 dark:bg-white/5 rounded-3xl border border-border/40 p-8 min-h-[200px] flex flex-col justify-center">
        {renderStepContent()}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8">
        {currentStep === 0 ? (
          <>
            <div />
            <Button 
              onClick={nextStep}
              className="rounded-2xl text-white h-12 px-8 font-bold shadow-lg shadow-[#374DA4]/20 hover:shadow-[#374DA4]/30 transition-all"
              style={{ backgroundColor: OMNI_COLOR }}
            >
              Começar agora
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={prevStep} className="rounded-2xl h-12 px-6 font-medium text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>

            {currentStep < steps.length - 1 ? (
              <Button 
                onClick={nextStep}
                className="rounded-2xl text-white h-12 px-8 font-bold shadow-lg shadow-[#374DA4]/20 hover:shadow-[#374DA4]/30 transition-all"
                style={{ backgroundColor: OMNI_COLOR }}
              >
                Próximo passo
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : isConnected ? (
              <Button 
                className="bg-green-500 hover:bg-green-600 text-white rounded-2xl h-12 px-8 font-bold shadow-lg shadow-green-500/20 transition-all"
                onClick={() => window.location.reload()}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Finalizar
              </Button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
};

export default EmailConnectionWizard;
