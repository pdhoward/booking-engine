// /lib/db/models/Unit.ts
import mongoose, { Schema, models, model } from "mongoose";

/* ----------------------------- sub-schemas ------------------------------ */

const BedSchema = new Schema(
  {
    size: {
      type: String,
      enum: ["king", "queen", "double", "twin", "bunkbed", "daybed", "sofa_bed"],
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
      enum: ["parking", "forest", "mountain", "stream", "garden", "city", "courtyard"],
    },
    beds: { type: [BedSchema], default: [] },
    bedrooms: { type: Number }, // merged schema
    bathrooms: { type: Number }, // merged schema
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
    effectiveDate: { type: String, required: true }, // yyyy-mm-dd (UTC)
  },
  { _id: false }
);

const OccupancySchema = new Schema(
  {
    sleeps: { type: Number },
    maxAdults: { type: Number, default: 0 },
    maxChildren: { type: Number, default: 0 },
    extraBedAvailable: { type: Boolean, default: false },
    cribAvailable: { type: Boolean, default: false },
  },
  { _id: false }
);

const AmenitiesSchema = new Schema(
  {
    raw: { type: [String], default: [] },
    wellness: { type: [String], default: [] },
    bath: { type: [String], default: [] },
    kitchenette: { type: [String], default: [] },
    outdoor: { type: [String], default: [] },
    tech: { type: [String], default: [] },
    view: { type: [String], default: [] },
    room: { type: [String], default: [] },
    services: { type: [String], default: [] },
    accessibility: { type: [String], default: [] },
  },
  { _id: false }
);

const LocationSchema = new Schema(
  {
    displayAddress: { type: String, default: "" },
    unitPositionNotes: { type: String, default: "" },
    floorLevel: { type: Number, default: null },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    coordinates: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    wayfinding: { type: [String], default: [] },
  },
  { _id: false }
);

