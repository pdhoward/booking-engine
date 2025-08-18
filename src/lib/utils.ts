
import { parseISO, eachDayOfInterval, isWithinInterval, format, isSameDay } from 'date-fns';
import { RRule } from 'rrule';
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
