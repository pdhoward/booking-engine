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

// lib/api/reservations.ts
export type ReservationLite = {
  _id: string;
  startDate: string;            // ISO
  endDate: string;              // ISO (exclusive)
  status: "hold" | "confirmed" | "cancelled";
  unitName?: string;            // <-- IMPORTANT for the CalendarGrid title
};

export async function fetchReservationsByUnit(
  unitId: string,
  startYmd: string, // inclusive
  endYmd: string    // exclusive
): Promise<ReservationLite[]> {
  const url = `/api/reservations?unitId=${encodeURIComponent(unitId)}&start=${startYmd}&end=${endYmd}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch reservations: ${await res.text()}`);
  const json = await res.json();
  return (json?.items ?? []) as ReservationLite[];
}

export async function fetchReservationsByCalendar(
  calendarId: string,
  startYmd: string,
  endYmd: string
): Promise<ReservationLite[]> {
  const url = `/api/reservations?calendarId=${encodeURIComponent(calendarId)}&start=${startYmd}&end=${endYmd}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  return (json?.items ?? []) as ReservationLite[];
}

