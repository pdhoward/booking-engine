// types/calendar.ts

export type CalendarCategory = "reservations" | "appointments";

export type CatalogRow = {
  _id: string;
  name: string;
  version: number;
  active: boolean;
};

export interface HolidayRule {
  _id?: string;                 // mongoose adds ids in arrays
  date: string | Date;          // API may serialize; accept both on client
  minNights?: number;           // optional in schema usage
}

export interface SeasonRule {
  start: string | Date;
  end: string | Date;
  price: number;
}

export interface LeadTimeRule {
  minDays: number;
  maxDays: number;
}

export interface CalendarMeta {
  _id?: string;                 // stringified ObjectId in API responses
  name: string;
  owner: string;
  category: CalendarCategory;
  currency: string;
  cancelHours: number;
  cancelFee: number;
  version: number;
  active: boolean;
}

export interface CalendarRule {
  conditions: any;              // schema.Types.Mixed
  event: any;                   // schema.Types.Mixed
}

export interface CalendarState extends CalendarMeta {
  blackouts: Array<string | Date>;        // Mongo is Date[]; accept string too
  recurringBlackouts?: string | null;     // schema has string; allow null/undefined
  holidays: HolidayRule[];                // matches { date, minNights }
  minStayByWeekday: Record<string, number>;
  seasons: SeasonRule[];
  leadTime: LeadTimeRule;
  rules: CalendarRule[];                  // 🔁 replace rulesJson with rules[]
}
