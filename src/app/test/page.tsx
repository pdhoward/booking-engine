// /app/test/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Unit } from "@/types/unit";
import type { CalendarState, CalendarCategory } from "@/types/calendar";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon } from "lucide-react";

import { fetchAllUnits, fetchUnitById } from "@/lib/api/units";
import { fetchCalendarById } from "@/lib/api/calendars";
import { evaluateBookingRequest } from "@/lib/engine/evaluateBooking";
import { createReservation, checkReservationOverlap } from "@/lib/api/reservations";
import { DatePicker } from "@/components/DatePicker";

/* ------------------------------ date helpers ------------------------------ */
/** normalize to UTC midnight ymd */
const toMidnightUTC = (isoYmd: string) => new Date(`${isoYmd}T00:00:00Z`);
const toYMD = (d: Date | string) => {
  const x = typeof d === "string" ? new Date(d) : d;
  const utc = new Date(Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()));
  return utc.toISOString().slice(0, 10);
};
const addDaysYmd = (ymd: string, days: number) => {
  const base = toMidnightUTC(ymd).getTime();
  return new Date(base + days * 86400000).toISOString().slice(0, 10);
};
function nightsBetween(startYmd: string, endInclusiveYmd: string) {
  const s = toMidnightUTC(startYmd).getTime();
  const e = toMidnightUTC(endInclusiveYmd).getTime();
  return Math.max(1, Math.round((e - s) / 86400000) || 1);
}

/* ----------------------------- small UI helper ---------------------------- */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="font-medium">{label}:</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}

