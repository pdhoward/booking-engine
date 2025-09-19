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
  unit_id: z.string(),
  check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // inclusive, we’ll +1 day server-side
  guest: z.object({
    first_name: z.string(),
    last_name: z.string(),
    email: z.string().email(),
    phone: z.string(),
  }),
  // In future, add payment_token, etc.
});
export type ReserveBody = z.infer<typeof ReserveBodySchema>;
