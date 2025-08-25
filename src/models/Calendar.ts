import mongoose, { Schema } from 'mongoose';

const calendarSchema = new Schema({
name: { type: String, required: true },
owner: { type: String, default: "" },
category: { type: String, enum: ["reservations", "appointments"], default: "reservations" },
currency: { type: String, default: "USD" },
cancelHours: { type: Number, default: 48 },
cancelFee: { type: Number, default: 0 },
version: { type: Number, default: 1 },
active: { type: Boolean, default: true },
blackouts: [{ type: Date }],
recurringBlackouts: { type: String },
holidays: [{ date: Date, minNights: Number }],
minStayByWeekday: { type: Schema.Types.Mixed },
seasons: [{ start: Date, end: Date, price: Number }],
leadTime: { minDays: Number, maxDays: Number },
rules: [{ conditions: Schema.Types.Mixed, event: Schema.Types.Mixed }],
}, { timestamps: true });

// ✅ Ensure uniqueness on (name, version)
calendarSchema.index({ name: 1, version: 1 }, { unique: true });

calendarSchema.virtual("units", {
  ref: "Unit",
  localField: "_id",
  foreignField: "calendars.calendarId",
  justOne: false,
});


export default mongoose.models.Calendar || mongoose.model('Calendar', calendarSchema);