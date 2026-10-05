import React from 'react';
import { ArrowLeft, Eye, EyeOff, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Switch } from '@/components/ui/switch';

export default function SettingsPrivacyPage() {
  const navigate = useNavigate();
  const [profileVisible, setProfileVisible] = React.useState(true);
  const [onlineStatus, setOnlineStatus] = React.useState(true);

  const options = [
    { icon: Eye, label: 'Perfil Visível', desc: 'Permitir que outros membros vejam seu perfil', value: profileVisible, onChange: setProfileVisible, color: '#10B981' },
    { icon: Activity, label: 'Status Online', desc: 'Mostrar quando você está online', value: onlineStatus, onChange: setOnlineStatus, color: '#10B981' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 md:px-6 pt-2 pb-24 md:py-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm">Voltar</span>
        </button>

        <h1 className="text-xl font-bold text-foreground mb-1">Privacidade</h1>
        <p className="text-sm text-muted-foreground mb-6">Controle a visibilidade do seu perfil</p>

        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden divide-y divide-border/30">
          {options.map((opt) => (
            <div key={opt.label} className="flex items-center gap-4 px-4 py-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: opt.color + '14' }}>
                <opt.icon className="h-5 w-5" style={{ color: opt.color }} />
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
