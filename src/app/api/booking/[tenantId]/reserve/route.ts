// app/api/booking/[tenantId]/reserve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import dbConnect from "@/lib/db";
import { UnitModel } from "@/models/Unit";
import Reservation from "@/models/Reservation";
import CalendarModel from "@/models/Calendar";
import { ReserveBodySchema } from "@/models/schemas";
import { addDaysYmd, toMidnightUTC } from "@/lib/engine/date";
import { pickCalendarLink } from "@/lib/engine/pickCalendar";
import { Types } from "mongoose";

type LeanUnit = {
  _id: any;
  name?: string;
  unitNumber?: string;
  rate?: number;
  currency?: string;
  calendars?: Array<{ calendarId: any; name: string; version: number; effectiveDate: string }>;
};

/** Turn a ZodError into a stable JSON shape without using deprecated APIs. */
function toValidationDetails(err: ZodError) {
  // New Zod (preferred)
  const treeify = (z as any).treeifyError as
    | ((e: ZodError) => unknown)
    | undefined;

  if (typeof treeify === "function") {
    return treeify(err); // rich, nested structure
  }

  // Fallback for older Zod: build a simple, flat summary from issues
  return {
    issues: err.issues.map((i) => ({
      path: i.path.join("."),
      code: i.code,
      message: i.message,
    })),
  };
}

function normalizeUnit(u: any): LeanUnit | null {
  if (!u) return null;
  if (Array.isArray(u)) return u[0] ?? null;
  return u as LeanUnit;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const body = await req.json();

  const parsed = ReserveBodySchema.safeParse(body);

 if (!parsed.success) {
     return NextResponse.json(
       { ok: false, error: "bad_request", details: toValidationDetails(parsed.error) },
       { status: 400 }
     );
   }

  const { unit_id, check_in, check_out, guest, payment } = parsed.data;

  try {
    await dbConnect();

    // 1) Resolve unit (string key)
    const rawUnit = await UnitModel.findOne({ tenantId, unit_id }).lean();
    const unit = normalizeUnit(rawUnit);
    if (!unit) {
      return NextResponse.json(
        { ok: false, error: "not_found", reason_codes: ["UNIT_NOT_FOUND"] },
        { status: 404 }
      );
    }

    // 2) Calendar link effective on check_in
    const link = pickCalendarLink(unit.calendars ?? [], check_in);
    if (!link) {
      return NextResponse.json(
        { ok: false, error: "no_calendar", reason_codes: ["NO_CALENDAR_FOR_DATE"] },
        { status: 409 }
      );
    }
    const calendar: any = await CalendarModel.findById(link.calendarId).lean();
    if (!calendar) {
      return NextResponse.json(
        { ok: false, error: "calendar_missing", reason_codes: ["CALENDAR_NOT_FOUND"] },
        { status: 404 }
      );
    }

    // 3) Overlap guard
    const endExclusive = addDaysYmd(check_out, 1);
    const unitObjectId =
      typeof unit._id === "string" ? new Types.ObjectId(unit._id) : unit._id;

    const overlap = await Reservation.findOne({
      unitId: unitObjectId,
      status: { $in: ["hold", "confirmed"] },
      startDate: { $lt: toMidnightUTC(endExclusive) },
      endDate: { $gt: toMidnightUTC(check_in) },
    }).lean();

    if (overlap) {
      return NextResponse.json({ ok: false, reason_codes: ["OVERLAP"] }, { status: 409 });
    }

    // 4) Snapshot commercial terms
    const rate = Number(unit.rate || 0);
    const currency = unit.currency || "USD";
    const cancelHours = Number(calendar?.cancelHours ?? 48);
    const cancelFee = Number(calendar?.cancelFee ?? 0);

    // 5) Map guest & payment to schema-safe shapes (exclude any PAN/CVC if accidentally sent)
    const guestDoc = guest
      ? {
          firstName: guest.first_name,
          lastName: guest.last_name,
          email: guest.email,
          phone: guest.phone,
          address: guest.address
            ? {
                line1: guest.address.line1,
                line2: guest.address.line2,
                city: guest.address.city,
                state: guest.address.state,
                postalCode: guest.address.postalCode,
                country: guest.address.country,
              }
            : undefined,
        }
      : undefined;

    const paymentDoc = payment
      ? {
          provider: payment.provider,
          customerId: payment.customer_id,
          methodId: payment.method_id,
          intentId: payment.intent_id,
          brand: payment.brand,
          last4: payment.last4,
          expMonth: payment.exp_month,
          expYear: payment.exp_year,
          holdAmount: payment.hold_amount ?? 0,
          currency: payment.currency ?? currency,
        }
      : undefined;

    // 6) Persist
    const saved = await Reservation.create({
      unitId: unitObjectId,
      unitName: unit.name ?? "",
      unitNumber: unit.unitNumber || "",
      calendarId: link.calendarId,
      startDate: toMidnightUTC(check_in),
      endDate: toMidnightUTC(endExclusive), // EXCLUSIVE
      rate,
      currency,
      cancelHours,
      cancelFee,
      status: "confirmed",
      guest: guestDoc,
      payment: paymentDoc,
    });

    return NextResponse.json({
      ok: true,
      reservation: {
        id: String(saved._id),
        unit: {
          id: String(unit._id),
          name: unit.name ?? "",
          unitNumber: unit.unitNumber || "",
        },
        window: { check_in, check_out },
        policy: { cancelHours, cancelFee, currency },
        commercial: { nightly: rate, currency },
        guest: guestDoc ? { ...guestDoc, address: undefined } : undefined, // redact address if you want
        payment: paymentDoc
          ? {
              provider: paymentDoc.provider,
              methodId: paymentDoc.methodId,
              brand: paymentDoc.brand,
              last4: paymentDoc.last4,
              expMonth: paymentDoc.expMonth,
              expYear: paymentDoc.expYear,
              holdAmount: paymentDoc.holdAmount,
              currency: paymentDoc.currency,
            }
          : undefined,
        status: "confirmed",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "server_error", message: String(err?.message || err) },
      { status: 500 }
    );
  }
}
