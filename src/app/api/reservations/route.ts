// app/api/reservations/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Reservation from "@/models/Reservation";
import Calendar from "@/models/Calendar";
import { isValidObjectId } from "mongoose";

// Helpers
const toMidnightUTC = (ymd: string) => new Date(`${ymd}T00:00:00Z`);
const addDaysYmd = (ymd: string, days: number) =>
  new Date(Date.UTC(
    new Date(ymd).getUTCFullYear(),
    new Date(ymd).getUTCMonth(),
    new Date(ymd).getUTCDate() + days
  )).toISOString().slice(0, 10);

// GET /api/reservations?unitId=...&start=YYYY-MM-DD&end=YYYY-MM-DD
// `end` must be EXCLUSIVE (UI can pass endInclusive+1day)
// GET /api/reservations?unitId=...&calendarId=...&start=YYYY-MM-DD&end=YYYY-MM-DD
export async function GET(req: NextRequest) {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const unitId = searchParams.get("unitId");
  const calendarId = searchParams.get("calendarId");
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !end || (!unitId && !calendarId)) {
    return NextResponse.json({ error: "start, end and (unitId or calendarId) are required" }, { status: 400 });
  }
  if (unitId && !isValidObjectId(unitId)) {
    return NextResponse.json({ error: "Invalid unitId" }, { status: 400 });
  }
  if (calendarId && !isValidObjectId(calendarId)) {
    return NextResponse.json({ error: "Invalid calendarId" }, { status: 400 });
  }

  const toMidnightUTC = (ymd: string) => new Date(`${ymd}T00:00:00Z`);
  const startDate = toMidnightUTC(start); // inclusive
  const endDate = toMidnightUTC(end);     // exclusive

  const query: any = {
    status: { $in: ["hold", "confirmed"] },
    startDate: { $lt: endDate },
    endDate: { $gt: startDate },
  };
  if (unitId) query.unitId = unitId;
  if (calendarId) query.calendarId = calendarId;

  const items = await Reservation.find(query)
    .sort({ startDate: 1 })
    .select({ startDate: 1, endDate: 1, status: 1, unitName: 1 }) // <-- include unitName
    .lean();

  return NextResponse.json({
    overlap: items.length > 0,
    items: items.map((r: any) => ({
      _id: String(r._id),
      startDate: r.startDate,
      endDate: r.endDate,
      status: r.status,
      unitName: r.unitName,           // <-- return unitName for display
    })),
  });
}


// POST (unchanged logic except ensure you read cancel terms from *single* Calendar doc)
export async function POST(req: NextRequest) {
  await dbConnect();
  const body = await req.json();

  const {
    unitId,
    unitName,
    unitNumber,
    calendarId,
    calendarName,
    startYmd,
    endYmd, // EXCLUSIVE
    rate,
    currency,
  } = body ?? {};

  if (!unitId || !calendarId || !startYmd || !endYmd) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // cancel terms from the chosen calendar
  const calDoc = await Calendar.findById(calendarId).lean();
  if (!calDoc) {
    return NextResponse.json({ error: "Calendar not found" }, { status: 404 });
  }
  const cancelHours = Number((calDoc as any).cancelHours ?? 48);
  const cancelFee = Number((calDoc as any).cancelFee ?? 0);

  const startDate = new Date(`${startYmd}T00:00:00Z`);
  const endDate = new Date(`${endYmd}T00:00:00Z`); // EXCLUSIVE

  // overlap guard
  const conflict = await Reservation.findOne({
    unitId,
    status: { $in: ["hold", "confirmed"] },
    startDate: { $lt: endDate },
    endDate: { $gt: startDate },
  }).lean();

  if (conflict) {
    return NextResponse.json({ error: "Overlapping reservation exists." }, { status: 409 });
  }

  const doc = await Reservation.create({
    unitId,
    unitName,
    unitNumber,
    calendarId,
    calendarName,
    startDate,
    endDate,
    rate: Number(rate || 0),
    currency: currency || "USD",
    cancelHours,
    cancelFee,
    status: "confirmed",
  });

  return NextResponse.json({
    _id: String(doc._id),
    startDate: doc.startDate,
    endDate: doc.endDate,
  });
}
