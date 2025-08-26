import type { Reservation } from "@/types/reservation";

const API = "/api/reservations";

export async function listReservations(params: {
  unitId?: string;
  calendarId?: string;
  from?: string; // yyyy-mm-dd
  to?: string;   // yyyy-mm-dd
}) {
  const qs = new URLSearchParams();
  if (params.unitId) qs.set("unitId", params.unitId);
  if (params.calendarId) qs.set("calendarId", params.calendarId);
  if (params.from && params.to) { qs.set("from", params.from); qs.set("to", params.to); }

  const res = await fetch(`${API}?${qs.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to list reservations");
  return (await res.json()) as Reservation[];
}

export async function createReservation(payload: Reservation) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || "Reservation failed");
  }
  return (await res.json()) as Reservation;
}
