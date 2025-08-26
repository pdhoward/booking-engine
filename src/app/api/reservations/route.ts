import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Reservation from "@/models/Reservation";

// Convert yyyy-mm-dd → UTC Date at midnight
function ymdToDate(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

export async function GET(req: NextRequest) {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const unitId = searchParams.get("unitId");
  const calendarId = searchParams.get("calendarId");
  const from = searchParams.get("from"); // yyyy-mm-dd
  const to = searchParams.get("to");     // yyyy-mm-dd

  const q: any = {};
  if (unitId) q.unitId = unitId;
  if (calendarId) q.calendarId = calendarId;
  if (from && to) {
    const fromD = ymdToDate(from);
    const toD = ymdToDate(to);
    // overlaps [from, to]
    q.$and = [{ start: { $lte: toD } }, { end: { $gte: fromD } }];
  }
  // ignore cancelled by default
  q.status = { $ne: "cancelled" };

  const list = await Reservation.find(q).sort({ start: 1 }).lean();
  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  await dbConnect();
  const body = await req.json();

  // Minimal validation
  const { unitId, unitName, unitNumber, calendarId, start, end, nights, rate, currency, cancelHours, cancelFee, status } = body;
  if (!unitId || !calendarId || !start || !end || !rate || !currency) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const startD = ymdToDate(start);
  const endD = ymdToDate(end);
  if (isNaN(startD.getTime()) || isNaN(endD.getTime()) || endD < startD) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  // Check overlap on the same unit (exclude cancelled)
  const overlap = await Reservation.findOne({
    unitId,
    status: { $ne: "cancelled" },
    start: { $lte: endD },
    end: { $gte: startD },
  }).lean();

  if (overlap) {
    return NextResponse.json({ error: "Unit already reserved on those dates" }, { status: 409 });
  }

  const created = await Reservation.create({
    unitId, unitName, unitNumber, calendarId,
    start: startD, end: endD,
    nights, rate, currency, cancelHours, cancelFee,
    status: status || "confirmed",
  });

  return NextResponse.json(created, { status: 201 });
}
