// app/api/calendars/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Calendar from "@/models/Calendar";
import { validateCalendarIntegrity } from "@/lib/utils";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  const calendar = await Calendar.findById(id);
  if (!calendar) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(calendar);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  const data = await req.json();

  try {
    validateCalendarIntegrity(data);
    const calendar = await Calendar.findByIdAndUpdate(id, data, { new: true });
    if (!calendar) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(calendar);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
