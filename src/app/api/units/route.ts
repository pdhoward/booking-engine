// /app/api/units/route.ts
import { NextResponse } from "next/server";
import { UnitModel } from "@/models/Unit";
import dbConnect from "@/lib/db";

export async function GET() {
  await dbConnect();
  const rows = await UnitModel.find({}, { name: 1, unitNumber: 1, type: 1, active: 1, rate: 1, currency: 1 })
    .sort({ name: 1 })
    .lean();
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  await dbConnect();
  const body = await req.json();
  const created = await UnitModel.create(body);
  return NextResponse.json(created);
}
