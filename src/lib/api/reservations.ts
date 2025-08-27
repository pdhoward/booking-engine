export type CreateReservationPayload = {
  unitId: string;
  unitName: string;
  unitNumber?: string;
  calendarId: string;
  calendarName: string;
  startYmd: string;   // yyyy-mm-dd (UTC)
  endYmd: string;     // yyyy-mm-dd EXCLUSIVE (pass +1 day from UI)
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
  return data as {
    _id: string;
    startDate: string; // ISO
    endDate: string;   // ISO
  };
}
