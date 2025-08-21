// app/api/calendars/[id]/availability/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Calendar from "@/models/Calendar";
import { buildAvailabilityGrid } from "@/lib/utils";
import { format } from "date-fns";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  await dbConnect();
  const { id } = params;

  const calendar = await Calendar.findById(id);
  if (!calendar) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year") ?? new Date().getFullYear());

  const availableDates = buildAvailabilityGrid(calendar, year);
  return NextResponse.json({ available: availableDates.map((d) => format(d, "yyyy-MM-dd")) });
}
