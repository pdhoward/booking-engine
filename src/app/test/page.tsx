"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { Unit } from "@/types/unit";
import { CalendarCategory } from "@/types/calendar";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

import { fetchAllUnits, fetchUnitById } from "@/lib/api/units";
import { fetchCalendarById } from "@/lib/api/calendars";
import { evaluateBookingRequest } from "@/lib/engine/evaluateBooking";
import { createReservation } from "@/lib/api/reservations";

// ---- date helpers (UTC-ymd safe) ----
const toMidnightUTC = (isoYmd: string) => new Date(`${isoYmd}T00:00:00Z`);
const toYMD = (d: Date | string) => {
  const x = typeof d === "string" ? new Date(d) : d;
  return new Date(Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())).toISOString().slice(0, 10);
};
const addDaysYmd = (ymd: string, days: number) => toYMD(new Date(Date.parse(ymd) + days * 86400000));
function nightsBetween(startYmd: string, endYmd: string) {
  const s = toMidnightUTC(startYmd).getTime();
  const e = toMidnightUTC(endYmd).getTime();
  return Math.max(1, Math.round((e - s) / 86400000) || 1);
}

export default function TestBookingPage() {
  // data
  const [units, setUnits] = useState<Unit[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(true);

  // inputs
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");
  const [mode, setMode] = useState<CalendarCategory>("reservations");
  const [startYmd, setStartYmd] = useState("");
  const [endYmd, setEndYmd] = useState("");

  // result/confirmation
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

  // pick calendar link for a start date (latest effectiveDate <= start)
  function pickCalendarLink(links: any[], start: string) {
    const sMs = Date.parse(start);
    const normalized = (links ?? []).map((l) => ({
      calendarId: String(l.calendarId),
      name: String(l.name ?? ""),
      version: Number(l.version ?? 1),
      effectiveDate: toYMD(l.effectiveDate),
    }));
    const eligible = normalized
      .filter((l) => Number.isFinite(Date.parse(l.effectiveDate)) && Date.parse(l.effectiveDate) <= sMs)
      .sort((a, b) => Date.parse(a.effectiveDate) - Date.parse(b.effectiveDate));
    return eligible.at(-1);
  }

  // check availability
  const checkAvailability = async () => {
    // reset UI states
    setResult(null);
    setConfirmation(null);
    setUnit(null);
    setCalInfo(null);
    setQuotedTotal(null);

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

    let full = await fetchUnitById(String(brief._id)).catch(() => null);
    full = full ?? brief;

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

    const calendar = await fetchCalendarById(link.calendarId);
    if (!calendar) {
      setResult({ ok: false, reasons: ["Linked calendar not found."] });
      return;
    }

    const evalRes = evaluateBookingRequest(calendar, { start: startYmd, end: endInclusive, mode });
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
        `Rate: ${full.currency} ${total} (${nights} night${nights > 1 ? "s" : ""})`,
        `Cancel: ${calendar.cancelHours}h notice, fee ${calendar.currency} ${calendar.cancelFee}`,
        `Calendar: ${link.name} v${link.version} (eff ${link.effectiveDate})`,
      ],
    });
  };

  // confirm → persist reservation (end is EXCLUSIVE in API) and show CONFIRMATION card
  const confirmReservation = async () => {
    if (!result?.ok || !unit) return;

    try {
      const endInclusive = mode === "reservations" ? (endYmd || startYmd) : startYmd;
      const endExclusive = addDaysYmd(endInclusive, 1);

      const link = pickCalendarLink(unit.calendars ?? [], startYmd);
      if (!link) {
        setResult({ ok: false, reasons: ["No applicable calendar."] });
        return;
      }

      const rate = Number(unit.rate || 0);

      const saved = await createReservation({
        unitId: String(unit._id),
        unitName: unit.name,
        unitNumber: unit.unitNumber || "",
        calendarId: link.calendarId,
        calendarName: link.name,
        startYmd,
        endYmd: endExclusive, // exclusive for API
        rate,                 // per-night (or flat for appts)
        currency: unit.currency || "USD",
      });

      // Only after successful POST, replace UI with confirmation
      setResult(null);
      setConfirmation({
        id: saved._id,
        unitLabel: `${unit.name}${unit.unitNumber ? ` #${unit.unitNumber}` : ""}`,
        startYmd,
        endYmd: endInclusive, // inclusive for human-friendly display
      });
    } catch (err: any) {
      setResult({ ok: false, reasons: [err?.message || "Failed to save reservation."] });
    }
  };

  const resetQuote = () => {
    setResult(null);
    setConfirmation(null);
    setUnit(null);
    setCalInfo(null);
    setQuotedTotal(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted text-foreground">
      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold tracking-tight">Test Booking</span>
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
                <SelectTrigger className="h-9"><SelectValue placeholder="Choose unit" /></SelectTrigger>
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
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="reservations">Reservations</SelectItem>
                  <SelectItem value="appointments">Appointments</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Dates */}
            <div>
              <Label className="text-xs">Start (yyyy-mm-dd)</Label>
              <Input type="date" value={startYmd} onChange={(e) => setStartYmd(e.target.value)} className="h-9" />
            </div>

            {mode === "reservations" && (
              <div>
                <Label className="text-xs">End (yyyy-mm-dd)</Label>
                <Input type="date" value={endYmd} onChange={(e) => setEndYmd(e.target.value)} className="h-9" />
              </div>
            )}

            <Button className="w-full" onClick={checkAvailability}>
              Check availability
            </Button>

            {/* Confirmation card (shown only after successful POST) */}
            {confirmation && (
              <Card>
                <CardContent className="pt-4 space-y-2">
                  <div className="font-medium text-green-700">Reservation confirmed</div>
                  <div className="text-sm space-y-1">
                    <div>
                      <span className="font-medium">Unit:</span> {confirmation.unitLabel}
                    </div>
                    <div>
                      <span className="font-medium">Dates:</span> {confirmation.startYmd} → {confirmation.endYmd}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Your booking has been saved successfully.
                    </div>
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
                      <div>
                        <span className="font-medium">Unit:</span> {chosenUnitLabel}
                      </div>
                      <div>
                        <span className="font-medium">Dates:</span>{" "}
                        {startYmd}
                        {mode === "reservations" ? ` → ${endYmd || startYmd}` : ""}
                      </div>
                      {calInfo && (
                        <div className="text-xs text-muted-foreground">
                          Using calendar: {calInfo.name} (v{calInfo.version})
                        </div>
                      )}
                      <div>
                        <span className="font-medium">Rate:</span> {unit.currency} {unit.rate}
                        {mode === "reservations" ? " /night" : ""}
                      </div>
                      {quotedTotal !== null && (
                        <div>
                          <span className="font-medium">Total:</span> {unit.currency} {quotedTotal}
                        </div>
                      )}
                      <div className="flex gap-2 pt-2">
                        <Button size="sm" onClick={confirmReservation}>
                          Confirm
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
