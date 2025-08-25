// /lib/api/units.ts
import type { Unit } from "@/types/unit";

const API = "/api/units";

export async function fetchAllUnits(): Promise<Unit[]> {
  const res = await fetch(API, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load units");
  return res.json();
}

export async function fetchUnitById(id: string): Promise<Unit | null> {
  const res = await fetch(`${API}/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load unit");
  return res.json();
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
