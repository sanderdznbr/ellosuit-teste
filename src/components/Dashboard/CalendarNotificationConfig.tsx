import React, { useState, useEffect } from 'react';
import { Bell, Phone, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const FLOW_COLOR = '#4D7CFF';

const CalendarNotificationConfig: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);
  const [eventCreated, setEventCreated] = useState(true);
  const [eventUpcoming, setEventUpcoming] = useState(true);
  const [eventDeleted, setEventDeleted] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefId, setPrefId] = useState<string | null>(null);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    loadSettings();
  }, [user?.id]);

  const loadSettings = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [{ data: prefs }, { data: settings }] = await Promise.all([
        supabase.from('notification_preferences').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('notification_settings').select('*').eq('user_id', user.id).maybeSingle(),
      ]);

      if (prefs) {
        setPrefId(prefs.id);
        setWhatsappNumber(prefs.whatsapp_number || '');
        setWhatsappEnabled(prefs.whatsapp_enabled !== false);
      }
      if (settings) {
        setSettingsId(settings.id);
        setEventCreated(settings.whatsapp_event_created !== false);
        setEventUpcoming(settings.whatsapp_event_upcoming !== false);
        setEventDeleted(settings.whatsapp_event_deleted !== false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const cleanNumber = whatsappNumber.replace(/\D/g, '');

      // Get company_id
      const { data: cu } = await supabase.from('company_users').select('company_id').eq('user_id', user.id).limit(1).maybeSingle();
      const companyId = cu?.company_id || user.id;

      // Upsert notification_preferences
      if (prefId) {
        await supabase.from('notification_preferences').update({
          whatsapp_number: cleanNumber || null,
          whatsapp_enabled: whatsappEnabled,
        }).eq('id', prefId);
      } else {
        const { data } = await supabase.from('notification_preferences').insert({
          user_id: user.id,
          company_id: companyId,
          whatsapp_number: cleanNumber || null,
          whatsapp_enabled: whatsappEnabled,
        }).select('id').single();
        if (data) setPrefId(data.id);
      }

      // Upsert notification_settings
      if (settingsId) {
        await supabase.from('notification_settings').update({
          whatsapp_event_created: eventCreated,
          whatsapp_event_upcoming: eventUpcoming,
          whatsapp_event_deleted: eventDeleted,
          whatsapp_enabled: whatsappEnabled,
        }).eq('id', settingsId);
      } else {
        const { data } = await supabase.from('notification_settings').insert({
          user_id: user.id,
          company_id: companyId,
          whatsapp_event_created: eventCreated,
          whatsapp_event_upcoming: eventUpcoming,
          whatsapp_event_deleted: eventDeleted,
          whatsapp_enabled: whatsappEnabled,
        }).select('id').single();
        if (data) setSettingsId(data.id);
      }

      toast({ title: '✅ Configurações salvas!' });
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const numberConfigured = whatsappNumber.replace(/\D/g, '').length >= 10;

  if (loading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Carregando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl" style={{ backgroundColor: `${FLOW_COLOR}12` }}>
            <Bell className="h-4 w-4" style={{ color: FLOW_COLOR }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Notificações da Agenda</h3>
            <p className="text-xs text-muted-foreground">Receba alertas por WhatsApp sobre seus eventos</p>
          </div>
        </div>
        {numberConfigured ? (
          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-full">
            <Check className="h-3 w-3" /> Configurado
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1 rounded-full">
            <AlertTriangle className="h-3 w-3" /> Pendente
          </span>
        )}
      </div>

      <div className="p-5 space-y-5">
        {/* WhatsApp number */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-2 block">Número do WhatsApp</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="5511999999999"
                className="pl-10 rounded-xl h-10"
              />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            Código do país + DDD + número (ex: 5511999999999)
          </p>
        </div>

        {/* Toggles */}
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-foreground">WhatsApp ativo</p>
              <p className="text-xs text-muted-foreground">Receber notificações via WhatsApp</p>
            </div>
            <Switch checked={whatsappEnabled} onCheckedChange={setWhatsappEnabled} />
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-foreground">Evento criado</p>
              <p className="text-xs text-muted-foreground">Quando um novo evento for agendado</p>
            </div>
            <Switch checked={eventCreated} onCheckedChange={setEventCreated} disabled={!whatsappEnabled} />
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-foreground">Lembrete de evento</p>
              <p className="text-xs text-muted-foreground">Antes do evento começar</p>
            </div>
            <Switch checked={eventUpcoming} onCheckedChange={setEventUpcoming} disabled={!whatsappEnabled} />
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-foreground">Evento cancelado</p>
              <p className="text-xs text-muted-foreground">Quando um evento for excluído</p>
            </div>
            <Switch checked={eventDeleted} onCheckedChange={setEventDeleted} disabled={!whatsappEnabled} />
          </div>
        </div>

        {/* Save */}
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-xl h-10 text-white"
          style={{ backgroundColor: FLOW_COLOR }}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
};

export default CalendarNotificationConfig;
