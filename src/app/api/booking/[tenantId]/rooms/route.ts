// app/api/booking/[tenantId]/rooms/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { UnitModel } from "@/models/Unit";
import { Types } from "mongoose";

/* ------------------------- helpers (unchanged) -------------------------- */

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

function pickTopImage(unit: any): string | null {
  const arr = Array.isArray(unit.images) ? unit.images : [];
  if (!arr.length) return null;
  const hero =
    arr.find((x: any) => x.role === "hero") ||
    arr.find((x: any) => x.role === "gallery") ||
    arr[0];
  return hero?.url ?? null;
}

function humanAmenities(unit: any): string[] {
  const out = new Set<string>();
  const am = unit.amenities || {};
  const pushAll = (xs?: string[]) =>
    Array.isArray(xs) ? xs.forEach((x) => x && out.add(String(x))) : null;

  pushAll(am.wellness);
  pushAll(am.bath);
  pushAll(am.outdoor);
  pushAll(am.tech);
  pushAll(am.room);
  pushAll(am.view);
  pushAll(am.services);
  pushAll(am.accessibility);

  if (out.size === 0 && Array.isArray(am.raw)) {
    am.raw.forEach((x: string) => x && out.add(x.replace(/_/g, " ")));
  }

  const cfg = unit.config || {};
  if (out.size === 0) {
    if (cfg.hotTub) out.add("hot tub");
    if (cfg.sauna) out.add("sauna");
    if (cfg.shower) out.add("shower");
    if (cfg.bathtub) out.add("bathtub");
    if (cfg.view) out.add(`${cfg.view} view`);
  }

  return Array.from(out).slice(0, 8);
}

/* --------------------------------- GET ---------------------------------- */

export async function GET(
  req: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = params.tenantId;
    if (!tenantId) {
      return NextResponse.json({ ok: false, error: "Missing tenantId" }, { status: 400 });
    }

    await dbConnect();

    const url = new URL(req.url);
    const q = url.searchParams.get("q");
    const includeRates = toBool(url.searchParams.get("includeRates"));
    const limitParam = Number(url.searchParams.get("limit") || "12");
    const limit = Number.isFinite(limitParam)
      ? Math.max(1, Math.min(100, limitParam))
      : 12;

    const filter: any = { tenantId, active: true };
    if (q && q.trim().length) {
      const rx = new RegExp(q.trim(), "i");
      filter.$or = [
        { name: rx },
        { description: rx },
        { slug: rx },
        { labels: q.trim() },        // matches any string in labels
        { tags: q.trim() }           // matches any string in tags
      ];
    }

    // Build projection to match what we return
    const baseSelect =
      "name unitNumber unit_id slug description images amenities occupancy config updatedAt currency";
    const select = includeRates ? `${baseSelect} rate` : baseSelect;

    // Query via Mongoose
    const rows = await UnitModel.find(filter)
      .select(select)
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean()
      .exec();

    // Shape response items
    const items = rows.map((u: any) => {
      const squareFeet = u?.config?.squareFeet ?? null;
      const bedrooms = u?.config?.bedrooms ?? null;
      const bathrooms = u?.config?.bathrooms ?? null;
      const view = u?.config?.view ?? null;
      const sleeps = u?.occupancy?.sleeps ?? null;

      const item: any = {
        _id: (u._id instanceof Types.ObjectId ? u._id : new Types.ObjectId(u._id)).toHexString(),
        unit_id: u.unit_id,
        slug: u.slug,
        name: u.name,
        unitNumber: u.unitNumber,
        description: u.description,
        image: pickTopImage(u),
        amenities: humanAmenities(u),
        sleeps,
        bedrooms,
        bathrooms,
        view,
        squareFeet
      };

      if (includeRates) {
        item.rate = typeof u.rate === "number" ? u.rate : null;
        item.currency = u.currency ?? null;
      }

      return item;
    });

    return NextResponse.json({ ok: true, count: items.length, items });
  } catch (err) {
    console.error("rooms.list (mongoose) error:", err);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
