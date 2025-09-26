import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import dbConnect from "@/lib/db";
import { UnitModel } from "@/models/Unit";
import Reservation from "@/models/Reservation";
import CalendarModel from "@/models/Calendar";

import { addDaysYmd, toMidnightUTC } from "@/lib/engine/date";
import { pickCalendarLink } from "@/lib/engine/pickCalendar";
import { evaluateBookingServer } from "@/lib/engine/evaluateBookingOnServer";

import { Types } from "mongoose"; 

// Temp - use locally to quiet TS without changing your models
type LeanUnit = {
  _id: any;
  unit_id?: string;
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

/** Normalize a result that might (incorrectly) be inferred as array/null/obj */
function normalizeUnit(u: any): LeanUnit | null {
  if (!u) return null;
  if (Array.isArray(u)) return u[0] ?? null;
  return u as LeanUnit;
}


// ─────────────────────────────────────────────────────────────────────────────
// Input validation: ONLY unit_id (string key), check_in/out, optional mode
// ─────────────────────────────────────────────────────────────────────────────
const AvailabilityParams = z.object({
  unit_id:   z.string().min(1),
  check_in:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  mode:      z.enum(["appointments", "reservations"]).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const { searchParams } = new URL(req.url);

  // Validate inputs against our simplified schema
  const parse = AvailabilityParams.safeParse({
    unit_id:   searchParams.get("unit_id"),
    check_in:  searchParams.get("check_in"),
    check_out: searchParams.get("check_out") || undefined,
    mode:      (searchParams.get("mode") as any) || undefined, // appintments or reservations
  });
  if (!parse.success) {
    return NextResponse.json(
      { ok: false, error: "bad_request", details: toValidationDetails(parse.error) },
      { status: 400 }
    );
  }

  const { unit_id, check_in, check_out, mode: rawMode } = parse.data;

  const mode = rawMode ?? 'reservations';

  // Trace (super useful during integration)
  console.log("[AVAIL] req", { tenantId, unit_id, check_in, check_out, mode });

  try {
    await dbConnect();

    // ─────────────────────────────────────────────────────────────────────────
    // 1) Resolve Unit by tenant + unit_id (string key).   
    // ─────────────────────────────────────────────────────────────────────────
    const rawUnit =
      (await UnitModel.findOne({ tenantId, unit_id: unit_id }).lean())   
    
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

      console.log("[AVAIL] calendar_link", link);

    // 3) Load calendar by _id (ObjectId). mongo will cast the hex string for you.
      const calendar = await CalendarModel.findById(link.calendarId).lean();
      // (optional) trace
      console.log("[AVAIL] calendar_lookup", { calendarId: link.calendarId });

    if (!calendar) {
      return NextResponse.json(
        { ok: false, error: "calendar_missing", reason_codes: ["CALENDAR_NOT_FOUND"] },
        { status: 404 }
      );
    }

    // 4) Evaluate rules
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
      mode: mode,
    });

    if (!evalRes.ok) {
      return NextResponse.json(
        { ok: false, reason_codes: evalRes.reason_codes },
        { status: 409 }
      );
    }

    // 5) Overlap guard - search reservations for any overlap in requested dates against 
    // confirmed or hold dates for that unit
    
    const unitObjectId = typeof unit._id === "string" ? new Types.ObjectId(unit._id) : unit._id;
    const endExclusive = addDaysYmd(endInclusive, 1);

    const overlapItems = await Reservation.find({
      unitId: unitObjectId,  
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

    // 6) Success payload (no images here; those live in "things" via your gateway)
    return NextResponse.json({
      ok: true,
      unit: {
        id: unitObjectId,
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
