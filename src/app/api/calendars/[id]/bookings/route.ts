import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Calendar from "@/models/Calendar";
import { evaluateBooking } from "@/lib/rulesEngine";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;

  const data = await req.json(); // { start: 'yyyy-mm-dd', end?: 'yyyy-mm-dd', ... }
  const cal = await Calendar.findById(id).lean();   // ← use lean() to avoid Mongoose Doc types
  if (!cal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Normalize rules & holidays to a simple POJO the engine expects
  const calendar = {
    rules: Array.isArray(cal.rules) ? cal.rules : [],
    holidays: (Array.isArray(cal.holidays) ? cal.holidays : [])
      .filter((h: any) => h?.date)                    // drop null/undefined
      .map((h: any) => ({ date: new Date(h.date) })), // ensure Date (or could keep yyyy-mm-dd string)
  };

  try {
    await evaluateBooking(data, calendar);
    return NextResponse.json({ success: true, bookingId: "demo-" + Date.now() });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
