// /lib/api/units.ts
import type { Unit } from "@/types/unit";

const API = "/api/units";

const ymd = (d: any) =>
  (typeof d === "string" ? d : new Date(d).toISOString()).slice(0, 10);

export async function fetchAllUnits(): Promise<Unit[]> {
  const res = await fetch(API, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load units");
  return res.json();
}

export async function fetchUnitById(id: string): Promise<Unit | null> {
  const res = await fetch(`/api/units/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load unit");
  const doc = await res.json();

  return {
    ...doc,
    _id: String(doc._id),
    calendars: (doc.calendars ?? []).map((l: any) => ({
      calendarId: String(l.calendarId),           // <— normalize
      name: String(l.name ?? ""),
      version: Number(l.version ?? 1),
      effectiveDate: ymd(l.effectiveDate),        // <— normalize
    })),
  } as Unit;
}

export async function saveUnit(payload: Unit): Promise<Unit> {
  if (payload._id) {
    const res = await fetch(`${API}/${payload._id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to update unit");
    return res.json();
  }
  const res = await fetch(API, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to create unit");
  return res.json();
}
