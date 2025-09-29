// app/api/booking/[tenantId]/rooms/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { UnitModel } from "@/models/Unit";
import { Types } from "mongoose";

/* ------------------------- helpers -------------------------- */

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
  const hero = arr.find((x: any) => x.role === "hero")
    || arr.find((x: any) => x.role === "gallery")
    || arr[0];
  // support either {url} or {src} in legacy docs
  return hero?.url ?? hero?.src ?? null;
}

const VIDEO_EXTS = new Set(["mp4", "webm", "m4v", "mov", "ogg"]);
function isVideoPath(src: string | undefined): boolean {
  if (!src) return false;
  const q = src.split("?")[0]; // strip query
  const ext = q.split(".").pop()?.toLowerCase();
  return !!ext && VIDEO_EXTS.has(ext);
}

// Normalize your mixed images[] into VisualMedia[]
function toMediaArray(unit: any) {
  const arr = Array.isArray(unit.images) ? unit.images : [];
  const poster = pickTopImage(unit) || undefined;

  return arr
    .map((entry: any) => {
      const src: string | undefined = entry?.url ?? entry?.src;
      if (!src) return null;

      if (isVideoPath(src)) {
        return { kind: "video" as const, src, poster };
      } else {
        return {
          kind: "image" as const,
          src,
          alt: entry?.alt ?? "",
          // you can optionally add width/height if you store them
        };
      }
    })
    .filter(Boolean);
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
  { params }: { params: { tenantId: string } } // ✅ not a Promise
) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const { tenantId } = params;
    if (!tenantId) {
      return NextResponse.json({ ok: false, error: "Missing tenantId" }, { status: 400 });
    }

    await dbConnect();

    const url = new URL(req.url);
    const q = url.searchParams.get("q");
    const includeRates = toBool(url.searchParams.get("includeRates"));
    const includeMedia = toBool(url.searchParams.get("includeMedia")); // ✅ new
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
        { labels: { $in: [q.trim()] } },
        { tags: { $in: [q.trim()] } },
      ];
    }

    const baseSelect =
      "name unitNumber unit_id slug description images amenities occupancy config updatedAt currency";
    const select = includeRates ? `${baseSelect} rate` : baseSelect;

    const rows = await UnitModel.find(filter)
      .select(select) // images are included; we'll normalize below
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean()
      .exec();

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
        image: pickTopImage(u),             // single “hero” for list cards
        amenities: humanAmenities(u),
        sleeps,
        bedrooms,
        bathrooms,
        view,
        squareFeet,
      };

      if (includeRates) {
        item.rate = typeof u.rate === "number" ? u.rate : null;
        item.currency = u.currency ?? null;
      }
      if (includeMedia) {
        item.media = toMediaArray(u);       // ✅ full gallery for modal
        item.mediaCount = item.media.length;
      }

      return item;
    });

    return NextResponse.json({ ok: true, count: items.length, items });
  } catch (err) {
    console.error("rooms.list (mongoose) error:", err);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
