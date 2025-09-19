
import { toYMD } from "./date";

/** Pick the latest effective calendar link on/ before the given date. */
export function pickCalendarLink(links: any[], startYmd: string) {
  const sMs = Date.parse(startYmd);
  const normalized = (links ?? []).map((l) => ({
    calendarId: String(l.calendarId),
    name: String(l.name ?? ""),
    version: Number(l.version ?? 1),
    effectiveDate: toYMD(l.effectiveDate),
  }));
  const eligible = normalized
    .filter((l) => Number.isFinite(Date.parse(l.effectiveDate)) && Date.parse(l.effectiveDate) <= sMs)
    .sort((a, b) => Date.parse(a.effectiveDate) - Date.parse(b.effectiveDate));
  return eligible.at(-1) || null;
}
