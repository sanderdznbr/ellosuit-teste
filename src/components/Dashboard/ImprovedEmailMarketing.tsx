import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Mail, 
  CheckCircle2, 
  ArrowRight, 
  Send, 
  Users, 
  FileText, 
  BarChart3,
  Zap,
  Clock,
  Target,
  Sparkles,
  Play,
  PlusCircle,
  TrendingUp,
  Eye,
  MousePointer,
  AlertCircle
} from 'lucide-react';
import { useGmail } from '@/hooks/useGmail';
import EmailConnectionWizard from './EmailConnectionWizard';
import EmailComposer from './EmailComposer';
import MailTracking from './MailTracking';
import CampaignMail from './CampaignMail';
import EmailTemplates from './EmailTemplates';
import { cn } from '@/lib/utils';

// Journey Steps
const JOURNEY_STEPS = [
  {
    id: 'connect',
    title: 'Conectar Email',
    description: 'Conecte sua conta Gmail ou Google Workspace',
    icon: Mail,
    status: 'pending' as const,
  },
  {
    id: 'templates',
    title: 'Criar Templates',
    description: 'Crie modelos de email para usar nas campanhas',
    icon: FileText,
    status: 'pending' as const,
  },
  {
    id: 'campaigns',
    title: 'Lançar Campanhas',
    description: 'Envie emails em massa para seus contatos',
    icon: Send,
    status: 'pending' as const,
  },
  {
    id: 'track',
    title: 'Acompanhar Resultados',
    description: 'Monitore aberturas, cliques e conversões',
    icon: BarChart3,
    status: 'pending' as const,
  },
];

