import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Clock, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AvailabilitySchedule {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

interface AvailabilityCalendarProps {
  schedules: AvailabilitySchedule[];
  onSave: (schedules: Omit<AvailabilitySchedule, 'id'>[]) => Promise<void>;
}

const DAYS = [
  { value: 0, label: 'Domingo', short: 'Dom' },
  { value: 1, label: 'Segunda', short: 'Seg' },
  { value: 2, label: 'Terça', short: 'Ter' },
  { value: 3, label: 'Quarta', short: 'Qua' },
  { value: 4, label: 'Quinta', short: 'Qui' },
  { value: 5, label: 'Sexta', short: 'Sex' },
  { value: 6, label: 'Sábado', short: 'Sáb' }
];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = i % 2 === 0 ? '00' : '30';
  return `${hour.toString().padStart(2, '0')}:${minute}`;
});

const AvailabilityCalendar: React.FC<AvailabilityCalendarProps> = ({ schedules, onSave }) => {
  const [localSchedules, setLocalSchedules] = useState<Record<number, { start: string; end: string; active: boolean }>>(() => {
    const initial: Record<number, { start: string; end: string; active: boolean }> = {};
    DAYS.forEach(day => {
      const existing = schedules.find(s => s.day_of_week === day.value);
      initial[day.value] = existing 
        ? { start: existing.start_time, end: existing.end_time, active: existing.is_active }
        : { start: '09:00', end: '18:00', active: false };
    });
    return initial;
  });
  const [saving, setSaving] = useState(false);

  const toggleDay = (dayValue: number) => {
    setLocalSchedules(prev => ({
      ...prev,
      [dayValue]: { ...prev[dayValue], active: !prev[dayValue].active }
    }));
  };

  const updateTime = (dayValue: number, field: 'start' | 'end', value: string) => {
    setLocalSchedules(prev => ({
      ...prev,
      [dayValue]: { ...prev[dayValue], [field]: value }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const schedulesToSave = DAYS
        .filter(day => localSchedules[day.value].active)
        .map(day => ({
          day_of_week: day.value,
          start_time: localSchedules[day.value].start,
          end_time: localSchedules[day.value].end,
          is_active: true
        }));
      await onSave(schedulesToSave);
    } finally {
      setSaving(false);
    }
  };

  const copyToAll = (sourceDay: number) => {
    const sourceSchedule = localSchedules[sourceDay];
    setLocalSchedules(prev => {
      const updated = { ...prev };
      DAYS.forEach(day => {
        if (day.value !== sourceDay && day.value !== 0 && day.value !== 6) {
          updated[day.value] = { ...sourceSchedule };
        }
      });
      return updated;
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5 text-primary" />
          Horários de Disponibilidade
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Configure os dias e horários em que você está disponível para reuniões
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {DAYS.map(day => (
            <div 
              key={day.value}
              className={cn(
                "flex items-center gap-4 p-4 rounded-xl border transition-all",
                localSchedules[day.value].active 
                  ? "bg-primary/5 border-primary/20" 
                  : "bg-muted/30 border-transparent"
              )}
            >
              <div className="w-24">
                <Switch
                  checked={localSchedules[day.value].active}
                  onCheckedChange={() => toggleDay(day.value)}
                />
              </div>
              <div className="w-24 font-medium">{day.label}</div>
              
              {localSchedules[day.value].active ? (
                <div className="flex items-center gap-3 flex-1">
                  <select
                    value={localSchedules[day.value].start}
                    onChange={(e) => updateTime(day.value, 'start', e.target.value)}
                    className="h-10 px-3 rounded-lg border bg-background text-sm"
                  >
                    {TIME_OPTIONS.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                  <span className="text-muted-foreground">até</span>
                  <select
                    value={localSchedules[day.value].end}
                    onChange={(e) => updateTime(day.value, 'end', e.target.value)}
                    className="h-10 px-3 rounded-lg border bg-background text-sm"
                  >
                    {TIME_OPTIONS.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => copyToAll(day.value)}
                    className="text-xs text-muted-foreground ml-2"
                  >
                    Copiar para dias úteis
                  </Button>
                </div>
              ) : (
                <span className="text-muted-foreground text-sm">Indisponível</span>
              )}
            </div>
          ))}
        </div>

        <div className="pt-4 border-t">
          <Button onClick={handleSave} disabled={saving} className="w-full">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Salvando...' : 'Salvar Disponibilidade'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AvailabilityCalendar;
