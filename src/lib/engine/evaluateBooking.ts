// What: Client-only booking evaluation used in the Test drawer.

import { CalendarCategory, CalendarState } from "@/types/calendar";
import { expandDateRange, toISODate } from "@/lib/utils";

export function evaluateBookingRequest(
  cal: CalendarState,
  req: { start: string; end?: string; mode: CalendarCategory }
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // Normalize request bounds (work in yyyy-mm-dd)
  const startIso = toISODate(new Date(req.start))!;
  const endIso   = toISODate(new Date(req.end ?? req.start))!; // inclusive end for UX checks
  const requestedDates = expandDateRange(startIso, endIso);     // array of yyyy-mm-dd

  // Lead time (compare from 'today' at midnight to start date)
  const todayMid = new Date();
  todayMid.setHours(0, 0, 0, 0);
  const startDate = new Date(`${startIso}T00:00:00Z`);
  const diffDays = Math.ceil((startDate.getTime() - todayMid.getTime()) / 86400000);

  if (diffDays < (cal.leadTime?.minDays ?? 0)) {
    reasons.push(`Too soon. Requires at least ${cal.leadTime.minDays} days lead time.`);
  }
  if (diffDays > (cal.leadTime?.maxDays ?? 365)) {
    reasons.push(`Too far out. Max advance is ${cal.leadTime.maxDays} days.`);
  }

  // Blackouts
  const blackoutSet = new Set((cal.blackouts ?? []).map(String));
  for (const d of requestedDates) {
    if (blackoutSet.has(d)) {
      reasons.push(`Date ${d} is blacked out.`);
    }
  }

  // Holidays (coerce date to string and minNights to number>=1)
  const nights = Math.max(1, requestedDates.length - 1);
  for (const h of cal.holidays ?? []) {
    const hDate = typeof h.date === "string" ? h.date : toISODate(h.date as Date)!;
    const minN  = Math.max(1, Number(h.minNights ?? 1));
    if (requestedDates.includes(hDate) && nights < minN) {
      reasons.push(`Holiday ${hDate} requires minimum ${minN} nights.`);
    }
  }

  // Weekday min-stay (reservations mode only)
  if (req.mode === "reservations") {
    // Use a stable weekday key ("Sun","Mon",...) instead of locale-dependent values
    const weekdayIdx = new Date(`${startIso}T00:00:00Z`).getUTCDay(); // 0..6
    const weekdayKeys = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"] as const;
    const weekdayKey = weekdayKeys[weekdayIdx];
    const minStay = Number(cal.minStayByWeekday?.[weekdayKey] ?? 1);
    if (nights < minStay) {
      reasons.push(`Min stay from ${weekdayKey} is ${minStay} nights.`);
    }
  }

  return { ok: reasons.length === 0, reasons };
}
