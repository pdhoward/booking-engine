// app/api/calendars/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Calendar from "@/models/Calendar";
import { validateCalendarIntegrity } from "@/lib/utils";

type Mode = "version" | "overwrite"; // optional; default "version"

// -- Helper: compact list row --
const pickCompact = (doc: any) => ({
  _id: String(doc._id),
  name: String(doc.name),
  version: Number(doc.version ?? 1),
  active: Boolean(doc.active),
});

// -- Helper: create with auto-increment version (duplicate-safe) --
async function createWithAutoVersion(body: any) {
  const name = String(body.name || "").trim();
  if (!name) throw new Error("name is required");

  const MAX_RETRIES = 3;
  for (let i = 0; i < MAX_RETRIES; i++) {
    // Ask only for the version field and type the lean result
    const latest = await Calendar.findOne({ name })
      .sort({ version: -1 })
      .select({ version: 1, _id: 0 })
      .lean<{ version?: number } | null>();

    const currentVersion =
      typeof latest?.version === "number" ? latest.version : 0;
    const nextVersion = currentVersion + 1;

    try {
      const created = await Calendar.create({ ...body, name, version: nextVersion });
      return created;
    } catch (e: any) {
      // 11000 = duplicate key (race on (name, version)) -> retry
      if (e?.code === 11000) continue;
      throw e;
    }
  }
  throw new Error("Could not allocate version (please retry).");
}

export async function GET(req: NextRequest) {
  await dbConnect();

  const { searchParams } = new URL(req.url);
  const full = searchParams.get("full") === "1";
  const owner = searchParams.get("owner") || undefined;
  const category = searchParams.get("category") || undefined;
  const active = searchParams.get("active") || undefined;

  const filter: any = {};
  if (owner) filter.owner = owner;
  if (category) filter.category = category;
  if (active === "true") filter.active = true;
  if (active === "false") filter.active = false;

  const query = Calendar.find(filter).sort({ name: 1, version: -1 });

  if (full) {
    const rows = await query.lean();
    return NextResponse.json(rows);
  } else {
    const rows = await query.select("_id name version active").lean();
    return NextResponse.json(rows.map(pickCompact));
  }
}

export async function POST(req: NextRequest) {
  await dbConnect();
  const body = await req.json();

  // Optional mode: "version" (default) creates a new version; "overwrite" updates latest version of same name
  const mode: Mode = (body?.mode as Mode) || "version";

  try {
    validateCalendarIntegrity(body);

    if (mode === "overwrite") {
      // Overwrite latest version for this name (do not change version number)
      const updated = await Calendar.findOneAndUpdate(
        { name: body.name },
        { $set: { ...body } },
        { new: true, sort: { version: -1 } }
      );
      if (!updated) {
        // If not found, fall back to create v1
        const created = await createWithAutoVersion(body);
        return NextResponse.json(created, { status: 201 });
      }
      return NextResponse.json(updated, { status: 200 });
    }

    // Default: create a new version atomically with retry on dup key
    const created = await createWithAutoVersion(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
