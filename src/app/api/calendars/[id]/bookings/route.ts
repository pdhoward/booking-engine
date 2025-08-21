// app/api/calendars/[id]/bookings/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Calendar from "@/models/Calendar";
import { evaluateBooking } from "@/lib/rulesEngine";

// For production, you'd persist a Booking document here.

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;

  const data = await req.json(); // { start: 'yyyy-mm-dd', end?: 'yyyy-mm-dd', ... }
  const calendar = await Calendar.findById(id);
  if (!calendar) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await evaluateBooking(data, calendar);
    // TODO: Save booking -> const booking = await Booking.create(...)
    return NextResponse.json({ success: true, bookingId: "demo-" + Date.now() });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
