import type { Unit } from "@/types/unit";
import type { CalendarState } from "@/types/calendar";
import { fetchCalendarById } from "@/lib/api/calendars";
import { listReservations } from "@/lib/api/reservations";
import { expandDateRange, toISODate } from "@/lib/utils";
import { evaluateBookingRequest } from "@/lib/engine/evaluateBooking";

export function toYMD(d: Date) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
}

export function addDaysYMD(ymd: string, days: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  return toYMD(dt);
}

/** Choose the latest link whose effectiveDate <= startYmd */
export async function resolveCalendarForDate(unit: Unit, startYmd: string): Promise<{ cal: CalendarState | null; link?: { calendarId: string } }> {
  const links = [...(unit.calendars || [])].filter(l => l.effectiveDate <= startYmd);
  if (!links.length) return { cal: null };
  links.sort((a, b) => (a.effectiveDate < b.effectiveDate ? 1 : -1));
  const choice = links[0];
  const cal = await fetchCalendarById(choice.calendarId);
  return { cal, link: { calendarId: choice.calendarId } };
}

/** Full availability check: calendar rules + overlap */
export async function checkUnitAvailability(
  unit: Unit,
  startYmd: string,
  endYmd: string
): Promise<{ ok: boolean; reasons: string[]; cal?: CalendarState; calendarId?: string; nights: number }> {
  const reasons: string[] = [];
  const { cal, link } = await resolveCalendarForDate(unit, startYmd);
  if (!cal || !link) {
    reasons.push("No applicable calendar for the requested start date.");
    return { ok: false, reasons, nights: 0 };
  }

  // First, evaluate against calendar rules
  const evalRes = evaluateBookingRequest(cal, { start: startYmd, end: endYmd, mode: "reservations" });
  if (!evalRes.ok) reasons.push(...evalRes.reasons);

  // Overlap check against existing reservations for this unit
  const existing = await listReservations({ unitId: String(unit._id), from: startYmd, to: endYmd });
  if (existing.length > 0) reasons.push("Unit already reserved on one or more requested dates.");

  const nights = Math.max(1, expandDateRange(startYmd, endYmd).length - 1);
  return { ok: reasons.length === 0, reasons, cal, calendarId: link.calendarId, nights };
}
