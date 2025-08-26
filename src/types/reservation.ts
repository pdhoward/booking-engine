export type ReservationStatus = "hold" | "confirmed" | "cancelled";

export interface Reservation {
  _id?: string;
  unitId: string;
  unitName: string;
  unitNumber?: string;
  calendarId: string;
  start: string; // yyyy-mm-dd (inclusive)
  end: string;   // yyyy-mm-dd (inclusive)
  nights: number;
  rate: number;
  currency: string;
  cancelHours: number;
  cancelFee: number;
  status: ReservationStatus;
  createdAt?: string;
  updatedAt?: string;
}
