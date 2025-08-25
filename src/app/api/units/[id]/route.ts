// /app/api/units/[id]/route.ts
import { NextResponse } from "next/server";
import { UnitModel } from "@/models/Unit";
import dbConnect from "@/lib/db";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  await dbConnect();
  const doc = await UnitModel.findById(params.id).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(doc);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  await dbConnect();
  const patch = await req.json();
  const updated = await UnitModel.findByIdAndUpdate(params.id, patch, { new: true });
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await dbConnect();
  await UnitModel.findByIdAndDelete(params.id);
  return NextResponse.json({ ok: true });
}