const ImprovedEmailMarketing: React.FC = () => {
  const { isConnected, emailAccount } = useGmail();
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // Calculate journey progress
  const completedSteps = isConnected ? 1 : 0;
  const progress = (completedSteps / JOURNEY_STEPS.length) * 100;

  // Quick Stats (mock data)
  const stats = {
    sent: 156,
    opened: 89,
    clicked: 34,
    openRate: 57,
    clickRate: 22,
  };

  const renderJourneySection = () => (
    <div className="space-y-6">
      {/* Progress Header */}
      <Card className="border-0 shadow-sm bg-gradient-to-r from-[#2F428D] to-indigo-600 text-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">Sua Jornada de Email Marketing</h2>
              <p className="text-[#DFE4FB] text-sm">Complete os passos para começar a enviar emails</p>
            </div>
            <div className="text-right">
              <span className="text-3xl font-bold">{Math.round(progress)}%</span>
              <p className="text-xs text-[#DFE4FB]">Completo</p>
            </div>
          </div>
          <Progress value={progress} className="h-2 bg-[#5A74D1]" />
        </CardContent>
      </Card>

      {/* Journey Steps */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {JOURNEY_STEPS.map((step, index) => {
          const Icon = step.icon;
          const isCompleted = (step.id === 'connect' && isConnected);
          const isActive = !isCompleted && (index === 0 || (JOURNEY_STEPS[index - 1].id === 'connect' && isConnected));
          
          return (
            <Card
              key={step.id}
              className={cn(
                "border cursor-pointer transition-all hover:shadow-md",
                isCompleted && "bg-green-50 border-green-200",
                isActive && "border-[#879CE0] ring-2 ring-[#DFE4FB]",
                !isCompleted && !isActive && "opacity-60"
              )}
              onClick={() => isActive && setActiveSection(step.id)}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "p-2.5 rounded-xl",
                    isCompleted ? "bg-green-100" : isActive ? "bg-[#DFE4FB]" : "bg-gray-100"
                  )}>
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <Icon className={cn(
                        "h-5 w-5",
                        isActive ? "text-[#2F428D]" : "text-gray-400"
                      )} />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px] py-0 h-4">
                        Passo {index + 1}
                      </Badge>
                    </div>
                    <h3 className={cn(
                      "font-semibold mb-1",
                      isCompleted ? "text-green-700" : isActive ? "text-gray-900" : "text-gray-500"
                    )}>
                      {step.title}
                    </h3>
                    <p className="text-xs text-gray-500">{step.description}</p>
                  </div>
                </div>
                {isActive && (
                  <Button 
                    size="sm" 
                    className="w-full mt-4 bg-[#2F428D] hover:bg-[#253573]"
                    onClick={() => setActiveSection(step.id)}
                  >
                    Começar
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      {isConnected && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card 
            className="border-0 shadow-sm hover:shadow-md transition-all cursor-pointer group"
            onClick={() => setActiveSection('compose')}
          >
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-[#DFE4FB] group-hover:bg-[#B3BFF0] transition-colors">
                  <Send className="h-6 w-6 text-[#2F428D]" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">Enviar Email</h3>
                  <p className="text-sm text-gray-500">Componha um novo email</p>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-300 group-hover:text-[#374DA4] group-hover:translate-x-1 transition-all" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className="border-0 shadow-sm hover:shadow-md transition-all cursor-pointer group"
            onClick={() => setActiveSection('campaigns')}
          >
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-purple-100 group-hover:bg-purple-200 transition-colors">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">Nova Campanha</h3>
                  <p className="text-sm text-gray-500">Envie para múltiplos contatos</p>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-300 group-hover:text-purple-500 group-hover:translate-x-1 transition-all" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className="border-0 shadow-sm hover:shadow-md transition-all cursor-pointer group"
            onClick={() => setActiveSection('tracking')}
          >
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-green-100 group-hover:bg-green-200 transition-colors">
                  <BarChart3 className="h-6 w-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">Ver Métricas</h3>
                  <p className="text-sm text-gray-500">Acompanhe seus resultados</p>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-300 group-hover:text-green-500 group-hover:translate-x-1 transition-all" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stats Overview */}
      {isConnected && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Resumo de Performance</CardTitle>
              <Badge variant="outline" className="text-xs">Últimos 30 dias</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl text-center">
                <Send className="h-5 w-5 text-[#374DA4] mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">{stats.sent}</p>
                <p className="text-xs text-gray-500">Enviados</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl text-center">
                <Eye className="h-5 w-5 text-green-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">{stats.opened}</p>
                <p className="text-xs text-gray-500">Abertos</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl text-center">
                <MousePointer className="h-5 w-5 text-purple-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">{stats.clicked}</p>
                <p className="text-xs text-gray-500">Cliques</p>
              </div>
              <div className="p-4 bg-green-50 rounded-xl text-center">
                <TrendingUp className="h-5 w-5 text-green-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-green-600">{stats.openRate}%</p>
                <p className="text-xs text-gray-500">Taxa Abertura</p>
              </div>
              <div className="p-4 bg-purple-50 rounded-xl text-center">
                <Target className="h-5 w-5 text-purple-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-purple-600">{stats.clickRate}%</p>
                <p className="text-xs text-gray-500">Taxa Clique</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'connect':
        return <EmailConnectionWizard />;
      case 'compose':
        return <EmailComposer />;
      case 'templates':
        return <EmailTemplates />;
      case 'campaigns':
        return <CampaignMail />;
      case 'tracking':
        return <MailTracking />;
      default:
        return renderJourneySection();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-[#374DA4] to-indigo-500 shadow-lg">
              <Mail className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Email Marketing</h1>
              <p className="text-sm text-gray-500">
                {isConnected 
                  ? `Conectado: ${emailAccount?.provider_email}` 
                  : 'Conecte seu email para começar'}
              </p>
            </div>
          </div>

          {activeSection && (
            <Button 
              variant="outline" 
              onClick={() => setActiveSection(null)}
              className="gap-2"
            >
              ← Voltar ao Início
            </Button>
          )}
        </div>

        {/* Connection Status Alert */}
        {!isConnected && !activeSection && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4 flex items-center gap-4">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <div className="flex-1">
                <p className="font-medium text-amber-800">Email não conectado</p>
                <p className="text-sm text-amber-700">Conecte sua conta Google para enviar emails</p>
              </div>
              <Button 
                onClick={() => setActiveSection('connect')}
                className="bg-amber-600 hover:bg-amber-700"
              >
                Conectar Agora
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        {renderContent()}

        {/* Help Section */}
        {!activeSection && (
          <Card className="border-0 shadow-sm bg-gradient-to-r from-gray-50 to-gray-100">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-white shadow-sm">
                  <Sparkles className="h-6 w-6 text-[#374DA4]" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">Precisa de ajuda?</h3>
                  <p className="text-sm text-gray-500">
                    Confira nossos tutoriais e dicas para criar campanhas de sucesso
                  </p>
                </div>
                <Button variant="outline" className="gap-2">
                  <Play className="h-4 w-4" />
                  Ver Tutoriais
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ImprovedEmailMarketing;
