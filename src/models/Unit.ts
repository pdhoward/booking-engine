// /lib/db/models/Unit.ts
import mongoose, { Schema, models, model } from "mongoose";

const BedSchema = new Schema(
  {
    size: {
      type: String,
      enum: ["king","queen","double","twin","bunkbed","daybed","sofa_bed"],
      required: true,
    },
    count: { type: Number, default: 1, min: 1 },
  },
  { _id: false }
);

const ConfigSchema = new Schema(
  {
    squareFeet: { type: Number },
    view: {
      type: String,
      enum: ["parking","forest","mountain","stream","garden","city","courtyard"],
    },
    beds: { type: [BedSchema], default: [] },
    shower: { type: Boolean, default: true },
    bathtub: { type: Boolean, default: false },
    hotTub: { type: Boolean, default: false },
    sauna: { type: Boolean, default: false },
    ada: { type: Boolean, default: false },
  },
  { _id: false }
);

const CalendarLinkSchema = new Schema(
  {
    calendarId: { type: Schema.Types.ObjectId, ref: "Calendar", required: true },
    name: { type: String, required: true },
    version: { type: Number, required: true },
    effectiveDate: { type: String, required: true }, // store yyyy-mm-dd (UTC)
  },
  { _id: false }
);

const UnitSchema = new Schema(
  {
    unit_id: { type: String, required: true },
    tenantId: { type: String, required: true },
    name: { type: String, required: true },
    unitNumber: { type: String },
    type: {
      type: String,
      enum: ["guest_room","suite","villa","cabin","apartment","conference_room"],
      default: "guest_room",
      required: true,
    },
    description: { type: String },
    rate: { type: Number, default: 0 },
    currency: { type: String, default: "USD" },
    config: { type: ConfigSchema, default: {} },
    calendars: { type: [CalendarLinkSchema], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Helpful index for "pick the calendar effective on a date"
UnitSchema.index({ "calendars.effectiveDate": 1 });

// (Optional) static util to pick an effective calendar for a date
// Usage on server: await UnitModel.pickCalendarForDate(unitDoc, "2025-09-10")
UnitSchema.statics.pickCalendarForDate = function (unitDoc: any, isoYmd: string) {
  const links = (unitDoc?.calendars ?? []).slice().sort((a: any, b: any) => (a.effectiveDate < b.effectiveDate ? -1 : 1));
  let chosen = null;
  for (const link of links) {
    if (link.effectiveDate <= isoYmd) chosen = link;
  }
  return chosen; // null if none effective yet
};

export const UnitModel = models.Unit || model("Unit", UnitSchema);
