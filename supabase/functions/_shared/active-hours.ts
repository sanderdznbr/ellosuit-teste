// Server-side mirror of src/lib/active-hours.ts (Deno).

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface DaySchedule {
  enabled: boolean;
  start: string;
  end: string;
}

export interface ActiveHoursConfig {
  enabled: boolean;
  timezone: string;
  days: Record<DayKey, DaySchedule>;
  outOfHoursMessage: string;
}

const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const DEFAULTS: ActiveHoursConfig = {
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
  if (!raw || typeof raw !== 'object') return JSON.parse(JSON.stringify(DEFAULTS));
  const days: any = JSON.parse(JSON.stringify(DEFAULTS.days));
  if (raw.days && typeof raw.days === 'object') {
    for (const k of DAY_KEYS) {
      const d = raw.days[k];
      if (d && typeof d === 'object') {
        days[k] = {
          enabled: Boolean(d.enabled),
          start: typeof d.start === 'string' ? d.start : DEFAULTS.days[k].start,
          end: typeof d.end === 'string' ? d.end : DEFAULTS.days[k].end,
        };
      }
    }
  }
  return {
    enabled: Boolean(raw.enabled),
    timezone: typeof raw.timezone === 'string' ? raw.timezone : DEFAULTS.timezone,
    days,
    outOfHoursMessage:
      typeof raw.outOfHoursMessage === 'string' ? raw.outOfHoursMessage : DEFAULTS.outOfHoursMessage,
  };
}

const WDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const DAY_FROM_JS: Record<number, DayKey> = {
  0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat',
};

function nowInTz(timezone: string): { weekday: number; hh: number; mm: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date());
    const weekday = WDAY[parts.find(p => p.type === 'weekday')?.value || 'Mon'] ?? 1;
    const hh = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    const mm = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
    return { weekday, hh, mm };
  } catch {
    const d = new Date();
    return { weekday: d.getDay(), hh: d.getHours(), mm: d.getMinutes() };
  }
}

function toMin(t: string): number {
  const [h, m] = (t || '0:0').split(':').map(n => parseInt(n, 10) || 0);
  return h * 60 + m;
}

export function isWithinActiveHours(raw: any): boolean {
  const c = normalizeActiveHours(raw);
  if (!c.enabled) return true;
  const { weekday, hh, mm } = nowInTz(c.timezone);
  const day = c.days[DAY_FROM_JS[weekday]];
  if (!day || !day.enabled) return false;
  const cur = hh * 60 + mm;
  const s = toMin(day.start);
  const e = toMin(day.end);
  if (e <= s) return cur >= s;
  return cur >= s && cur < e;
}

/** Extract active_hours block from trigger_config (or whole record). */
export function readActiveHours(triggerConfig: any): ActiveHoursConfig | null {
  if (!triggerConfig || typeof triggerConfig !== 'object') return null;
  const raw = (triggerConfig as any).active_hours;
  if (!raw) return null;
  return normalizeActiveHours(raw);
}