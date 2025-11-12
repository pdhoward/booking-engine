// lib/calendar/normalize.ts
import type { CalendarState } from "@/types/calendar";

/**
 * Normalize a Calendar document coming from the server (Mongoose -> JSON)
 * to the client-side CalendarState shape and stable primitive types.
 */
export function normalizeCalendarFromServer(doc: any): CalendarState {
  // helper to coerce date-ish values into ISO (YYYY-MM-DD) when we only need day precision
  const toYmd = (v: any): string => {
    if (!v) return "";
    const d = new Date(v);
    return isNaN(d.getTime()) ? String(v).slice(0, 10) : d.toISOString().slice(0, 10);
  };

  return {
    _id: doc?._id ? String(doc._id) : undefined,

    name: doc?.name ?? "",
    owner: doc?.owner ?? "",
    category: (doc?.category ?? "reservations") as CalendarState["category"],
    currency: doc?.currency ?? "USD",
    cancelHours: Number(doc?.cancelHours ?? 48),
    cancelFee: Number(doc?.cancelFee ?? 0),
    version: Number(doc?.version ?? 1),
    active: Boolean(doc?.active ?? true),

    // store as strings client-side to keep inputs & keys happy
    blackouts: Array.isArray(doc?.blackouts) ? doc.blackouts.map(toYmd) : [],
    recurringBlackouts: doc?.recurringBlackouts ?? null,

    holidays: Array.isArray(doc?.holidays)
      ? doc.holidays.map((h: any) => ({
          _id: h?._id ? String(h._id) : undefined,
          date: toYmd(h?.date),
          minNights: Number(h?.minNights ?? 1),
        }))
      : [],

    minStayByWeekday: doc?.minStayByWeekday ?? {},

    seasons: Array.isArray(doc?.seasons)
      ? doc.seasons.map((s: any) => ({
          start: toYmd(s?.start),
          end: toYmd(s?.end),
          price: Number(s?.price ?? 0),
        }))
      : [],

    leadTime: {
      minDays: Number(doc?.leadTime?.minDays ?? 0),
      maxDays: Number(doc?.leadTime?.maxDays ?? 365),
    },

    // Array of mixed condition/event objects
    rules: Array.isArray(doc?.rules) ? doc.rules : [],
  };
}

/**
 * Prepare a CalendarState to send back to the server.
 * For date-like fields we keep YYYY-MM-DD; your API/DB can interpret as UTC-midnight.
 */
export function denormalizeCalendarForServer(state: CalendarState) {
  // You can convert YYYY-MM-DD back to Date if your server expects Dates.
  // Here we keep strings; your Mongoose schema can accept strings for Date fields.
  return {
    name: state.name,
    owner: state.owner,
    category: state.category,
    currency: state.currency,
    cancelHours: state.cancelHours,
    cancelFee: state.cancelFee,
    version: state.version,
    active: state.active,

    blackouts: state.blackouts, // strings OK for ISO dates
    recurringBlackouts: state.recurringBlackouts,

    holidays: state.holidays.map((h) => ({
      date: h.date,
      minNights: h.minNights ?? 1,
    })),

    minStayByWeekday: state.minStayByWeekday,

    seasons: state.seasons.map((s) => ({
      start: s.start,
      end: s.end,
      price: s.price,
    })),

    leadTime: { ...state.leadTime },

    rules: state.rules,
  };
}
