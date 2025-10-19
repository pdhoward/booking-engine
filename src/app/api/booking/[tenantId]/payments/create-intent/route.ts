
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import dbConnect from "@/lib/db";
import { PaymentModel } from "@/models/Payment";

// ---------- Schemas (robust to agent/executor templating) ----------
const BodySchema = z.object({
  tenant_id: z.string().optional(),
  tenantId: z.string().optional(),

  // Accept strings or numbers; coerce to int
  amount_cents: z.coerce.number().int().positive().optional(),
  amountCents: z.coerce.number().int().positive().optional(),

  currency: z.string().optional(),

  reservation_id: z.string().optional(),
  reservationId: z.string().optional(),

  // 👇 this is an object but allow anything; normalize after parsing
  customer: z.any().optional(),
});

type Input = z.infer<typeof BodySchema>;

// ---------- Stripe per-tenant (env fallback for now) ----------
async function getStripeForTenant(tenantId?: string) {
  const secret = process.env.STRIPE_VOX_SECRET_KEY;
  if (!secret) throw new Error("Stripe secret key missing.");
  return new Stripe(secret);
}

// ---------- Route ----------
export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();

    // Parse + coerce + normalize
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_input", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const b: Input = parsed.data;

    const tenantId = b.tenant_id ?? b.tenantId;
    const amountCents = b.amount_cents ?? b.amountCents;
    const currency = (b.currency ?? "USD").trim().toUpperCase();
    const reservationId = b.reservation_id ?? b.reservationId ?? null;

    // 👇 Normalize customer: accept object, JSON string, or ignore garbage
    let customer: undefined | { name?: string; email?: string; phone?: string };
    if (typeof b.customer === "string") {
      try {
        const obj = JSON.parse(b.customer);
        if (obj && typeof obj === "object") {
          customer = {
            name: typeof obj.name === "string" ? obj.name : undefined,
            email: typeof obj.email === "string" ? obj.email : undefined,
            phone: typeof obj.phone === "string" ? obj.phone : undefined,
          };
        }
      } catch {
        // ignore unparsable strings like "[object Object]"
      }
    } else if (b.customer && typeof b.customer === "object") {
      const obj = b.customer as Record<string, unknown>;
      customer = {
        name: typeof obj.name === "string" ? obj.name : undefined,
        email: typeof obj.email === "string" ? obj.email : undefined,
        phone: typeof obj.phone === "string" ? obj.phone : undefined,
      };
    }

    if (!tenantId || !amountCents) {
      return NextResponse.json(
        {
          error: "missing_required_fields",
          missing: { tenantId: !tenantId, amountCents: !amountCents },
        },
        { status: 400 }
      );
    }

    const stripe = await getStripeForTenant(tenantId);

    //  create/reuse customer by email scoped to tenant
    let customerId: string | undefined;
    if (customer?.email) {
      const query = `email:'${customer.email.replace(/'/g, "\\'")}' AND metadata['tenantId']:'${tenantId}'`;
      const search = await stripe.customers.search({ query });
      customerId = search.data[0]?.id;
      if (!customerId) {
        const created = await stripe.customers.create({
          email: customer.email,
          name: customer.name,
          phone: customer.phone,
          metadata: { tenantId },
        });
        customerId = created.id;
      }
    }

    // Idempotency if reservationId present
    const idemKey = reservationId
      ? `pi:${tenantId}:${reservationId}:${amountCents}:${currency}`
      : undefined;

    const intent = await stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency,
        customer: customerId,
        automatic_payment_methods: { enabled: true },
        metadata: {
          tenantId,
          reservationId: reservationId ?? "",
        },
      },
      idemKey ? { idempotencyKey: idemKey } : undefined
    );

    // Persist (Mongoose)
    await dbConnect();
    await PaymentModel.findOneAndUpdate(
      { stripePaymentIntentId: intent.id },
      {
        $setOnInsert: {
          tenantId,
          customerId,
          reservationId,
          amountCents,
          currency,
        },
        $set: { status: intent.status },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Response shape expected by the tool/UI
    return NextResponse.json({
      ok: true,
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      status: intent.status,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "server_error" },
      { status: 500 }
    );
  }
}