/* ---------------------------------- page ---------------------------------- */
export default function TestBookingPage() {
  // data
  const [units, setUnits] = useState<Unit[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(true);

  // inputs
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");
  const [mode, setMode] = useState<CalendarCategory>("reservations");

  // result / confirmation
  const [result, setResult] = useState<{ ok: boolean; reasons: string[] } | null>(null);
  const [confirmation, setConfirmation] = useState<{
    id: string;
    unitLabel: string;
    startYmd: string;
    endYmd: string; // inclusive for messaging
  } | null>(null);

  // chosen context
  const [unit, setUnit] = useState<Unit | null>(null);
  const [calInfo, setCalInfo] = useState<{ name: string; version: number } | null>(null);
  const [quotedTotal, setQuotedTotal] = useState<number | null>(null);

  // UX
  const [checking, setChecking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  // derive ymd strings
  const startYmd = useMemo(() => (startDate ? toYMD(startDate) : ""), [startDate]);
  const endYmd = useMemo(() => (endDate ? toYMD(endDate) : ""), [endDate]);

  // load units once
  useEffect(() => {
    (async () => {
      setLoadingUnits(true);
      try {
        const list = await fetchAllUnits();
        setUnits(list);
      } finally {
        setLoadingUnits(false);
      }
    })();
  }, []);

  const chosenUnitLabel = useMemo(() => {
    if (!unit) return "";
    return `${unit.name}${unit.unitNumber ? ` #${unit.unitNumber}` : ""}`;
  }, [unit]);

  // choose latest effective calendar <= start
  function pickCalendarLink(
    links: Array<{ calendarId: string; name: string; version: number; effectiveDate: string } | any>,
    startIsoYmd: string
  ) {
    const sMs = Date.parse(startIsoYmd);
    const normalized = (links ?? []).map((l) => ({
      calendarId: String(l.calendarId),
      name: String(l.name ?? ""),
      version: Number(l.version ?? 1),
      effectiveDate: toYMD(l.effectiveDate), // normalize whatever shape
    }));
    const eligible = normalized
      .filter((l) => Number.isFinite(Date.parse(l.effectiveDate)) && Date.parse(l.effectiveDate) <= sMs)
      .sort((a, b) => Date.parse(a.effectiveDate) - Date.parse(b.effectiveDate));
    return eligible.at(-1) ?? null;
  }

  // derived booleans for buttons
  const canCheck = !!selectedUnitId && !!startYmd && (mode === "appointments" || !!endYmd || true);
  const canConfirm = !!result?.ok && !!unit;

  /* ---------------------------- availability check ---------------------------- */
  const checkAvailability = async () => {
    setChecking(true);
    // reset UI slice
    setResult(null);
    setConfirmation(null);
    setUnit(null);
    setCalInfo(null);
    setQuotedTotal(null);

    try {
      const brief = units.find((u) => String(u._id) === selectedUnitId);
      if (!brief) {
        setResult({ ok: false, reasons: ["Please choose a unit."] });
        return;
      }
      if (!startYmd) {
        setResult({ ok: false, reasons: ["Start date is required."] });
        return;
      }

      const endInclusive = mode === "reservations" ? (endYmd || startYmd) : startYmd;
      const endExclusive = addDaysYmd(endInclusive, 1);

      // load full unit
      let full = await fetchUnitById(String(brief._id)).catch(() => null);
      full = (full as Unit | null) ?? brief;

      // calendar selection
      const link = pickCalendarLink(full.calendars ?? [], startYmd);
      if (!link) {
        const future = (full.calendars ?? [])
          .map((l: any) => Date.parse(toYMD(l.effectiveDate)))
          .filter((ms: number) => Number.isFinite(ms) && ms > Date.parse(startYmd))
          .sort((a: number, b: number) => a - b)[0];
        setResult({
          ok: false,
          reasons: [
            `No applicable calendar for ${startYmd}. Available from: ${
              future ? new Date(future).toISOString().slice(0, 10) : "—"
            }.`,
          ],
        });
        return;
      }

      // hard overlap guard (server)
      const overlap = await checkReservationOverlap({
        unitId: String(full._id),
        startYmd,
        endYmd: endExclusive,
      });
      if (overlap.overlap) {
        setResult({ ok: false, reasons: ["Overlapping reservation exists."] });
        return;
      }

      // policy/rules
      const calendar = await fetchCalendarById(link.calendarId);
      if (!calendar) {
        setResult({ ok: false, reasons: ["Linked calendar not found."] });
        return;
      }

      // engine/policy evaluation (client-only)
      const evalRes = evaluateBookingRequest(calendar as CalendarState, {
        start: startYmd,
        end: endInclusive,
        mode,
      });
      setUnit(full);
      setCalInfo({ name: calendar.name, version: calendar.version });

      if (!evalRes.ok) {
        setResult(evalRes);
        return;
      }

      const nights = mode === "reservations" ? nightsBetween(startYmd, endInclusive) : 1;
      const total = (full.rate || 0) * nights;
      setQuotedTotal(total);

      setResult({
        ok: true,
        reasons: [
          `Rate: ${full.currency || "USD"} ${total} (${nights} night${nights > 1 ? "s" : ""})`,
          `Cancel: ${calendar.cancelHours}h notice, fee ${calendar.currency} ${calendar.cancelFee}`,
          `Calendar: ${link.name} v${link.version} (eff ${link.effectiveDate})`,
        ],
      });
    } finally {
      setChecking(false);
    }
  };

  /* ------------------------------- confirmation ------------------------------ */
  const confirmReservation = async () => {
    if (!canConfirm || !unit) return;
    setConfirming(true);
    try {
      const endInclusive = mode === "reservations" ? (endYmd || startYmd) : startYmd;
      const endExclusive = addDaysYmd(endInclusive, 1);
      const link = pickCalendarLink(unit.calendars ?? [], startYmd);
      if (!link) {
        setResult({ ok: false, reasons: ["No applicable calendar."] });
        return;
      }

      const saved = await createReservation({
        unitId: String(unit._id),
        unitName: unit.name,
        unitNumber: unit.unitNumber || "",
        calendarId: link.calendarId,
        calendarName: link.name,
        startYmd,             // inclusive
        endYmd: endExclusive, // EXCLUSIVE for API
        rate: Number(unit.rate || 0),
        currency: unit.currency || "USD",
      });

      // success → show confirmation card
      setResult(null);
      setConfirmation({
        id: String(saved._id),
        unitLabel: `${unit.name}${unit.unitNumber ? ` #${unit.unitNumber}` : ""}`,
        startYmd,
        endYmd: endInclusive,
      });
    } catch (err: any) {
      setResult({ ok: false, reasons: [err?.message || "Failed to save reservation."] });
    } finally {
      setConfirming(false);
    }
  };

  const resetQuote = () => {
    setResult(null);
    setConfirmation(null);
    setUnit(null);
    setCalInfo(null);
    setQuotedTotal(null);
    // keep selections for convenience
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted text-foreground">
      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-3">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded px-1 py-1 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Go to Home"
              title="Home"
            >
              <CalendarIcon className="h-5 w-5" aria-hidden="true" />
              <span className="font-semibold tracking-tight">Booking Engine</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-sm text-muted-foreground">Test Reservation Workflow</span>
            </Link>
            {unit && !confirmation && <Badge className="ml-2">{chosenUnitLabel}</Badge>}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-screen-sm p-3 md:p-6">
        <Card>
          <CardContent className="pt-6 space-y-4">
            {/* Unit */}
            <div>
              <Label className="text-xs">Unit</Label>
              <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Choose unit" />
                </SelectTrigger>
                <SelectContent>
                  {loadingUnits && <div className="px-2 py-1 text-xs text-muted-foreground">Loading…</div>}
                  {!loadingUnits && units.length === 0 && (
                    <div className="px-2 py-1 text-xs text-muted-foreground">No units</div>
                  )}
                  {!loadingUnits &&
                    units.map((u) => (
                      <SelectItem key={String(u._id)} value={String(u._id)}>
                        {u.name}
                        {u.unitNumber ? ` #${u.unitNumber}` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Mode */}
            <div>
              <Label className="text-xs">Mode</Label>
              <Select value={mode} onValueChange={(v: CalendarCategory) => setMode(v)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reservations">Reservations</SelectItem>
                  <SelectItem value="appointments">Appointments</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Start date */}
            <div>
              <Label className="text-xs">Start</Label>
              <DatePicker
                value={startDate}
                onChange={(d) => {
                  setStartDate(d ?? undefined);
                  // if checkout is before start (or unset), nudge it to start
                  if (d && endDate && endDate < d) setEndDate(d);
                }}
                numberOfMonths={2}
                placeholder="Select check-in"
              />
            </div>

            {/* End date (reservations only) */}
            {mode === "reservations" && (
              <div>
                <Label className="text-xs">End</Label>
                <DatePicker
                  value={endDate}
                  onChange={(d) => setEndDate(d ?? undefined)}
                  numberOfMonths={2}
                  defaultMonth={startDate}
                  disabled={startDate ? { before: startDate } : undefined}
                  modifiers={startDate ? { checkin: startDate } : undefined}
                  placeholder="Select check-out"
                />
              </div>
            )}

            <Button className="w-full" onClick={checkAvailability} disabled={checking || !canCheck}>
              {checking ? "Checking…" : "Check availability"}
            </Button>

            {/* Confirmation card (only after successful POST) */}
            {confirmation && (
              <Card>
                <CardContent className="pt-4 space-y-2">
                  <div className="font-medium text-green-700">Reservation confirmed</div>
                  <div className="text-sm space-y-1">
                    <Row label="Unit">{confirmation.unitLabel}</Row>
                    <Row label="Dates">
                      {confirmation.startYmd} → {confirmation.endYmd}
                    </Row>
                    <div className="text-xs text-muted-foreground">Your booking has been saved successfully.</div>
                  </div>
                  <div className="pt-2">
                    <Button size="sm" variant="outline" onClick={resetQuote}>
                      New test
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Availability result card (hidden when confirmation exists) */}
            {!confirmation && result && (
              <Card>
                <CardContent className="pt-4 space-y-2">
                  <div className={`font-medium ${result.ok ? "text-green-600" : "text-red-600"}`}>
                    {result.ok ? "Available" : "Unavailable"}
                  </div>

                  {result.ok && unit && (
                    <div className="text-sm space-y-1">
                      <Row label="Unit">{chosenUnitLabel}</Row>
                      <Row label="Dates">
                        {startYmd}
                        {mode === "reservations" ? ` → ${endYmd || startYmd}` : ""}
                      </Row>
                      {calInfo && (
                        <div className="text-xs text-muted-foreground">
                          Using calendar: {calInfo.name} (v{calInfo.version})
                        </div>
                      )}
                      <Row label="Rate">
                        {(unit.currency || "USD")} {unit.rate}
                        {mode === "reservations" ? " /night" : ""}
                      </Row>
                      {quotedTotal !== null && <Row label="Total">{unit.currency || "USD"} {quotedTotal}</Row>}
                      <div className="flex gap-2 pt-2">
                        <Button size="sm" onClick={confirmReservation} disabled={confirming || !canConfirm}>
                          {confirming ? "Saving…" : "Confirm"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={resetQuote}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {!result.ok && (
                    <ul className="mt-1 list-disc pl-5 text-sm">
                      {result.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
