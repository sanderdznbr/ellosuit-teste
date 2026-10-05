// Shared utilities for "active hours" configuration on Chatbots and Automations.
// Stored inside trigger_config.active_hours.

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface DaySchedule {
  enabled: boolean;
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
}

export interface ActiveHoursConfig {
  enabled: boolean;
  timezone: string; // IANA, default America/Sao_Paulo
  days: Record<DayKey, DaySchedule>;
  outOfHoursMessage: string;
}

export const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export const DAY_LABELS: Record<DayKey, string> = {
  mon: 'Segunda',
  tue: 'Terça',
  wed: 'Quarta',
  thu: 'Quinta',
  fri: 'Sexta',
  sat: 'Sábado',
  sun: 'Domingo',
};

export const DEFAULT_ACTIVE_HOURS: ActiveHoursConfig = {
  enabled: false,
  timezone: 'America/Sao_Paulo',
  days: {
    mon: { enabled: true, start: '09:00', end: '18:00' },
    tue: { enabled: true, start: '09:00', end: '18:00' },
    wed: { enabled: true, start: '09:00', end: '18:00' },
    thu: { enabled: true, start: '09:00', end: '18:00' },
    fri: { enabled: true, start: '09:00', end: '18:00' },
    sat: { enabled: false, start: '09:00', end: '13:00' },
    sun: { enabled: false, start: '09:00', end: '13:00' },
  },
  outOfHoursMessage:
    'Olá! 👋 Nosso atendimento automático está fora do horário no momento. Responderemos assim que retornarmos.',
};

export function normalizeActiveHours(raw: any): ActiveHoursConfig {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_ACTIVE_HOURS };
  const days = { ...DEFAULT_ACTIVE_HOURS.days };
  if (raw.days && typeof raw.days === 'object') {
    for (const k of DAY_KEYS) {
      const d = raw.days[k];
      if (d && typeof d === 'object') {
        days[k] = {
          enabled: Boolean(d.enabled),
          start: typeof d.start === 'string' ? d.start : DEFAULT_ACTIVE_HOURS.days[k].start,
          end: typeof d.end === 'string' ? d.end : DEFAULT_ACTIVE_HOURS.days[k].end,
        };
      }
    }
  }
  return {
    enabled: Boolean(raw.enabled),
    timezone: typeof raw.timezone === 'string' ? raw.timezone : DEFAULT_ACTIVE_HOURS.timezone,
    days,
    outOfHoursMessage:
      typeof raw.outOfHoursMessage === 'string'
        ? raw.outOfHoursMessage
        : DEFAULT_ACTIVE_HOURS.outOfHoursMessage,
  };
}

const DAY_FROM_JS: Record<number, DayKey> = {
  0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat',
};

/** Returns { weekday, hh, mm } in the configured timezone. */
function nowInTz(timezone: string): { weekday: number; hh: number; mm: number } {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = fmt.formatToParts(new Date());
    const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const weekday = wdMap[parts.find(p => p.type === 'weekday')?.value || 'Mon'] ?? 1;
    const hh = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    const mm = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
    return { weekday, hh, mm };
  } catch {
    const d = new Date();
    return { weekday: d.getDay(), hh: d.getHours(), mm: d.getMinutes() };
  }
}

function toMinutes(t: string): number {
  const [h, m] = (t || '0:0').split(':').map(n => parseInt(n, 10) || 0);
  return h * 60 + m;
}

/** True if current moment is inside the configured active window. If config disabled, always true. */
export function isWithinActiveHours(cfg: ActiveHoursConfig | null | undefined): boolean {
  const c = normalizeActiveHours(cfg);
  if (!c.enabled) return true;
  const { weekday, hh, mm } = nowInTz(c.timezone);
  const dayKey = DAY_FROM_JS[weekday];
  const day = c.days[dayKey];
  if (!day || !day.enabled) return false;
  const cur = hh * 60 + mm;
  const s = toMinutes(day.start);
  const e = toMinutes(day.end);
  if (e <= s) return cur >= s; // overnight handling: open until midnight
  return cur >= s && cur < e;
}

export function summarizeActiveHours(cfg: ActiveHoursConfig | null | undefined): string {
  const c = normalizeActiveHours(cfg);
  if (!c.enabled) return 'Sempre ativo';
  const enabled = DAY_KEYS.filter(k => c.days[k].enabled);
  if (enabled.length === 0) return 'Nenhum dia configurado';
  if (enabled.length === 7) return `Todos os dias ${c.days.mon.start}-${c.days.mon.end}`;
  return enabled.map(k => `${DAY_LABELS[k].slice(0, 3)} ${c.days[k].start}-${c.days[k].end}`).join(' · ');
}