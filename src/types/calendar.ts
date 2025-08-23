// What: Shared types for calendars used across components & API helpers.

export type CalendarCategory = "reservations" | "appointments";

export type CatalogRow = { _id: string; name: string; version: number; active: boolean };

export interface HolidayRule { date: string; minNights: number }
export interface SeasonRule { start: string; end: string; price: number }
export interface LeadTimeRule { minDays: number; maxDays: number }

export interface CalendarMeta {
  _id?: string;
  name: string;
  owner: string;
  category: CalendarCategory;
  currency: string;
  cancelHours: number;
  cancelFee: number;
  version: number;
  active: boolean;
}

export interface CalendarState extends CalendarMeta {
  blackouts: string[];
  recurringBlackouts?: string;
  holidays: HolidayRule[];
  minStayByWeekday: Record<string, number>;
  seasons: SeasonRule[];
  leadTime: LeadTimeRule;
  rulesJson: string;
}
