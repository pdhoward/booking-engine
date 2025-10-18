// models/Payment.ts
import mongoose, { Schema, Model, InferSchemaType } from "mongoose";

/**
 * Payment document shape.
 * - Webhook will later fill: status, cardBrand, last4, customerId
 * - We keep a unique index on stripePaymentIntentId to upsert safely
 */
const PaymentSchema = new Schema(
  {
    tenantId: { type: String, required: true, index: true },
    reservationId: { type: String, default: null, index: true },
    amountCents: { type: Number, required: true, min: 1 },
    currency: { type: String, required: true }, // ISO (e.g., "USD")
    status: { type: String, default: "requires_payment_method", index: true },

    stripePaymentIntentId: { type: String, required: true, unique: true, index: true },
    customerId: { type: String, default: null },

    // populated by webhook (safe, non-PCI)
    cardBrand: { type: String, default: null },
    last4: { type: String, default: null },
  },
  { timestamps: true }
);

export type Payment = InferSchemaType<typeof PaymentSchema>;

export const PaymentModel: Model<Payment> =
  mongoose.models.Payment || mongoose.model<Payment>("Payment", PaymentSchema);
