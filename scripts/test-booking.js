// scripts/test-booking.js
// End-to-end smoke test for your booking APIs using Jan 2026 dates.


const BASE = process.env.BASE_URL || "http://localhost:3000";
const TENANT = process.env.TENANT_ID || "cypress-resorts";

// ---- helpers ----
function toYMD(d) {
  const iso = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString();
  return iso.slice(0, 10);
}
function addDays(ymd, n) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return toYMD(d);
}

async function jsonFetch(url, opts = {}) {
  try {
    const res = await fetch(url, {
      headers: { "content-type": "application/json", ...(opts.headers || {}) },
      // optional: add a timeout
      signal: AbortSignal.timeout?.(15000),
      ...opts,
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status} @ ${url}`);
      err.payload = data;
      throw err;
    }
    return data;
  } catch (e) {
    // Extra context for network failures
    console.error(`\n[jsonFetch] Failed to fetch ${url}`);
    if (e.cause) console.error("cause:", e.cause);
    console.error(e.message || e);
    throw e;
  }
}

function logStep(title, payload) {
  console.log(`\n=== ${title} ===`);
  console.dir(payload, { depth: null, colors: true });
}

(async function main() {
  console.log("== Booking API smoke test (Jan 2026) ==");

  // Use safe-in-the-future dates (Jan 2026)
  const check_in  = "2026-01-15";
  const check_out = "2026-01-18"; // inclusive for availability/quote/reserve APIs

  // 1) Create a Calendar (auto version)
  const calendarName = `TestCalendar-${Date.now()}`;
  const calendarBody = {
    name: calendarName,
    category: "reservations",
    currency: "USD",
    cancelHours: 48,
    cancelFee: 50,
    leadTime: { minDays: 0, maxDays: 3650 },
    minStayByWeekday: { Fri: 2, Sat: 2 }, // simple weekend rule
    blackouts: [],                         // keep empty for the test
    holidays: [],                          // keep empty for the test
    active: true,
  };

  const createdCalendar = await jsonFetch(`${BASE}/api/calendars`, {
    method: "POST",
    body: JSON.stringify(calendarBody),
  });
  logStep("Created Calendar", createdCalendar);

  const calendarId = createdCalendar._id;
  const calendarVersion = createdCalendar.version;

  // 2) Create a Unit and link this calendar effective in the past so it applies to Jan 2026
  const unitBody = {
    name: `Test Villa ${Math.floor(Math.random()*1000)}`,
    unitNumber: "A1",
    type: "villa",
    description: "E2E test unit",
    rate: 395,
    currency: "USD",
    active: true,
    calendars: [
      {
        calendarId,
        name: calendarName,
        version: calendarVersion,
        effectiveDate: "2025-01-01", // must be <= 2026-01-15
      },
    ],
  };

    // Before creating the calendar, do a quick GET ping:
    const ping = await fetch(`${BASE}/api/calendars`).catch(() => null);
    if (!ping || !ping.ok) {
    console.error(
        `\nCannot reach ${BASE}. Is your Next dev server running on that port?\n` +
        `Try opening ${BASE}/api/calendars in a browser.\n` +
        `If your app chose a different port, re-run with BASE_URL set to that port.`
    );
    process.exit(1);
    }

  const createdUnit = await jsonFetch(`${BASE}/api/units`, {
    method: "POST",
    body: JSON.stringify(unitBody),
  });
  logStep("Created Unit", createdUnit);

  const unitId = createdUnit._id;

  // 3) Availability check
  const availUrl = new URL(`${BASE}/api/booking/${TENANT}/availability`);
  availUrl.searchParams.set("unit_id", unitId);
  availUrl.searchParams.set("check_in", check_in);
  availUrl.searchParams.set("check_out", check_out);
  const availability = await jsonFetch(availUrl.toString());
  logStep("Availability", availability);
  if (!availability.ok) {
    console.error("Availability failed; stopping test.");
    process.exit(1);
  }

  // 4) Quote
  const quoteUrl = new URL(`${BASE}/api/booking/${TENANT}/quote`);
  quoteUrl.searchParams.set("unit_id", unitId);
  quoteUrl.searchParams.set("check_in", check_in);
  quoteUrl.searchParams.set("check_out", check_out);
  const quote = await jsonFetch(quoteUrl.toString());
  logStep("Quote", quote);

  // 5) Reserve
  const reserveBody = {
    unit_id: unitId,
    check_in,
    check_out,
    guest: {
      first_name: "Janet",
      last_name: "Testerson",
      email: "janet@example.com",
      phone: "+1-555-0100",
    },
  };
  const reservation = await jsonFetch(`${BASE}/api/booking/${TENANT}/reserve`, {
    method: "POST",
    body: JSON.stringify(reserveBody),
  });
  logStep("Reservation (first attempt)", reservation);

  // 6) Attempt overlapping reservation to verify overlap guard
  let overlapResult;
  try {
    overlapResult = await jsonFetch(`${BASE}/api/booking/${TENANT}/reserve`, {
      method: "POST",
      body: JSON.stringify(reserveBody),
    });
  } catch (e) {
    console.log("\n=== Overlap attempt ===");
    console.log(e.message);
    console.dir(e.payload, { depth: null, colors: true });
  }

  console.log("\n✅ Test complete.");
})().catch((err) => {
  console.error("\n❌ Test failed:");
  console.error(err.stack || err);
  if (err.payload) {
    console.error("Payload:");
    console.dir(err.payload, { depth: null, colors: true });
  }
  process.exit(1);
});
