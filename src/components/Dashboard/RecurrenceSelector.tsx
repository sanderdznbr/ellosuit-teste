import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Repeat, Calendar } from 'lucide-react';

export interface RecurrenceConfig {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  interval: number;
  daysOfWeek: number[]; // 0=Sunday, 1=Monday, etc.
  endType: 'never' | 'after' | 'on';
  occurrences: number;
  endDate: string;
}

interface RecurrenceSelectorProps {
  config: RecurrenceConfig;
  onChange: (config: RecurrenceConfig) => void;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Dom', fullLabel: 'Domingo' },
  { value: 1, label: 'Seg', fullLabel: 'Segunda' },
  { value: 2, label: 'Ter', fullLabel: 'Terça' },
  { value: 3, label: 'Qua', fullLabel: 'Quarta' },
  { value: 4, label: 'Qui', fullLabel: 'Quinta' },
  { value: 5, label: 'Sex', fullLabel: 'Sexta' },
  { value: 6, label: 'Sáb', fullLabel: 'Sábado' },
];

const RecurrenceSelector: React.FC<RecurrenceSelectorProps> = ({ config, onChange }) => {
  const toggleDayOfWeek = (day: number) => {
    const newDays = config.daysOfWeek.includes(day)
      ? config.daysOfWeek.filter(d => d !== day)
      : [...config.daysOfWeek, day].sort();
    onChange({ ...config, daysOfWeek: newDays });
  };

  return (
    <div className="space-y-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
      <div className="flex items-center space-x-2">
        <Checkbox
          id="recurrence-enabled"
          checked={config.enabled}
          onCheckedChange={(checked) => onChange({ ...config, enabled: checked as boolean })}
        />
        <Label htmlFor="recurrence-enabled" className="flex items-center gap-2 cursor-pointer">
          <Repeat className="h-4 w-4 text-[#3600FF]" />
          Evento Recorrente
        </Label>
      </div>

      {config.enabled && (
        <div className="space-y-4 pt-2 animate-in slide-in-from-top-2">
          {/* Frequência */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Repetir a cada</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={99}
                  value={config.interval}
                  onChange={(e) => onChange({ ...config, interval: parseInt(e.target.value) || 1 })}
                  className="w-20"
                />
                <Select
                  value={config.frequency}
                  onValueChange={(value: 'daily' | 'weekly' | 'monthly') => onChange({ ...config, frequency: value })}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">{config.interval === 1 ? 'Dia' : 'Dias'}</SelectItem>
                    <SelectItem value="weekly">{config.interval === 1 ? 'Semana' : 'Semanas'}</SelectItem>
                    <SelectItem value="monthly">{config.interval === 1 ? 'Mês' : 'Meses'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Dias da semana (apenas para repetição semanal) */}
          {config.frequency === 'weekly' && (
            <div className="space-y-2">
              <Label>Repetir nos dias</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDayOfWeek(day.value)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      config.daysOfWeek.includes(day.value)
                        ? 'bg-[#3600FF] text-white shadow-md'
                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Fim da recorrência */}
          <div className="space-y-3">
            <Label>Termina</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="end-never"
                  name="endType"
                  checked={config.endType === 'never'}
                  onChange={() => onChange({ ...config, endType: 'never' })}
                  className="text-[#3600FF]"
                />
                <Label htmlFor="end-never" className="cursor-pointer font-normal">Nunca</Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="end-after"
                  name="endType"
                  checked={config.endType === 'after'}
                  onChange={() => onChange({ ...config, endType: 'after' })}
                  className="text-[#3600FF]"
                />
                <Label htmlFor="end-after" className="cursor-pointer font-normal">Após</Label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={config.occurrences}
                  onChange={(e) => onChange({ ...config, occurrences: parseInt(e.target.value) || 1 })}
                  disabled={config.endType !== 'after'}
                  className="w-20"
                />
                <span className="text-sm text-gray-600">ocorrências</span>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="end-on"
                  name="endType"
                  checked={config.endType === 'on'}
                  onChange={() => onChange({ ...config, endType: 'on' })}
                  className="text-[#3600FF]"
                />
                <Label htmlFor="end-on" className="cursor-pointer font-normal">Em</Label>
                <Input
                  type="date"
                  value={config.endDate}
                  onChange={(e) => onChange({ ...config, endDate: e.target.value })}
                  disabled={config.endType !== 'on'}
                  className="w-40"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecurrenceSelector;
