// app/api/payments/create-intent/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import dbConnect from "@/lib/db";
import { PaymentModel } from "@/models/Payment";

// ---- schema that accepts either camelCase or snake_case ----
const BodySchema = z.object({
  tenant_id: z.string().optional(),
  tenantId: z.string().optional(),
  amount_cents: z.number().int().positive().optional(),
  amountCents: z.number().int().positive().optional(),
  currency: z.string().optional(), // we'll default later
  reservation_id: z.string().optional(),
  reservationId: z.string().optional(),
  customer: z
    .object({
      name: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
    })
    .optional(),
});

type Input = z.infer<typeof BodySchema>;

async function getStripeForTenant(tenantId?: string) {
  // v1: env fallback; replace with per-tenant secret lookup when ready
  const secret = process.env.STRIPE_VOX_SECRET_KEY;
   console.log(secret)
  if (!secret) throw new Error("Stripe secret key missing.");
  return new Stripe(secret);
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = BodySchema.safeParse(raw);
    console.log(`----booking engine payments -----`)
    console.log(`parsed = ${JSON.stringify(parsed)}`)
   
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_input", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const b: Input = parsed.data;
    const tenantId = b.tenant_id ?? b.tenantId;
    const amountCents = b.amount_cents ?? b.amountCents;
    const currency = (b.currency ?? "USD").toUpperCase();
    const reservationId = b.reservation_id ?? b.reservationId;
    const customer = b.customer;

    if (!tenantId || !amountCents) {
      return NextResponse.json(
        { error: "missing_required_fields", missing: { tenantId: !tenantId, amountCents: !amountCents } },
        { status: 400 }
      );
    }

    const stripe = await getStripeForTenant(tenantId);
    console.log(`tenant is ${tenantId}`)

    // Optional: create/reuse customer by email scoped to tenant
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

    // Idempotency if reservationId is present (avoid dup PIs on retries)
    const idemKey = reservationId
      ? `pi:${tenantId}:${reservationId}:${amountCents}:${currency}`
      : undefined;

    const intent = await stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency,
        customer: customerId,
        automatic_payment_methods: { enabled: true },
        metadata: { tenantId, reservationId: reservationId ?? "" },
      },
      idemKey ? { idempotencyKey: idemKey } : undefined
    );

    console.log(`reservationid is ${reservationId}`)
    console.log(`customer id is ${customerId}`)
    console.log(`intent is ${JSON.stringify(intent)}`)

    // DB upsert (Mongoose)
    await dbConnect();
    await PaymentModel.findOneAndUpdate(
      { stripePaymentIntentId: intent.id },
      {
        $setOnInsert: {
          tenantId,
          customerId,
          reservationId: reservationId ?? null,
          amountCents,
          currency,
        },
        $set: { status: intent.status },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Shape that your PaymentForm/tool expects
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
