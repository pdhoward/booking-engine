
import { parseISO, eachDayOfInterval, isWithinInterval, format, isSameDay } from 'date-fns';
import { RRule, Weekday } from 'rrule';
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function buildAvailabilityGrid(calendar: any, year: number) {
  const start = parseISO(`${year}-01-01`);
  const end = parseISO(`${year}-12-31`);
  const allDays = eachDayOfInterval({ start, end });

  const blackoutDates: Date[] = [];
  if (calendar.recurringBlackouts) {
    const rule = RRule.fromString(calendar.recurringBlackouts);
    blackoutDates.push(...rule.between(start, end, true));
  }

  return allDays.filter(day => {
    return !calendar.blackouts.some((b: Date) => isSameDay(b, day)) &&
           !blackoutDates.some(b => isSameDay(b, day));
  });
}

export function validateCalendarIntegrity(calendar: any) {
  const errors: string[] = [];
  // Add checks as in previous example
  if (errors.length > 0) throw new Error(errors.join('; '));
}


/* ---------- helpers ---------- */

export function toISODate(d?: Date): string | null {
  if (!d) return null;
  // normalize to local date yyyy-mm-dd
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function expandDateRange(startISO: string, endISO: string): string[] {
  const out: string[] = [];
  const [sy, sm, sd] = startISO.split('-').map(Number);
  const [ey, em, ed] = endISO.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    out.push(toISODate(d)!);
  }
  return out;
}

export function unique(arr: string[]) {
  return Array.from(new Set(arr)).sort();
}

export function isIsoDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// Quick weekday selector
export const weekdayChoice: { label: string; value: Weekday }[] = [
  { label: 'MO', value: RRule.MO },
  { label: 'TU', value: RRule.TU },
  { label: 'WE', value: RRule.WE },
  { label: 'TH', value: RRule.TH },
  { label: 'FR', value: RRule.FR },
  { label: 'SA', value: RRule.SA },
  { label: 'SU', value: RRule.SU },
];

