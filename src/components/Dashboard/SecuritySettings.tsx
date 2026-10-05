import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Shield, Key, Smartphone, Monitor, LogOut, Eye, EyeOff, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const SecuritySettings = () => {
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passwordData, setPasswordData] = useState({ newPassword: '', confirmPassword: '' });
  const [settings, setSettings] = useState({ twoFactor: false, loginAlerts: true, sessionExpiry: true });

  const handleChangePassword = async () => {
    if (!passwordData.newPassword || !passwordData.confirmPassword) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' }); return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({ title: 'As senhas não coincidem', variant: 'destructive' }); return;
    }
    if (passwordData.newPassword.length < 6) {
      toast({ title: 'Mínimo 6 caracteres', variant: 'destructive' }); return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordData.newPassword });
      if (error) throw error;
      toast({ title: 'Senha alterada!' });
      setPasswordData({ newPassword: '', confirmPassword: '' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const lastSignIn = user?.last_sign_in_at
    ? format(new Date(user.last_sign_in_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    : 'Sessão ativa';

  const provider = user?.app_metadata?.provider === 'google' ? 'Google' : 'Email';

  const securityOptions = [
    { key: 'twoFactor', icon: Smartphone, label: 'Autenticação 2FA', desc: 'Camada extra de segurança', checked: settings.twoFactor },
    { key: 'loginAlerts', icon: AlertTriangle, label: 'Alertas de Login', desc: 'Notificações de novos acessos', checked: settings.loginAlerts },
    { key: 'sessionExpiry', icon: Clock, label: 'Expiração de Sessão', desc: 'Deslogar após 30 dias', checked: settings.sessionExpiry },
  ];

  const handleToggle = (key: string) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }));
    toast({ title: 'Configuração atualizada' });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 md:px-6 pt-2 pb-24 md:py-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground">Segurança</h1>
          <p className="text-xs text-muted-foreground">Gerencie a segurança da sua conta</p>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/15 mb-4">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Sua conta está protegida</p>
        </div>

        <div className="space-y-3">
          {/* Change Password */}
          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
              <Key className="h-3.5 w-3.5 text-muted-foreground" />
              <h3 className="text-xs font-semibold text-foreground">Alterar Senha</h3>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Nova senha</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={passwordData.newPassword}
                      onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      placeholder="Mínimo 6 caracteres"
                      className="h-9 text-sm rounded-xl pr-9"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Confirmar</Label>
                  <Input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    placeholder="Repita a senha"
                    className="h-9 text-sm rounded-xl"
                  />
                </div>
              </div>
              {passwordData.newPassword && passwordData.confirmPassword && (
                <p className={`text-[10px] flex items-center gap-1 ${passwordData.newPassword === passwordData.confirmPassword ? 'text-emerald-600' : 'text-destructive'}`}>
                  {passwordData.newPassword === passwordData.confirmPassword
                    ? <><CheckCircle2 className="h-3 w-3" /> Coincidem</>
                    : <><AlertTriangle className="h-3 w-3" /> Não coincidem</>
                  }
                </p>
              )}
              <Button
                onClick={handleChangePassword}
                disabled={loading || !passwordData.newPassword || passwordData.newPassword !== passwordData.confirmPassword}
                className="w-full h-8 text-xs rounded-xl bg-[#64748b] hover:bg-[#475569] text-white"
              >
                {loading ? 'Alterando...' : 'Alterar Senha'}
              </Button>
            </div>
          </div>

          {/* Security Options */}
          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border/40">
              <h3 className="text-xs font-semibold text-foreground">Opções de Segurança</h3>
            </div>
            {securityOptions.map((opt, i) => {
              const Icon = opt.icon;
              return (
                <div key={opt.key} className={`flex items-center justify-between px-4 py-3 ${i < securityOptions.length - 1 ? 'border-b border-border/30' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-foreground">{opt.label}</p>
                      <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
                    </div>
                  </div>
                  <Switch checked={opt.checked} onCheckedChange={() => handleToggle(opt.key)} />
                </div>
              );
            })}
          </div>

          {/* Session */}
          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border/40">
              <h3 className="text-xs font-semibold text-foreground">Sessão Atual</h3>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40">
                <div className="flex items-center gap-2.5">
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs font-medium text-foreground">Este dispositivo</p>
                    <p className="text-[10px] text-muted-foreground">Último login: {lastSignIn}</p>
                  </div>
                </div>
                <span className="text-[9px] font-medium px-1.5 py-px rounded-full bg-emerald-500/10 text-emerald-600">Ativa</span>
              </div>
              <div className="flex items-center justify-between px-1">
                <div>
                  <p className="text-xs font-medium text-foreground">Provedor</p>
                  <p className="text-[10px] text-muted-foreground">{provider}</p>
                </div>
                <span className="text-[9px] font-medium px-1.5 py-px rounded-full bg-muted text-muted-foreground">{provider}</span>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="rounded-2xl border border-destructive/20 bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-destructive/15">
              <h3 className="text-xs font-semibold text-destructive">Zona de Perigo</h3>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between p-3 rounded-xl border border-destructive/15 bg-destructive/5">
                <div>
                  <p className="text-xs font-medium text-foreground">Encerrar sessão</p>
                  <p className="text-[10px] text-muted-foreground">Sair de todos os dispositivos</p>
                </div>
                <Button variant="outline" size="sm" className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10 h-7 text-[10px] rounded-lg" onClick={() => signOut()}>
                  <LogOut className="h-3 w-3" /> Sair
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecuritySettings;
