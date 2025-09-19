import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { UnitModel } from "@/models/Unit";
import CalendarModel from "@/models/Calendar";
import { QuoteQuerySchema } from "@/models/schemas";
import { nightsBetweenInclusive } from "@/lib/engine/date";
import { pickCalendarLink } from "@/lib/engine/pickCalendar";

// Narrow local type (don’t change your models)
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

function normalizeUnit(u: any): LeanUnit | null {
  if (!u) return null;
  if (Array.isArray(u)) return u[0] ?? null;
  return u as LeanUnit;
}

export async function GET(req: NextRequest, { params }: { params: { tenantId: string } }) {
  const { searchParams } = new URL(req.url);

  const parse = QuoteQuerySchema.safeParse({
    unit_id: searchParams.get("unit_id") || undefined,
    unit_slug: searchParams.get("unit_slug") || undefined,
    check_in: searchParams.get("check_in"),
    check_out: searchParams.get("check_out"),
  });
  if (!parse.success) {
    return NextResponse.json(
      { ok: false, error: "bad_request", details: parse.error.flatten() },
      { status: 400 }
    );
  }
  const { unit_id, unit_slug, check_in, check_out } = parse.data;

  try {
    await dbConnect();

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

    const link = pickCalendarLink(unit.calendars ?? [], check_in);
    if (!link) {
      return NextResponse.json(
        { ok: false, error: "no_calendar", reason_codes: ["NO_CALENDAR_FOR_DATE"] },
        { status: 409 }
      );
    }

    const calendar: any = await CalendarModel.findById(link.calendarId).lean();

    const nights = nightsBetweenInclusive(check_in, check_out);
    const nightly = Number(unit.rate || 0);
    const total = nightly * nights;

    return NextResponse.json({
      ok: true,
      unit: { id: String(unit._id), name: unit.name ?? "" },
      calendar: { id: String(link.calendarId), name: link.name, version: link.version },
      quote: {
        currency: unit.currency || "USD",
        nightly,
        nights,
        total,
        window: { check_in, check_out },
        policy: {
          cancelHours: Number(calendar?.cancelHours ?? 48),
          cancelFee: Number(calendar?.cancelFee ?? 0),
        },
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "server_error", message: String(err?.message || err) },
      { status: 500 }
    );
  }
}
