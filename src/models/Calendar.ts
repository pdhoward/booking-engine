import mongoose, { Schema } from 'mongoose';

const calendarSchema = new Schema({
  name: { type: String, required: true }, // e.g., "Cypress Resorts Main Calendar"
  owner: { type: String, default: 'Cypress Resorts' },
  type: { type: String, enum: ['hotel', 'appointment'], default: 'hotel' },
  blackouts: [{ type: Date }], // Array of blackout dates
  recurringBlackouts: { type: String }, // rrule string, e.g., 'FREQ=WEEKLY;BYDAY=SU'
  holidays: [{ date: Date, minNights: Number }], // Example rule structure
  rules: [{ // JSON rules for json-rules-engine
    conditions: Schema.Types.Mixed,
    event: Schema.Types.Mixed,
  }],
  currency: { type: String, default: 'USD' },
  cancellationPolicy: { hours: Number, fee: Number }, // e.g., { hours: 48, fee: 100 }
}, { timestamps: true });

export default mongoose.models.Calendar || mongoose.model('Calendar', calendarSchema);