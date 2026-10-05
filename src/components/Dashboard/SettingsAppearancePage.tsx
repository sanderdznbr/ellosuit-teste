import React from 'react';
import { ArrowLeft, Moon, Sun, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';

export default function SettingsAppearancePage() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const themes = [
    { id: 'light' as const, label: 'Claro', icon: Sun, description: 'Fundo branco com texto escuro' },
    { id: 'dark' as const, label: 'Escuro', icon: Moon, description: 'Fundo escuro com texto claro' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 md:px-6 pt-2 pb-24 md:py-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm">Voltar</span>
        </button>

        <h1 className="text-xl font-bold text-foreground mb-1">Aparência</h1>
        <p className="text-sm text-muted-foreground mb-6">Escolha o tema visual da plataforma</p>

        <div className="space-y-2">
          {themes.map((t) => {
            const isActive = theme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all ${isActive ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border/60 bg-card hover:bg-muted/50'}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isActive ? 'bg-primary/15' : 'bg-muted'}`}>
                  <t.icon className={`h-5 w-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-foreground">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                </div>
                {isActive && <Check className="h-5 w-5 text-primary" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}