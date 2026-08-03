// Weekly schedule definition and bank-of-hours calculation
import { format, startOfWeek, addDays, parseISO, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface TimeSlot {
  start: string; // "HH:mm"
  end: string;
}

export interface DaySchedule {
  slots: TimeSlot[];
  totalMinutes: number;
}

// Weekly schedule: 22h total
export const WEEKLY_SCHEDULE: Record<string, DaySchedule> = {
  monday: {
    slots: [{ start: '08:00', end: '10:00' }, { start: '14:00', end: '16:00' }],
    totalMinutes: 240,
  },
  tuesday: {
    slots: [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '16:00' }],
    totalMinutes: 360,
  },
  wednesday: {
    slots: [{ start: '08:00', end: '10:00' }, { start: '14:00', end: '16:00' }],
    totalMinutes: 240,
  },
  thursday: {
    slots: [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '16:00' }],
    totalMinutes: 360,
  },
  friday: {
    slots: [{ start: '08:00', end: '10:00' }],
    totalMinutes: 120,
  },
};

export const DAY_NAMES: Record<number, string> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

export const DAY_LABELS: Record<string, string> = {
  monday: 'Segunda',
  tuesday: 'Terça',
  wednesday: 'Quarta',
  thursday: 'Quinta',
  friday: 'Sexta',
};

export function getWeeklyExpectedMinutes(): number {
  return Object.values(WEEKLY_SCHEDULE).reduce((sum, d) => sum + d.totalMinutes, 0);
}

export function getDayExpectedMinutes(date: Date): number {
  const dayName = DAY_NAMES[date.getDay()];
  return WEEKLY_SCHEDULE[dayName]?.totalMinutes ?? 0;
}

export interface PunchRecord {
  id: string;
  userId: string;
  timestamp: Date;
  type: 'entry' | 'exit';
  date: string; // YYYY-MM-DD
}

export function calculateDailyMinutes(records: PunchRecord[]): number {
  const sorted = [...records].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  let total = 0;
  for (let i = 0; i + 1 < sorted.length; i += 2) {
    const entry = sorted[i];
    const exit = sorted[i + 1];
    if (entry && exit) {
      total += differenceInMinutes(exit.timestamp, entry.timestamp);
    }
  }
  return total;
}

export function formatMinutes(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}h${m.toString().padStart(2, '0')}m`;
}

export function formatMinutesAbs(minutes: number): string {
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${h}h${m.toString().padStart(2, '0')}m`;
}
