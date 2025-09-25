// /types/unit.ts
export type UnitType =
  | "guest_room"
  | "suite"
  | "villa"
  | "cabin"
  | "apartment"
  | "conference_room";

export type ViewType =
  | "parking"
  | "forest"
  | "mountain"
  | "stream"
  | "garden"
  | "city"
  | "courtyard";

export type BedSize =
  | "king"
  | "queen"
  | "double"
  | "twin"
  | "bunkbed"
  | "daybed"
  | "sofa_bed";

export interface BedSpec {
  size: BedSize;
  count: number; // how many beds of this size
}

export interface UnitConfig {
  squareFeet?: number;
  view?: ViewType;
  beds?: BedSpec[];
  shower?: boolean;
  bathtub?: boolean;
  hotTub?: boolean;
  sauna?: boolean;
  ada?: boolean;
}

export interface UnitCalendarLink {
  calendarId: string;      // ObjectId as string
  name: string;            // stored for fast display/snapshots
  version: number;
  effectiveDate: string;   // yyyy-mm-dd
}

export interface Unit {
  _id?: string;
  tenantId: string;
  unit_id: string;
  name: string;
  unitNumber?: string;
  type: UnitType;
  description?: string;
  rate: number;
  currency: string;        // e.g., "USD"
  config: UnitConfig;
  calendars: UnitCalendarLink[]; // multiple calendar versions over time
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}
