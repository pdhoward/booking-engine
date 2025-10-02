// app/api/booking/[tenantId]/rooms/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { UnitModel } from "@/models/Unit";

function isAuthorized(req: NextRequest) {
  const hdr = req.headers.get("authorization") || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
  const expected = process.env.BOOKING_API_KEY;
  return Boolean(expected && token && token === expected);
}

function toBool(v: string | null): boolean {
  if (!v) return false;
  return v === "true" || v === "1" || v.toLowerCase() === "yes";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;

  if (!tenantId) {
    return NextResponse.json({ ok: false, error: "Missing tenantId" }, { status: 400 });
  }
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    await dbConnect();

    const url = new URL(req.url);
    const activeParam = url.searchParams.get("active"); // optional
    const find: any = { tenantId };
    if (activeParam !== null) find.active = toBool(activeParam);

    // No projection, no transforms — raw docs (JSON-serialized by NextResponse)
    const docs = await UnitModel.find(find).lean().exec();

    return NextResponse.json({ ok: true, count: docs.length, items: docs });
  } catch (err) {
    console.error("rooms.list error:", err);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
