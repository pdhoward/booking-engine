// app/api/payments/webhook/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import dbConnect from "@/lib/db";
import { PaymentModel } from "@/models/Payment";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_VOX_SECRET_KEY!);

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new NextResponse("Missing signature", { status: 400 });

  // Stripe needs the raw body
  const buf = Buffer.from(await req.arrayBuffer());

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_VOX_WH_SECRET!
    );
  } catch (err: any) {
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    // We only care about PaymentIntent lifecycle events
    if (event.type.startsWith("payment_intent.")) {
      const pi = event.data.object as Stripe.PaymentIntent;

      // Re-fetch with expand to get non-PCI card summary safely
      const full = await stripe.paymentIntents.retrieve(pi.id, {
        expand: ["latest_charge.payment_method_details", "customer"],
      });

      const latestCharge =
        typeof full.latest_charge === "string" ? null : full.latest_charge;
      const card = latestCharge?.payment_method_details?.card;
      const cardBrand = card?.brand ?? null;
      const last4 = card?.last4 ?? null;

      const customerId =
        typeof full.customer === "string"
          ? full.customer
          : full.customer?.id ?? null;

      // Pull metadata if present (created in create-intent)
      const tenantId = (full.metadata?.tenantId as string) || null;
      const reservationId = (full.metadata?.reservationId as string) || null;

      await dbConnect();

      // Upsert by stripePaymentIntentId. Ensure we always have a row even if the
      // create-intent write failed earlier.
      await PaymentModel.findOneAndUpdate(
        { stripePaymentIntentId: full.id },
        {
          $setOnInsert: {
            tenantId: tenantId ?? "unknown",
            reservationId: reservationId ?? null,
            amountCents: full.amount, // cents
            currency: String(full.currency || "usd").toUpperCase(),
          },
          $set: {
            status: full.status,
            customerId,
            cardBrand,
            last4,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    return NextResponse.json({ received: true });
  } catch (e: any) {
    return new NextResponse(`Webhook handler failed: ${e.message}`, {
      status: 500,
    });
  }
}
