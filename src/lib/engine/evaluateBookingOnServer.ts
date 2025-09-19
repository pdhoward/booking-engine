// /lib/booking/evaluateServer.ts
type CalendarState = {
  leadTime: { minDays: number; maxDays: number };
  blackouts: string[]; // ISO ymd[] on server; if Date[], pre-format before calling
  holidays: { date: string; minNights: number }[];
  minStayByWeekday: Record<string, number>;
};

function expandRangeYmd(startYmd: string, endYmd: string) {
  const days: string[] = [];
  let d = new Date(`${startYmd}T00:00:00Z`);
  const end = new Date(`${endYmd}T00:00:00Z`);
  while (d <= end) {
    days.push(d.toISOString().slice(0, 10));
    d = new Date(d.getTime() + 86400000);
  }
  return days;
}

export function evaluateBookingServer(
  cal: CalendarState,
  req: { start: string; end?: string; mode: "reservations" | "appointments" }
): { ok: boolean; reason_codes: string[] } {
  const reasons: string[] = [];
  const today = new Date(); // now
  const start = new Date(`${req.start}T00:00:00Z`);
  const end = req.end ? new Date(`${req.end}T00:00:00Z`) : new Date(`${req.start}T00:00:00Z`);

  // Lead time
  const diffDays = Math.ceil((start.getTime() - Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) / 86400000);
  if (diffDays < cal.leadTime.minDays) reasons.push("LEAD_TOO_SOON");
  if (diffDays > cal.leadTime.maxDays) reasons.push("LEAD_TOO_FAR");

  // Blackouts
  const requested = expandRangeYmd(req.start, req.end ?? req.start);
  const blackout = new Set(cal.blackouts);
  for (const d of requested) {
    if (blackout.has(d)) { reasons.push("BLACKOUT"); break; }
  }

  // Holidays & min nights
  const nights = Math.max(1, requested.length - 1);
  for (const h of cal.holidays || []) {
    if (requested.includes(h.date) && nights < (h.minNights || 1)) {
      reasons.push("HOLIDAY_MIN_STAY");
      break;
    }
  }

  // Min stay by weekday (reservations)
  if (req.mode === "reservations") {
    const weekdayIdx = start.getUTCDay(); // 0..6
    const weekday = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][weekdayIdx];
    const minStay = cal.minStayByWeekday?.[weekday] || 1;
    if (nights < minStay) reasons.push("MIN_STAY");
  }

  return { ok: reasons.length === 0, reason_codes: reasons };
}
