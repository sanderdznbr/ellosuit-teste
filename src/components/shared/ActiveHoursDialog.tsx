import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  ActiveHoursConfig,
  DAY_KEYS,
  DAY_LABELS,
  DEFAULT_ACTIVE_HOURS,
  normalizeActiveHours,
} from '@/lib/active-hours';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: ActiveHoursConfig | null | undefined;
  onSave: (cfg: ActiveHoursConfig) => Promise<void> | void;
  targetLabel?: string;
}

const ActiveHoursDialog: React.FC<Props> = ({ open, onOpenChange, value, onSave, targetLabel }) => {
  const [cfg, setCfg] = useState<ActiveHoursConfig>(normalizeActiveHours(value));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setCfg(normalizeActiveHours(value));
  }, [open, value]);

  const setDay = (key: typeof DAY_KEYS[number], patch: Partial<ActiveHoursConfig['days'][typeof key]>) => {
    setCfg(prev => ({ ...prev, days: { ...prev.days, [key]: { ...prev.days[key], ...patch } } }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(cfg);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Horário de funcionamento
            {targetLabel && <span className="text-sm text-muted-foreground font-normal">— {targetLabel}</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border p-3">
            <div>
              <Label className="text-sm font-medium">Ativar restrição de horário</Label>
              <p className="text-xs text-muted-foreground">
                Quando ativo, só executa nos dias e horários abaixo.
              </p>
            </div>
            <Switch
              checked={cfg.enabled}
              onCheckedChange={(v) => setCfg(prev => ({ ...prev, enabled: v }))}
            />
          </div>

          <div className={`space-y-2 ${!cfg.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
            {DAY_KEYS.map(k => {
              const day = cfg.days[k];
              return (
                <div key={k} className="flex items-center gap-3 rounded-lg border p-2">
                  <div className="flex items-center gap-2 w-28">
                    <Switch
                      checked={day.enabled}
                      onCheckedChange={(v) => setDay(k, { enabled: v })}
                    />
                    <span className="text-sm font-medium">{DAY_LABELS[k]}</span>
                  </div>
                  <div className={`flex items-center gap-2 flex-1 ${!day.enabled ? 'opacity-40' : ''}`}>
                    <Input
                      type="time"
                      value={day.start}
                      onChange={(e) => setDay(k, { start: e.target.value })}
                      disabled={!day.enabled}
                      className="rounded-lg"
                    />
                    <span className="text-xs text-muted-foreground">até</span>
                    <Input
                      type="time"
                      value={day.end}
                      onChange={(e) => setDay(k, { end: e.target.value })}
                      disabled={!day.enabled}
                      className="rounded-lg"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className={!cfg.enabled ? 'opacity-50 pointer-events-none' : ''}>
            <Label className="text-sm font-medium">Mensagem fora do horário</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Enviada automaticamente quando alguém aciona fora do horário configurado.
            </p>
            <Textarea
              value={cfg.outOfHoursMessage}
              onChange={(e) => setCfg(prev => ({ ...prev, outOfHoursMessage: e.target.value }))}
              rows={3}
              className="rounded-lg"
              placeholder={DEFAULT_ACTIVE_HOURS.outOfHoursMessage}
            />
          </div>

          <div className="text-xs text-muted-foreground">
            Fuso horário: <strong>{cfg.timezone}</strong>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="rounded-xl">
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ActiveHoursDialog;