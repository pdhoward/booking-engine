import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { UnitModel } from "@/models/Unit";
import Reservation from "@/models/Reservation";
import CalendarModel from "@/models/Calendar";
import { ReserveBodySchema } from "@/models/schemas";
import { addDaysYmd, toMidnightUTC } from "@/lib/engine/date";
import { pickCalendarLink } from "@/lib/engine/pickCalendar";

// Narrow local type
type LeanUnit = {
  _id: any;
  name?: string;
  unitNumber?: string;
  rate?: number;
  currency?: string;
  calendars?: Array<{
    calendarId: any;
    name: string;
    version: number;
    effectiveDate: string;
  }>;
};

function normalizeUnit(u: any): LeanUnit | null {
  if (!u) return null;
  if (Array.isArray(u)) return u[0] ?? null;
  return u as LeanUnit;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const body = await req.json();
  const parsed = ReserveBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "bad_request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { unit_id, check_in, check_out, guest } = parsed.data;

  try {
    await dbConnect();

    // 1) Resolve unit
    const rawUnit = await UnitModel.findById(unit_id).lean();
    const unit = normalizeUnit(rawUnit);
    if (!unit) {
      return NextResponse.json(
        { ok: false, error: "not_found", reason_codes: ["UNIT_NOT_FOUND"] },
        { status: 404 }
      );
    }

    // 2) Calendar link (effective on check_in)
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
    const overlap = await Reservation.findOne({
      unitId: unit._id,
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

    // 5) Persist
    const saved = await Reservation.create({
      unitId: unit._id,
      unitName: unit.name ?? "",
      unitNumber: unit.unitNumber || "",
      calendarId: link.calendarId,
      calendarName: link.name,
      startDate: toMidnightUTC(check_in),
      endDate: toMidnightUTC(endExclusive), // EXCLUSIVE
      rate,
      currency,
      cancelHours,
      cancelFee,
      status: "confirmed",
      // embed a guest snapshot when needed:
      // guestFirst: guest.first_name, guestLast: guest.last_name, ...
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
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "server_error", message: String(err?.message || err) },
      { status: 500 }
    );
  }
}
