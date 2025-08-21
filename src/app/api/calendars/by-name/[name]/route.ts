// app/api/calendars/by-name/[name]/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Calendar from "@/models/Calendar";

export async function GET(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  await dbConnect();
  const { name } = await params;
  const doc = await Calendar.findOne({ name }).sort({ version: -1 });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(doc);
}
