// lib/api/reservations.ts
export type CreateReservationPayload = {
  unitId: string;
  unitName: string;
  unitNumber?: string;
  calendarId: string;
  calendarName: string;
  startYmd: string;   // inclusive
  endYmd: string;     // EXCLUSIVE
  rate: number;
  currency: string;
};

export async function createReservation(payload: CreateReservationPayload) {
  const res = await fetch("/api/reservations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to create reservation");
  return data as { _id: string; startDate: string; endDate: string };
}

export async function checkReservationOverlap(params: {
  unitId: string;
  startYmd: string;  // inclusive
  endYmd: string;    // EXCLUSIVE
}) {
  const qs = new URLSearchParams({
    unitId: params.unitId,
    start: params.startYmd,
    end: params.endYmd,
  });
  const res = await fetch(`/api/reservations?${qs.toString()}`, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to check overlaps");
  return data as { overlap: boolean; items: Array<{ _id: string; startDate: string; endDate: string; status: string }> };
}
