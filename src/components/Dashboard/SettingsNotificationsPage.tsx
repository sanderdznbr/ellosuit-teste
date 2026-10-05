import React from 'react';
import { ArrowLeft, Bell, Mail, MessageSquare, Smartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Switch } from '@/components/ui/switch';

export default function SettingsNotificationsPage() {
  const navigate = useNavigate();
  const [pushEnabled, setPushEnabled] = React.useState(true);
  const [emailEnabled, setEmailEnabled] = React.useState(true);
  const [whatsappEnabled, setWhatsappEnabled] = React.useState(false);

  const options = [
    { icon: Smartphone, label: 'Notificações Push', desc: 'Receba alertas no navegador e celular', value: pushEnabled, onChange: setPushEnabled },
    { icon: Mail, label: 'Notificações por Email', desc: 'Resumos e alertas importantes por email', value: emailEnabled, onChange: setEmailEnabled },
    { icon: MessageSquare, label: 'Alertas no WhatsApp', desc: 'Receba avisos pelo WhatsApp', value: whatsappEnabled, onChange: setWhatsappEnabled },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 md:px-6 pt-2 pb-24 md:py-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm">Voltar</span>
        </button>

        <h1 className="text-xl font-bold text-foreground mb-1">Notificações</h1>
        <p className="text-sm text-muted-foreground mb-6">Configure como você recebe alertas</p>

        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden divide-y divide-border/30">
          {options.map((opt) => (
            <div key={opt.label} className="flex items-center gap-4 px-4 py-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                <opt.icon className="h-5 w-5 text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.desc}</p>
              </div>
              <Switch checked={opt.value} onCheckedChange={opt.onChange} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
