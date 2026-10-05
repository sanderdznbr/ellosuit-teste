import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Settings, Send, CheckCircle2, AlertCircle, Palette, Users, BarChart3, ChevronRight, ExternalLink } from 'lucide-react';
import EmailComposer from './EmailComposer';
import MailTracking from './MailTracking';
import CampaignMail from './CampaignMail';
import EmailConnectionWizard from './EmailConnectionWizard';
import EmailLimitIndicator from './EmailLimitIndicator';
import { useGmail } from '@/hooks/useGmail';
import { Button } from '@/components/ui/button';

const OMNI_COLOR = '#374DA4';

type TabId = 'compose' | 'campaigns' | 'tracking' | 'settings';

const EmailDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('compose');
  const { isConnected, emailAccount } = useGmail();

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'compose', label: 'Compor', icon: Send },
    { id: 'campaigns', label: 'Campanhas', icon: Users },
    { id: 'tracking', label: 'Histórico', icon: BarChart3 },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  const quickActions = [
    { label: 'Construir Templates', icon: Palette, onClick: () => navigate('/dashboard/email-builder') },
    { label: 'Ver Templates', icon: ExternalLink, onClick: () => navigate('/dashboard/email-templates') },
    { label: 'Emails Enviados', icon: BarChart3, onClick: () => setActiveTab('tracking') },
    { label: 'Configurações', icon: Settings, onClick: () => setActiveTab('settings') },
  ];

  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-background dark:bg-[#000] page-content overflow-y-auto">
      {/* Header */}
      <div className="border-b border-border/40 bg-[#faf9f7] dark:bg-background/80 dark:bg-black/80 backdrop-blur-xl sticky top-0 z-50 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-white dark:bg-card dark:bg-white/5 border border-border/40 shadow-sm"
            >
              <Mail className="h-5 w-5" style={{ color: OMNI_COLOR }} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground tracking-tight">Email Marketing</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <EmailLimitIndicator showDetails={false} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex bg-gray-200/50 dark:bg-white/5 p-1 rounded-xl">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeTab === tab.id 
                      ? "bg-white dark:bg-card dark:bg-white/10 text-foreground shadow-sm" 
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>

            <div className="h-8 w-px bg-border/40" />

            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-amber-500'} shadow-[0_0_8px_rgba(34,197,94,0.4)]`} />
              <span className="text-[11px] font-medium text-muted-foreground hidden sm:inline">
                {isConnected ? 'Conectado' : 'Desconectado'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8">
          <div className="space-y-8">
            {activeTab === 'compose' && (
              <div className="bg-white dark:bg-card dark:bg-white/5 border border-border/40 rounded-3xl p-8 shadow-sm">
                <EmailComposer />
              </div>
            )}
            {activeTab === 'campaigns' && (
              <div className="bg-white dark:bg-card dark:bg-white/5 border border-border/40 rounded-3xl p-8 shadow-sm">
                <CampaignMail />
              </div>
            )}
            {activeTab === 'tracking' && (
              <div className="bg-white dark:bg-card dark:bg-white/5 border border-border/40 rounded-3xl overflow-hidden shadow-sm">
                <MailTracking />
              </div>
            )}
            {activeTab === 'settings' && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-card dark:bg-white/5 border border-border/40 rounded-3xl p-8 shadow-sm">
                  <h3 className="text-lg font-semibold text-foreground mb-4 tracking-tight">Limite de Envios</h3>
                  <EmailLimitIndicator showDetails={true} className="w-full" />
                  <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
                    Seu limite diário de envios é renovado a cada 24 horas. Para aumentar seus limites, entre em contato com o suporte.
                  </p>
                </div>
                <div className="bg-white dark:bg-card dark:bg-white/5 border border-border/40 rounded-3xl p-8 shadow-sm">
                  <h3 className="text-lg font-semibold text-foreground mb-4 tracking-tight">Conexão de Email</h3>
                  <EmailConnectionWizard />
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Actions */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-card dark:bg-white/5 border border-border/40 rounded-3xl p-6 shadow-sm">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Ações Rápidas</h4>
              <div className="grid grid-cols-1 gap-2">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={action.onClick}
                    className="flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 dark:hover:bg-white/5 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/10 dark:bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <action.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                    </div>
                    <span className="text-sm font-medium text-foreground">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-primary rounded-3xl p-6 text-white overflow-hidden relative shadow-lg">
              <div className="relative z-10">
                <h4 className="font-semibold mb-2">Novo no Email?</h4>
                <p className="text-xs text-white/80 leading-relaxed mb-4">
                  Aprenda como criar campanhas que convertem usando nossos templates exclusivos.
                </p>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="w-full rounded-xl bg-white dark:bg-card text-primary hover:bg-white/90"
                  onClick={() => navigate('/dashboard/email-templates')}
                >
                  Ver Guia
                </Button>
              </div>
              <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailDashboard;
