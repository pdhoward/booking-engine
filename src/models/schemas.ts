// /lib/booking/schemas.ts
import { z } from "zod";

export const AvailabilityQuerySchema = z.object({
  unit_id: z.string().optional(),
  unit_slug: z.string().optional(),
  check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // reservations use inclusive checkout
  mode: z.enum(["reservations", "appointments"]).default("reservations"),
});

export const QuoteQuerySchema = z.object({
  unit_id: z.string().optional(),
  unit_slug: z.string().optional(),
  check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const ReserveBodySchema = z.object({
  unit_id:   z.string().min(1),
  check_in:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),

  guest: z
    .object({
      first_name: z.string().min(1),
      last_name:  z.string().min(1),
      email:      z.string().email(),
      phone:      z.string().optional(),
      address: z
        .object({
          line1:      z.string().optional(),
          line2:      z.string().optional(),
          city:       z.string().optional(),
          state:      z.string().optional(),
          postalCode: z.string().optional(),
          country:    z.string().optional(),
        })
        .optional(),
    })
    .optional(),

  // Tokenized payment metadata (NO PAN/CVC)
  payment: z
    .object({
      provider:    z.enum(["stripe", "braintree", "manual", "none"]).default("none"),
      customer_id: z.string().optional(),
      method_id:   z.string().optional(),
      intent_id:   z.string().optional(),
      brand:       z.string().optional(),
      last4:       z.string().regex(/^\d{4}$/).optional(),
      exp_month:   z.number().int().min(1).max(12).optional(),
      exp_year:    z.number().int().min(new Date().getFullYear()).max(2100).optional(),
      hold_amount: z.number().nonnegative().optional(),
      currency:    z.string().optional(),
    })
    .optional(),
});

export type ReserveBody = z.infer<typeof ReserveBodySchema>;
