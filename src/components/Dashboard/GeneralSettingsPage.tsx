import { Settings, User, CreditCard, Shield, Users, HelpCircle, AlertCircle, ChevronRight, Bell, Palette, Eye, Moon, Sun, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTheme } from '@/hooks/useTheme';

const settingsGroups = [
  {
    title: 'Conta',
    items: [
      { icon: User, label: 'Meu Perfil', desc: 'Editar nome, foto e dados pessoais', path: '/dashboard/perfil', color: '#374DA4' },
      { icon: CreditCard, label: 'Minha Assinatura', desc: 'Gerenciar plano, pagamentos e faturas', path: '/dashboard/minhassinatura', color: '#374DA4' },
      { icon: Shield, label: 'Segurança', desc: 'Senha, autenticação e sessões ativas', path: '/dashboard/seguranca', color: '#374DA4' },
    ],
  },
  {
    title: 'Preferências',
    items: [
      { icon: Palette, label: 'Aparência', desc: 'Tema claro/escuro e personalização visual', path: '/dashboard/configuracoes/aparencia', color: '#8B5CF6' },
      { icon: Bell, label: 'Notificações', desc: 'Push, email e alertas por WhatsApp', path: '/dashboard/configuracoes/notificacoes', color: '#F59E0B' },
      { icon: Eye, label: 'Privacidade', desc: 'Visibilidade do perfil e status online', path: '/dashboard/configuracoes/privacidade', color: '#10B981' },
    ],
  },
  {
    title: 'Empresa',
    items: [],
  },
  {
    title: 'Ajuda',
    items: [
      { icon: HelpCircle, label: 'Suporte', desc: 'Central de ajuda e tutoriais', path: '/dashboard/suporte', color: '#64748B' },
      { icon: AlertCircle, label: 'Reportar Problema', desc: 'Enviar bug ou feedback', path: '/dashboard/reportar-problema', color: '#EF4444' },
      { icon: FileText, label: 'Termos e Políticas', desc: 'Termos de uso e privacidade', path: '/terms', color: '#64748B' },
    ],
  },
];

export default function GeneralSettingsPage() {
  const navigate = useNavigate();
  const { isMobile } = useIsMobile();
  const { theme } = useTheme();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 md:px-6 pt-2 pb-24 md:py-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Configurações</h1>
            <p className="text-xs text-muted-foreground">Gerencie sua conta e preferências</p>
          </div>
        </div>

        {/* Settings Groups */}
        <div className="space-y-4">
          {settingsGroups.map((group) => (
            <div key={group.title} className="rounded-2xl border border-border/60 bg-card overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border/40">
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{group.title}</h3>
              </div>
              <div className="divide-y divide-border/30">
                {group.items.map((item) => (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className="flex items-center gap-3.5 w-full px-4 py-3.5 text-left hover:bg-muted/50 active:bg-muted/60 transition-colors"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: item.color + '14' }}
                    >
                      <item.icon className="h-[18px] w-[18px]" style={{ color: item.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer info */}
        <div className="mt-6 text-center">
          <p className="text-[10px] text-muted-foreground/60">
            Tema atual: {theme === 'dark' ? '🌙 Escuro' : '☀️ Claro'}
          </p>
        </div>
      </div>
    </div>
  );
}
