// What: Client-safe helpers to call your Next API routes.

import { CalendarState, CatalogRow } from "@/types/calendar";
import { isIsoDate } from "@/lib/utils";

const API_BASE = "/api/calendars";

function ymd(d: any): string {
  const iso = typeof d === "string" ? d : new Date(d).toISOString();
  return iso.slice(0, 10);
}

function safeParseRules(json: string): any[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : v ? [v] : [];
  } catch {
    return [];
  }
}

export function normalizeCalendar(doc: any): CalendarState {
  return {
    _id: String(doc._id),
    name: doc.name ?? "",
    owner: doc.owner ?? "",
    category: (doc.category ?? "reservations"),
    currency: doc.currency ?? "USD",
    cancelHours: Number(doc.cancelHours ?? doc.cancellationPolicy?.hours ?? 48),
    cancelFee: Number(doc.cancelFee ?? doc.cancellationPolicy?.fee ?? 0),
    version: Number(doc.version ?? 1),
    active: Boolean(doc.active ?? true),
    blackouts: (doc.blackouts ?? []).map(ymd),
    recurringBlackouts: doc.recurringBlackouts || undefined,
    holidays: (doc.holidays ?? []).map((h: any) => ({ date: ymd(h.date), minNights: Number(h.minNights ?? 1) })),
    minStayByWeekday: doc.minStayByWeekday ?? {},
    seasons: (doc.seasons ?? []).map((s: any) => ({ start: ymd(s.start), end: ymd(s.end), price: Number(s.price ?? 0) })),
    leadTime: doc.leadTime ?? { minDays: 0, maxDays: 365 },
    rulesJson: JSON.stringify(doc.rules ?? [], null, 2),
  };
}

export async function fetchAllCalendars(): Promise<CatalogRow[]> {
  const res = await fetch(`${API_BASE}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load calendars");
  const data = await res.json();
  return (data as any[]).map((d) => ({
    _id: String(d._id),
    name: String(d.name),
    version: Number(d.version ?? 1),
    active: Boolean(d.active),
  }));
}

export async function fetchCalendarById(id: string): Promise<CalendarState | null> {
  const res = await fetch(`${API_BASE}/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load calendar");
  const doc = await res.json();
  return normalizeCalendar(doc);
}

export async function saveCalendar(
  payload: CalendarState,
  opts?: { mode?: "version" | "overwrite" }
): Promise<{ id: string; doc: CalendarState }> {
  const { _id, rulesJson, ...rest } = payload;

  const body = {
    ...rest,
    blackouts: rest.blackouts.map(ymd),
    recurringBlackouts: rest.recurringBlackouts || undefined,
    holidays: rest.holidays.map((h) => ({ date: ymd(h.date), minNights: h.minNights })),
    seasons: rest.seasons.map((s) => ({ start: ymd(s.start), end: s.end, price: s.price })),
    rules: safeParseRules(rulesJson),
    ...(opts?.mode ? { mode: opts.mode } : {}),
  };

  const res = await fetch(`${API_BASE}${_id ? `/${_id}` : ""}`, {
    method: _id ? "PATCH" : "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || "Save failed");
  }

  const saved = await res.json();
  return { id: String(saved._id), doc: normalizeCalendar(saved) };
}
