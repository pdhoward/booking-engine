// lib/api/calendars.ts
// What: Client-safe helpers to call your Next API routes.

import { CalendarState, CatalogRow } from "@/types/calendar";
import { isIsoDate } from "@/lib/utils";

const API_BASE = "/api/calendars";

/* -------------------------------------------------
 * Utility helpers
 * ------------------------------------------------- */

function ymd(input: any): string {
  const d = typeof input === "string" ? new Date(input) : input;
  return d instanceof Date && !isNaN(d.getTime())
    ? d.toISOString().slice(0, 10)
    : String(input ?? "");
}

function safeParseRules(json: string): any[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : v ? [v] : [];
  } catch {
    return [];
  }
}

/* -------------------------------------------------
 * Normalization / Denormalization
 * ------------------------------------------------- */

export function normalizeCalendarFromServer(doc: any): CalendarState {
  return {
    _id: String(doc._id ?? ""),
    name: doc.name ?? "",
    owner: doc.owner ?? "",
    category: doc.category ?? "reservations",
    currency: doc.currency ?? "USD",
    cancelHours: Number(doc.cancelHours ?? 48),
    cancelFee: Number(doc.cancelFee ?? 0),
    version: Number(doc.version ?? 1),
    active: Boolean(doc.active ?? true),
    blackouts: (doc.blackouts ?? []).map(ymd),
    recurringBlackouts: doc.recurringBlackouts || null,
    holidays: (doc.holidays ?? []).map((h: any) => ({ date: ymd(h.date), minNights: Number(h.minNights ?? 1) })),
    minStayByWeekday: doc.minStayByWeekday ?? {},
    seasons: (doc.seasons ?? []).map((s: any) => ({ start: ymd(s.start), end: ymd(s.end), price: Number(s.price ?? 0) })),
    leadTime: doc.leadTime ?? { minDays: 0, maxDays: 365 },
    rules: Array.isArray(doc.rules) ? doc.rules : [], // ✅ use rules directly
  };
}

export function denormalizeCalendarForServer(state: CalendarState): any {
  const { _id, ...rest } = state;
  return {
    ...rest,
    blackouts: rest.blackouts.map(ymd),
    recurringBlackouts: rest.recurringBlackouts || undefined,
    holidays: rest.holidays.map((h) => ({ date: ymd(h.date), minNights: h.minNights })),
    seasons: rest.seasons.map((s) => ({ start: ymd(s.start), end: ymd(s.end), price: s.price })),
    rules: rest.rules ?? [], // ✅ already structured
  };
}


/* -------------------------------------------------
 * API Calls
 * ------------------------------------------------- */

export async function fetchAllCalendars(): Promise<CatalogRow[]> {
  const res = await fetch(`${API_BASE}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load calendars");

  const data = await res.json();
  if (!Array.isArray(data)) return [];

  return data.map((d: any) => ({
    _id: String(d._id),
    name: String(d.name ?? "Unnamed"),
    version: Number(d.version ?? 1),
    active: Boolean(d.active),
  }));
}

export async function fetchCalendarById(id: string): Promise<CalendarState | null> {
  const res = await fetch(`${API_BASE}/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load calendar: ${res.statusText}`);

  const doc = await res.json();
  return normalizeCalendarFromServer(doc);
}

export async function saveCalendar(
  state: CalendarState,
  opts?: { mode?: "version" | "overwrite" }
): Promise<{ id: string; doc: CalendarState }> {
  const body = denormalizeCalendarForServer(state);
  if (opts?.mode) body.mode = opts.mode;

  const method = state._id ? "PATCH" : "POST";
  const url = `${API_BASE}${state._id ? `/${state._id}` : ""}`;

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson?.error || `Save failed (${res.status})`);
  }

  const saved = await res.json();
  return {
    id: String(saved._id ?? state._id ?? ""),
    doc: normalizeCalendarFromServer(saved),
  };
}
