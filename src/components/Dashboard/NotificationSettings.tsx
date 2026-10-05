import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Bell, Smartphone, Clock, TestTube, RefreshCw, MessageSquare, Calendar, Mail, Send, CheckSquare, Trash2, Globe, Phone, Save, Check } from 'lucide-react';
import { useNotificationSettings } from '@/hooks/useNotificationSettings';
import { useDeviceRegistration } from '@/hooks/useDeviceRegistration';
import { useOneSignal } from '@/hooks/useOneSignal';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const NotificationSettings = () => {
  const { settings, updateNotificationSettings, isLoading } = useNotificationSettings();
  const { 
    deviceToken, 
    isRegistered, 
    isRegistering,
    requestNotificationPermission, 
    resetRegistration 
  } = useDeviceRegistration();
  const { permission, ready: oneSignalReady, requestPermission: requestPushPermission } = useOneSignal();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isSendingPushTest, setIsSendingPushTest] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [isSavingPhone, setIsSavingPhone] = useState(false);
  const [testTitle, setTestTitle] = useState('🎉 Notificação Teste');
  const [testMessage, setTestMessage] = useState('Esta é uma notificação de teste do Ello Suit com APNs configurado!');

  // Load saved WhatsApp number
  const { data: notifPrefs } = useQuery({
    queryKey: ['notification-preferences', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (notifPrefs?.whatsapp_number) {
      setWhatsappNumber(notifPrefs.whatsapp_number);
    }
  }, [notifPrefs]);

  const saveWhatsappNumber = async () => {
    if (!user) return;
    setIsSavingPhone(true);
    try {
      const cleanNumber = whatsappNumber.replace(/\D/g, '');
      if (!cleanNumber || cleanNumber.length < 10) {
        toast({ title: '❌ Número inválido', description: 'Insira um número com DDD (ex: 5541999999999)', variant: 'destructive' });
        return;
      }

      // Get company_id
      const { data: cu } = await supabase.from('company_users').select('company_id').eq('user_id', user.id).limit(1).single();

      if (notifPrefs?.id) {
        await supabase.from('notification_preferences').update({ whatsapp_number: cleanNumber }).eq('id', notifPrefs.id);
      } else {
        await supabase.from('notification_preferences').insert({
          user_id: user.id,
          company_id: cu?.company_id || user.id,
          whatsapp_number: cleanNumber,
          whatsapp_enabled: true,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      toast({ title: '✅ Número salvo', description: 'Seu WhatsApp foi registrado para receber notificações.' });
    } catch (error: any) {
      toast({ title: '❌ Erro', description: error.message, variant: 'destructive' });
    } finally {
      setIsSavingPhone(false);
    }
  };

  const handleSettingChange = async (key: string, value: boolean | number) => {
    try {
      await updateNotificationSettings({ [key]: value });
      toast({
        title: "✅ Configuração atualizada",
        description: "Suas preferências de notificação foram salvas.",
      });
    } catch (error) {
      toast({
        title: "❌ Erro",
        description: "Não foi possível atualizar a configuração.",
        variant: "destructive"
      });
    }
  };

  const sendTestNotification = async () => {
    if (!testTitle.trim() || !testMessage.trim()) {
      toast({ title: "❌ Erro", description: "Título e mensagem são obrigatórios.", variant: "destructive" });
      return;
    }
    setIsSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-push', {
        body: { title: testTitle, body: testMessage, deviceToken }
      });
      if (error) throw error;
      const isSimulated = data.results?.[0]?.simulation;
      toast({
        title: "🎉 Notificação teste enviada!",
        description: isSimulated ? `Simulada: ${data.sent} dispositivo(s)` : `Enviada via APNs para ${data.sent} dispositivo(s)`,
      });
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(testTitle, { body: testMessage, icon: '/favicon.ico' });
      }
    } catch (error: any) {
      toast({ title: "❌ Erro", description: `Falha ao enviar notificação: ${error.message}`, variant: "destructive" });
    } finally {
      setIsSendingTest(false);
    }
  };

  const sendPushTest = async () => {
    setIsSendingPushTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-user-notification', {
        body: {
          user_id: user?.id,
          company_id: (settings as any)?.company_id || user?.id,
          title: '🔔 Teste Push OneSignal',
          message: 'Se você recebeu isso, as notificações push estão funcionando!',
          type: 'info',
          category: 'system',
          notification_type: 'push_test',
          send_whatsapp: false,
        }
      });
      if (error) throw error;
      toast({
        title: "🎉 Push enviado!",
        description: data?.push_sent !== false ? "Notificação push enviada via OneSignal" : "Notificação criada (push pode não ter sido entregue)",
      });
    } catch (error: any) {
      toast({ title: "❌ Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsSendingPushTest(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-muted rounded w-1/4"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  const whatsappToggles = [
    {
      key: 'whatsapp_event_created',
      label: 'Evento agendado no calendário',
      description: 'Notificar quando um novo evento for criado na agenda',
      icon: Calendar,
      color: 'text-[#374DA4]',
    },
    {
      key: 'whatsapp_event_upcoming',
      label: 'Evento próximo (cronômetro)',
      description: 'Notificar quando um evento estiver próximo de começar',
      icon: Clock,
      color: 'text-[#2F428D]',
    },
    {
      key: 'whatsapp_event_deleted',
      label: 'Evento deletado do calendário',
      description: 'Notificar quando um evento for removido da agenda',
      icon: Trash2,
      color: 'text-red-500',
    },
    {
      key: 'whatsapp_task_due',
      label: 'Tarefa prestes a vencer',
      description: 'Notificar quando uma tarefa estiver próxima do prazo',
      icon: CheckSquare,
      color: 'text-green-500',
    },
    {
      key: 'whatsapp_email_sent',
      label: 'E-mail marketing enviado',
      description: 'Notificar quando um e-mail marketing for disparado',
      icon: Mail,
      color: 'text-purple-500',
    },
    {
      key: 'whatsapp_dispatch_progress',
      label: 'Disparos de mensagens em andamento',
      description: 'Notificar sobre o progresso de disparos em massa',
      icon: Send,
      color: 'text-primary',
    },
    {
      key: 'whatsapp_birthday_reminder',
      label: 'Aniversário de clientes',
      description: 'Lembrete quando um cliente fizer aniversário',
      icon: Calendar,
      color: 'text-pink-500',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">
          🔔 Configurações de Notificação
        </h3>
        <p className="text-muted-foreground text-sm">
          Gerencie como e quando você recebe notificações sobre seus eventos e compromissos.
        </p>
      </div>

      {/* WhatsApp Notifications Section */}
      <Card className="border-green-200 dark:border-green-800">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquare className="h-5 w-5 text-green-500" />
              Notificações via WhatsApp
            </CardTitle>
            <Switch
              checked={(settings as any)?.whatsapp_enabled ?? true}
              onCheckedChange={(checked) => handleSettingChange('whatsapp_enabled', checked)}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Receba alertas diretamente no seu WhatsApp conectado à conta admin
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* WhatsApp Number Input */}
          <div className="p-3 rounded-xl bg-muted/50 border border-border space-y-2">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-green-500" />
              <Label className="text-sm font-medium">Seu número WhatsApp</Label>
              {notifPrefs?.whatsapp_number && (
                <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                  <Check className="h-3 w-3 mr-1" /> Registrado
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="5541999999999"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                className="flex-1 h-9 text-sm"
              />
              <Button
                size="sm"
                onClick={saveWhatsappNumber}
                disabled={isSavingPhone || !whatsappNumber.trim()}
                className="h-9"
              >
                {isSavingPhone ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" />
                ) : (
                  <><Save className="h-3.5 w-3.5 mr-1" /> Salvar</>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Informe com código do país + DDD + número (ex: 5541999999999). As notificações serão enviadas pelo WhatsApp da Ellosuit.
            </p>
          </div>

          <Separator />

          {/* Toggle list */}
          {whatsappToggles.map((toggle, index) => (
            <React.Fragment key={toggle.key}>
              {index > 0 && <Separator className="my-3" />}
              <div className="flex items-center justify-between py-2">
                <div className="flex items-start gap-3">
                  <toggle.icon className={`h-5 w-5 mt-0.5 ${toggle.color}`} />
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium leading-tight">{toggle.label}</Label>
                    <p className="text-xs text-muted-foreground">{toggle.description}</p>
                  </div>
                </div>
                <Switch
                  checked={(settings as any)?.[toggle.key] ?? true}
                  onCheckedChange={(checked) => handleSettingChange(toggle.key, checked)}
                  disabled={!((settings as any)?.whatsapp_enabled ?? true)}
                />
              </div>
            </React.Fragment>
          ))}
        </CardContent>
      </Card>

      {/* Push Notifications (OneSignal) */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Globe className="h-5 w-5 text-primary" />
            Notificações Push (Navegador)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Receba notificações push mesmo quando não estiver com o app aberto
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-base font-medium">Status Push</Label>
              <p className="text-sm text-muted-foreground">
                {permission === 'granted' 
                  ? '✅ Notificações push ativadas' 
                  : permission === 'denied'
                  ? '❌ Bloqueadas no navegador — desbloqueie nas configurações do navegador'
                  : '⏳ Permissão não solicitada'}
              </p>
            </div>
            <Badge variant={permission === 'granted' ? 'default' : permission === 'denied' ? 'destructive' : 'secondary'}>
              {permission === 'granted' ? '✅ Ativo' : permission === 'denied' ? '🚫 Bloqueado' : '⏳ Pendente'}
            </Badge>
          </div>

          {permission !== 'granted' && permission !== 'denied' && (
            <Button onClick={requestPushPermission} disabled={!oneSignalReady} className="w-full">
              <Bell className="h-4 w-4 mr-2" />
              🔔 Ativar Notificações Push
            </Button>
          )}

          {permission === 'granted' && (
            <Button onClick={sendPushTest} disabled={isSendingPushTest} variant="outline" className="w-full">
              {isSendingPushTest ? (
                <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>Enviando...</>
              ) : (
                <><TestTube className="h-4 w-4 mr-2" />🧪 Enviar Push de Teste</>
              )}
            </Button>
          )}

          {permission === 'denied' && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <p className="text-sm text-destructive">
                <strong>⚠️</strong> As notificações foram bloqueadas. Para reativar, clique no ícone 🔒 ao lado da URL no navegador e permita notificações.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Device Registration Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Status do Dispositivo APNs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-base font-medium">🍎 Notificações Push iOS</Label>
              <p className="text-sm text-muted-foreground">
                {isRegistered ? "✅ Dispositivo registrado para APNs" : "❌ Dispositivo não registrado"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isRegistered ? "default" : "destructive"}>
                {isRegistered ? "✅ Ativo" : "❌ Inativo"}
              </Badge>
              {isRegistered && (
                <Button variant="outline" size="sm" onClick={resetRegistration} className="text-xs">
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Reset
                </Button>
              )}
            </div>
          </div>
          {deviceToken && (
            <div className="space-y-1">
              <Label className="text-sm font-medium">🔑 Device Token</Label>
              <p className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded">
                {deviceToken.substring(0, 30)}...
              </p>
            </div>
          )}
          {!isRegistered && (
            <Button onClick={requestNotificationPermission} disabled={isRegistering} className="w-full">
              {isRegistering ? (
                <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>Registrando...</>
              ) : (
                <><Bell className="h-4 w-4 mr-2" />🍎 Ativar Notificações APNs</>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* General Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notificações Gerais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-base font-medium">Notificações do Calendário</Label>
              <p className="text-sm text-muted-foreground">Receba notificações sobre eventos e compromissos</p>
            </div>
            <Switch
              checked={settings?.calendar_notifications_enabled ?? true}
              onCheckedChange={(checked) => handleSettingChange('calendar_notifications_enabled', checked)}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-base font-medium">Notificações de Início de Evento</Label>
              <p className="text-sm text-muted-foreground">Seja notificado quando um evento começar</p>
            </div>
            <Switch
              checked={settings?.event_start_notifications ?? true}
              onCheckedChange={(checked) => handleSettingChange('event_start_notifications', checked)}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-base font-medium">Lembretes de Eventos</Label>
              <p className="text-sm text-muted-foreground">Receba lembretes antes dos seus eventos</p>
            </div>
            <Switch
              checked={settings?.reminder_notifications_enabled ?? true}
              onCheckedChange={(checked) => handleSettingChange('reminder_notifications_enabled', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Reminder Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Configurações de Lembrete
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="default-reminder">Lembrete Padrão (minutos antes)</Label>
            <Input
              id="default-reminder"
              type="number"
              min="1"
              max="1440"
              value={settings?.default_reminder_minutes ?? 15}
              onChange={(e) => handleSettingChange('default_reminder_minutes', parseInt(e.target.value))}
              className="w-32"
            />
            <p className="text-sm text-muted-foreground">Tempo padrão para lembretes de novos eventos</p>
          </div>
        </CardContent>
      </Card>

      {/* Test Notification */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            🧪 Teste de Notificação APNs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="test-title">📱 Título</Label>
            <Input id="test-title" value={testTitle} onChange={(e) => setTestTitle(e.target.value)} placeholder="Título da notificação teste" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="test-message">💬 Mensagem</Label>
            <Input id="test-message" value={testMessage} onChange={(e) => setTestMessage(e.target.value)} placeholder="Mensagem da notificação teste" />
          </div>
          <Button onClick={sendTestNotification} disabled={isSendingTest || !testTitle.trim() || !testMessage.trim() || !isRegistered} className="w-full">
            {isSendingTest ? (
              <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>📤 Enviando via APNs...</>
            ) : (
              <><TestTube className="h-4 w-4 mr-2" />🍎 Enviar Teste APNs</>
            )}
          </Button>
          {!isRegistered && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>⚠️ Atenção:</strong> Ative as notificações primeiro para enviar testes APNs.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationSettings;
