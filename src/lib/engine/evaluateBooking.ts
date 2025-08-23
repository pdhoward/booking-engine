// What: Client-only booking evaluation used in the Test drawer.

import { CalendarCategory, CalendarState } from "@/types/calendar";
import { expandDateRange, toISODate } from "@/lib/utils";

export function evaluateBookingRequest(
  cal: CalendarState,
  req: { start: string; end?: string; mode: CalendarCategory }
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const today = new Date();
  const start = new Date(req.start);
  const end = req.end ? new Date(req.end) : new Date(req.start);

  // Lead time
  const diffDays = Math.ceil((start.getTime() - today.getTime()) / 86400000);
  if (diffDays < cal.leadTime.minDays) reasons.push(`Too soon. Requires at least ${cal.leadTime.minDays} days lead time.`);
  if (diffDays > cal.leadTime.maxDays) reasons.push(`Too far out. Max advance is ${cal.leadTime.maxDays} days.`);

  // Blackouts
  const requestedDates = expandDateRange(toISODate(start)!, toISODate(end)!);
  const blackoutSet = new Set(cal.blackouts);
  for (const d of requestedDates) if (blackoutSet.has(d)) reasons.push(`Date ${d} is blacked out.`);

  // Holidays
  const nights = Math.max(1, requestedDates.length - 1);
  for (const h of cal.holidays) {
    if (requestedDates.includes(h.date) && nights < h.minNights) {
      reasons.push(`Holiday ${h.date} requires minimum ${h.minNights} nights.`);
    }
  }

  // Min stay (reservations)
  if (req.mode === "reservations") {
    const weekday = start.toLocaleDateString(undefined, { weekday: "short" });
    const minStay = cal.minStayByWeekday[weekday] || 1;
    if (nights < minStay) reasons.push(`Min stay from ${weekday} is ${minStay} nights.`);
  }

  return { ok: reasons.length === 0, reasons };
}
