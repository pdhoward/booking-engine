// models/Reservation.ts
import mongoose, { Schema } from "mongoose";

const addressSchema = new Schema(
  {
    line1: String,
    line2: String,
    city: String,
    state: String,
    postalCode: String,
    country: String,
  },
  { _id: false }
);

const guestSchema = new Schema(
  {
    firstName: { type: String },
    lastName: { type: String },
    email: { type: String, lowercase: true, index: true },
    phone: { type: String },
    address: { type: addressSchema },
  },
  { _id: false }
);

/**
 * DO NOT store PAN (card number) or CVC.
 * Store only tokenized references and non-sensitive metadata.
 */
const paymentSchema = new Schema(
  {
    // which processor/token vault is this from
    provider: { type: String, enum: ["stripe", "braintree", "manual", "none"], default: "none" },

    // tokenized references — safe to store
    customerId: { type: String, index: true },      // e.g., Stripe customer ID
    methodId:   { type: String, index: true },      // e.g., Stripe payment_method ID
    intentId:   { type: String },                   // e.g., payment intent/authorization id

    // card meta (non-sensitive)
    brand:    { type: String },                     // 'visa', 'mastercard', etc.
    last4:    { type: String },                     // '4242'
    expMonth: { type: Number, min: 1, max: 12 },
    expYear:  { type: Number },

    // holds/authorizations (amount in minor units or decimal; be consistent)
    holdAmount: { type: Number, default: 0 },
    currency:   { type: String, default: "USD" },

    // If you absolutely must store something more sensitive, mark it select:false
    // and encrypt with CSFLE. But recommended: DON'T STORE IT.
    // encryptedBin: { type: String, select: false },
  },
  { _id: false }
);

const reservationSchema = new Schema(
  {
    unitId:      { type: Schema.Types.ObjectId, ref: "Unit", required: true, index: true },
    unitName:    { type: String, required: true },
    unitNumber:  { type: String },

    calendarId:  { type: Schema.Types.ObjectId, ref: "Calendar", required: true, index: true },

    // Dates stored as UTC; endDate is exclusive
    startDate:   { type: Date, required: true },
    endDate:     { type: Date, required: true },

    // Snapshot the commercial terms at time of booking
    rate:        { type: Number, required: true },
    currency:    { type: String, required: true },

    cancelHours: { type: Number, required: true },
    cancelFee:   { type: Number, required: true },

    // NEW: guest snapshot
    guest:       { type: guestSchema },

    // NEW: payment snapshot (tokenized)
    payment:     { type: paymentSchema },

    status:      { type: String, enum: ["hold", "confirmed", "cancelled"], default: "confirmed", index: true },
  },
  { timestamps: true }
);

// Optimized for the overlap query you run
reservationSchema.index({ unitId: 1, status: 1, startDate: 1, endDate: 1 });

// Optional: narrow index when you often look up by email in a date window
// reservationSchema.index({ "guest.email": 1, startDate: 1 });

export default mongoose.models.Reservation || mongoose.model("Reservation", reservationSchema);
