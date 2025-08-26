import mongoose, { Schema } from "mongoose";

const reservationSchema = new Schema(
  {
    unitId: { type: Schema.Types.ObjectId, ref: "Unit", required: true, index: true },
    unitName: { type: String, required: true },
    unitNumber: { type: String },
    calendarId: { type: Schema.Types.ObjectId, ref: "Calendar", required: true, index: true },

    // Dates are stored as yyyy-mm-dd at UTC midnight
    start: { type: Date, required: true }, // inclusive
    end: { type: Date, required: true },   // inclusive

    nights: { type: Number, required: true },

    // Snapshot the commercial terms at time of booking
    rate: { type: Number, required: true },
    currency: { type: String, required: true },

    cancelHours: { type: Number, required: true },
    cancelFee: { type: Number, required: true },

    status: { type: String, enum: ["hold", "confirmed", "cancelled"], default: "confirmed", index: true },
  },
  { timestamps: true }
);

// Test for overlap checks
// overlap condition: req.start <= existing.end AND req.end >= existing.start
reservationSchema.index({ unitId: 1, start: 1, end: 1, status: 1 });

export default mongoose.models.Reservation || mongoose.model("Reservation", reservationSchema);