const ImageSchema = new Schema(
  {
    url: { type: String, required: true },
    role: {
      type: String,
      enum: ["hero", "gallery", "floorplan", "amenity", "view"],
      default: "gallery",
    },
    alt: { type: String, default: "" },
    caption: { type: String, default: "" },
    order: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const PoliciesSchema = new Schema(
  {
    checkInTime: { type: String, default: "15:00" },
    checkOutTime: { type: String, default: "11:00" },
    smoking: { type: String, enum: ["prohibited", "permitted"], default: "prohibited" },
    pets: {
      allowed: { type: Boolean, default: false },
      notes: { type: String, default: "" },
    },
    cancellation: {
      windowHours: { type: Number, default: null },
      penaltyType: { type: String, default: null }, // e.g., firstNight | percentage
      penaltyValue: { type: Number, default: null },
    },
    securityDeposit: {
      required: { type: Boolean, default: false },
      amount: { type: Number, default: null },
      currency: { type: String, default: "USD" },
    },
    minStayNights: { type: Number, default: null },
  },
  { _id: false }
);

const TechSchema = new Schema(
  {
    wifi: {
      available: { type: Boolean, default: true },
      bandwidthMbps: { type: Number, default: null },
    },
    tv: {
      available: { type: Boolean, default: true },
      sizeInches: { type: Number, default: null },
      channels: { type: [String], default: [] },
      casting: { type: Boolean, default: true },
    },
    audio: { bluetoothSpeaker: { type: Boolean, default: false } },
    smartHome: {
      voiceAssistant: { type: Boolean, default: false },
      smartThermostat: { type: Boolean, default: false },
    },
  },
  { _id: false }
);

const SafetySchema = new Schema(
  {
    smokeDetector: { type: Boolean, default: true },
    carbonMonoxideDetector: { type: Boolean, default: true },
    fireExtinguisher: { type: Boolean, default: true },
    firstAidKit: { type: Boolean, default: true },
    emergencyInfo: { type: String, default: "" },
  },
  { _id: false }
);

const HousekeepingSchema = new Schema(
  {
    cleaningFrequency: {
      type: String,
      enum: ["daily", "everyOtherDay", "onRequest"],
      default: "daily",
    },
    linensChange: {
      type: String,
      enum: ["daily", "everyOtherDay", "onRequest"],
      default: "everyOtherDay",
    },
    towelsChange: {
      type: String,
      enum: ["daily", "everyOtherDay", "onRequest"],
      default: "daily",
    },
    turnDownService: { type: Boolean, default: false },
  },
  { _id: false }
);

const FeesTaxesSchema = new Schema(
  {
    resortFee: {
      amount: { type: Number, default: null },
      currency: { type: String, default: "USD" },
      per: { type: String, enum: ["night", "stay"], default: "night" },
    },
    cleaningFee: {
      amount: { type: Number, default: null },
      currency: { type: String, default: "USD" },
      per: { type: String, enum: ["night", "stay"], default: "stay" },
    },
    taxes: {
      type: [
        new Schema(
          {
            name: { type: String, required: true },
            rate: { type: Number, required: true }, // 0.07 = 7%
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { _id: false }
);

const RatePlanSchema = new Schema(
  {
    code: { type: String, required: true },
    name: { type: String, required: true },
    currency: { type: String, default: "USD" },
    baseRate: { type: Number, required: true },
    included: { type: [String], default: [] },
    cancellationPolicyRef: { type: String, default: null },
  },
  { _id: false }
);

const SeoSchema = new Schema(
  {
    slug: { type: String },
    title: { type: String },
    metaDescription: { type: String },
  },
  { _id: false }
);

const MetadataSchema = new Schema(
  {
    schemaVersion: { type: String },
    source: { type: String },
    sourceNotes: { type: Schema.Types.Mixed }, // arbitrary record
  },
  { _id: false }
);

/* --------------------------------- model --------------------------------- */

const UnitSchema = new Schema(
  {
    unit_id: { type: String, required: true }, // your stable public key
    tenantId: { type: String, required: true },

    name: { type: String, required: true },
    unitNumber: { type: String },
    type: {
      type: String,
      enum: ["guest_room", "suite", "villa", "cabin", "apartment", "conference_room"],
      default: "guest_room",
      required: true,
    },
    description: { type: String },

    rate: { type: Number, default: 0 },
    currency: { type: String, default: "USD" },

    config: { type: ConfigSchema, default: {} },
    calendars: { type: [CalendarLinkSchema], default: [] },

    // new merged sections
    slug: { type: String },
    occupancy: { type: OccupancySchema, default: {} },
    amenities: { type: AmenitiesSchema, default: {} },
    location: { type: LocationSchema, default: {} },
    images: { type: [ImageSchema], default: [] },
    policies: { type: PoliciesSchema, default: {} },
    tech: { type: TechSchema, default: {} },
    safety: { type: SafetySchema, default: {} },
    housekeeping: { type: HousekeepingSchema, default: {} },
    feesAndTaxes: { type: FeesTaxesSchema, default: {} },
    ratePlans: { type: [RatePlanSchema], default: [] },

    labels: { type: [String], default: [] },
    tags: { type: [String], default: [] },

    seo: { type: SeoSchema, default: {} },
    metadata: { type: MetadataSchema, default: {} },

    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

/* -------------------------------- indexes -------------------------------- */

// calendar effective lookup (you had this)
UnitSchema.index({ "calendars.effectiveDate": 1 });

// commonly used filters
UnitSchema.index({ tenantId: 1, active: 1 });
UnitSchema.index({ tenantId: 1, unit_id: 1 }, { unique: true });

// if slugs are unique per tenant, enforce it (partial so null/absent is allowed)
UnitSchema.index(
  { tenantId: 1, slug: 1 },
  { unique: true, partialFilterExpression: { slug: { $type: "string" } } }
);

// helpful text search (tune as needed)
try {
  UnitSchema.index({ name: "text", description: "text", "seo.metaDescription": "text" });
} catch { /* index may already exist in dev hot-reload */ }

/* ------------------------------ static utils ----------------------------- */

// Usage: await UnitModel.pickCalendarForDate(unitDoc, "2025-09-10")
UnitSchema.statics.pickCalendarForDate = function (unitDoc: any, isoYmd: string) {
  const links = (unitDoc?.calendars ?? [])
    .slice()
    .sort((a: any, b: any) => (a.effectiveDate < b.effectiveDate ? -1 : 1));
  let chosen: any = null;
  for (const link of links) {
    if (link.effectiveDate <= isoYmd) chosen = link;
  }
  return chosen; // null if none effective yet
};

/* --------------------------------- export -------------------------------- */

export const UnitModel =
  models.Unit || model("Unit", UnitSchema);
