// app/api/payments/create-intent/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import getMongoConnection from "@/db/connections";

// ---- schema that accepts either camelCase or snake_case ----
const BodySchema = z.object({
  tenant_id: z.string().optional(),
  tenantId: z.string().optional(),
  amount_cents: z.number().int().positive().optional(),
  amountCents: z.number().int().positive().optional(),
  currency: z.string().default("USD").optional(),
  reservation_id: z.string().optional(),
  reservationId: z.string().optional(),
  customer: z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
  }).optional(),
});

type Input = z.infer<typeof BodySchema>;

// ---- fetch tenant secret once per request ----
async function getStripeForTenant(tenantId?: string) {
  // v1: pull from env as fallback
  let secret = process.env.STRIPE_VOX_SECRET_KEY!;
  // v2 (recommended): look up tenant-configured secret in DB
  // const { db } = await getMongoConnection(process.env.DB!, process.env.MAINDBNAME!);
  // const tenant = await db.collection("tenants").findOne({ tenantId });
  // if (tenant?.stripe?.secretKey) secret = tenant.stripe.secretKey;

  if (!secret) throw new Error("Stripe secret key missing.");
  return new Stripe(secret /*, { apiVersion: '2024-...'}*/);
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_input", issues: parsed.error.issues }, { status: 400 });
    }

    const b: Input = parsed.data;
    const tenant_id = b.tenant_id ?? b.tenantId;
    const amount_cents = b.amount_cents ?? b.amountCents;
    const currency = (b.currency ?? "USD").toUpperCase();
    const reservation_id = b.reservation_id ?? b.reservationId;
    const customer = b.customer;

    if (!tenant_id || !amount_cents) {
      return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
    }

    const stripe = await getStripeForTenant(tenant_id);

    // create/reuse customer (optional)
    let customerId: string | undefined;
    if (customer?.email) {
      const q = `email:'${customer.email.replace(/'/g, "\\'")}' AND metadata['tenantId']:'${tenant_id}'`;
      const search = await stripe.customers.search({ query: q });
      customerId = search.data[0]?.id;
      if (!customerId) {
        const created = await stripe.customers.create({
          email: customer.email,
          name: customer.name,
          phone: customer.phone,
          metadata: { tenantId: tenant_id },
        });
        customerId = created.id;
      }
    }

    // Use idempotency when reservation_id exists to avoid dup charges on retries.
    const idemKey = reservation_id ? `pi:${tenant_id}:${reservation_id}:${amount_cents}:${currency}` : undefined;

    const intent = await stripe.paymentIntents.create(
      {
        amount: amount_cents,
        currency,
        customer: customerId,
        automatic_payment_methods: { enabled: true },
        metadata: { tenantId: tenant_id, reservationId: reservation_id ?? "" },
      },
      idemKey ? { idempotencyKey: idemKey } : undefined
    );

    // Upsert a record
    const { db } = await getMongoConnection(process.env.DB!, process.env.MAINDBNAME!);
    await db.collection("payments").updateOne(
      { stripePaymentIntentId: intent.id },
      {
        $setOnInsert: {
          tenantId: tenant_id,
          reservationId: reservation_id ?? null,
          amountCents: amount_cents,
          currency,
          createdAt: new Date(),
        },
        $set: { status: intent.status, updatedAt: new Date() },
      },
      { upsert: true }
    );

    return NextResponse.json({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      status: intent.status,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "server_error" }, { status: 500 });
  }
}
