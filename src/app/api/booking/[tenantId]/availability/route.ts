// /app/api/booking/[tenantId]/availability/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { UnitModel } from "@/models/Unit";
import Reservation from "@/models/Reservation";
import CalendarModel from "@/models/Calendar";

// ✅ booking-layer schemas & helpers (server-safe)
import { AvailabilityQuerySchema } from "@/models/schemas";
import { addDaysYmd, toMidnightUTC } from "@/lib/engine/date";
import { pickCalendarLink } from "@/lib/engine/pickCalendar";
import { evaluateBookingServer } from "@/lib/engine/evaluateBookingOnServer";

// Temp - use locally to quiet TS without changing your models
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
    effectiveDate: string; // yyyy-mm-dd
  }>;
};

/** Normalize a result that might (incorrectly) be inferred as array/null/obj */
function normalizeUnit(u: any): LeanUnit | null {
  if (!u) return null;
  if (Array.isArray(u)) return u[0] ?? null;
  return u as LeanUnit;
}

export async function GET(req: NextRequest, { params }: { params: { tenantId: string } }) {
  const { searchParams } = new URL(req.url);

  // Validate inputs
  const parse = AvailabilityQuerySchema.safeParse({
    unit_id: searchParams.get("unit_id") || undefined,
    unit_slug: searchParams.get("unit_slug") || undefined,
    check_in: searchParams.get("check_in"),
    check_out: searchParams.get("check_out") || undefined,
    mode: (searchParams.get("mode") as any) || undefined,
  });
  if (!parse.success) {
    return NextResponse.json(
      { ok: false, error: "bad_request", details: parse.error.flatten() },
      { status: 400 }
    );
  }
  const { unit_id, unit_slug, check_in, check_out, mode } = parse.data;

  try {
    await dbConnect();

    // 1) Resolve unit (by id or slug) and normalize
    const rawUnit = unit_id
      ? await UnitModel.findById(unit_id).lean()
      : await UnitModel.findOne({ slug: unit_slug }).lean();

    const unit = normalizeUnit(rawUnit);
    if (!unit) {
      return NextResponse.json(
        { ok: false, error: "not_found", reason_codes: ["UNIT_NOT_FOUND"] },
        { status: 404 }
      );
    }

    // 2) Pick calendar link effective on check_in
    const link = pickCalendarLink(unit.calendars ?? [], check_in);
    if (!link) {
      const futureDates = (unit.calendars ?? [])
        .map((l: any) => l.effectiveDate)
        .filter(Boolean)
        .sort();
      return NextResponse.json(
        {
          ok: false,
          error: "no_calendar",
          reason_codes: ["NO_CALENDAR_FOR_DATE"],
          meta: { futureEffectiveFrom: futureDates[0] || null },
        },
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

    // 3) Evaluate rules (coerce leadTime numbers so TS is happy)
    const endInclusive = mode === "reservations" ? (check_out || check_in) : check_in;

    const calState = {
      leadTime: {
        minDays: Number(calendar?.leadTime?.minDays ?? 0),
        maxDays: Number(calendar?.leadTime?.maxDays ?? 365),
      },
      blackouts: (calendar.blackouts || []).map((d: Date) =>
        new Date(d).toISOString().slice(0, 10)
      ),
      holidays: (calendar.holidays || []).map((h: any) => ({
        date: new Date(h.date).toISOString().slice(0, 10),
        minNights: Number(h.minNights ?? 1),
      })),
      minStayByWeekday: calendar.minStayByWeekday || {},
    };

    const evalRes = evaluateBookingServer(calState, {
      start: check_in,
      end: endInclusive,
      mode,
    });
    if (!evalRes.ok) {
      return NextResponse.json(
        { ok: false, reason_codes: evalRes.reason_codes },
        { status: 409 }
      );
    }

    // 4) Overlap guard
    const endExclusive = addDaysYmd(endInclusive, 1);
    const overlapItems = await Reservation.find({
      unitId: unit._id,
      status: { $in: ["hold", "confirmed"] },
      startDate: { $lt: toMidnightUTC(endExclusive) },
      endDate: { $gt: toMidnightUTC(check_in) },
    })
      .select({ _id: 1, startDate: 1, endDate: 1, status: 1 })
      .lean();

    if (overlapItems.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          reason_codes: ["OVERLAP"],
          conflicts: overlapItems.map((i: any) => ({
            id: String(i._id),
            start: i.startDate,
            end: i.endDate,
            status: i.status,
          })),
        },
        { status: 409 }
      );
    }

    // 5) Success payload
    return NextResponse.json({
      ok: true,
      unit: {
        id: String(unit._id),
        name: unit.name ?? "",
        unitNumber: unit.unitNumber || "",
        rate: Number(unit.rate || 0),
        currency: unit.currency || "USD",
      },
      calendar: {
        id: String(link.calendarId),
        name: link.name,
        version: link.version,
        effectiveDate: link.effectiveDate,
        cancelHours: Number(calendar?.cancelHours ?? 48),
        cancelFee: Number(calendar?.cancelFee ?? 0),
      },
      window: { check_in, check_out: endInclusive },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "server_error", message: String(err?.message || err) },
      { status: 500 }
    );
  }
}