import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Reservation from "@/models/Reservation";
import Calendar, { type CalendarDoc } from "@/models/Calendar";

const isYmd = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const toUTC = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);

export async function POST(req: NextRequest) {
  await dbConnect();

  try {
    const body = await req.json();
    const {
      unitId,
      unitName,
      unitNumber = "",
      calendarId,
      calendarName,
      startYmd,        // inclusive
      endYmd,          // EXCLUSIVE already (FC-style)
      rate,
      currency,
    } = body || {};

    // Basic validation
    if (!unitId || !calendarId || !unitName || !calendarName) {
      return NextResponse.json({ error: "Missing required identifiers" }, { status: 400 });
    }
    if (!isYmd(startYmd) || !isYmd(endYmd)) {
      return NextResponse.json({ error: "Dates must be yyyy-mm-dd" }, { status: 400 });
    }
    if (typeof rate !== "number" || !isFinite(rate)) {
      return NextResponse.json({ error: "Rate must be a number" }, { status: 400 });
    }
    if (!currency) {
      return NextResponse.json({ error: "Currency is required" }, { status: 400 });
    }

    const startDate = toUTC(startYmd);
    const endDate = toUTC(endYmd); // exclusive
    if (!(startDate < endDate)) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
    }

    // Snapshot cancel policy from the calendar (by id)
    const calDoc = await Calendar
      .findById(calendarId)
      .lean<Pick<CalendarDoc, "cancelHours" | "cancelFee" | "version">>();
    if (!calDoc) {
      return NextResponse.json({ error: "Calendar not found" }, { status: 404 });
    }
    const cancelHours = Number(calDoc.cancelHours ?? 48);
    const cancelFee = Number(calDoc.cancelFee ?? 0);
    const calendarVersion = Number(calDoc.version ?? 1);

    // Overlap check (hold/confirmed count as taken)
    const overlap = await Reservation.findOne({
      unitId,
      status: { $in: ["hold", "confirmed"] },
      startDate: { $lt: endDate },
      endDate: { $gt: startDate },
    }).lean();

    if (overlap) {
      return NextResponse.json({ error: "Overlapping reservation exists." }, { status: 409 });
    }

    const created = await Reservation.create({
      unitId,
      unitName,
      unitNumber,
      calendarId,
      calendarName,

      startDate,
      endDate, // exclusive

      rate,
      currency,

      cancelHours,
      cancelFee,

      status: "confirmed",
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
