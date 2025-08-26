"use client";

import React, { useEffect, useState } from "react";
import { CalendarState, CalendarCategory, CatalogRow } from "@/types/calendar";
import type { Unit } from "@/types/unit";
import { evaluateBookingRequest } from "@/lib/engine/evaluateBooking";
import { fetchUnitById } from "@/lib/api/units";
import { fetchCalendarById } from "@/lib/api/calendars";
import { fetchAllUnits } from "@/lib/api/units";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar as CalendarIcon, Plus, Save, RefreshCcw, Database, ChevronDown, Eye, Ban, Sparkles, Power, Lock, TestTube2 } from "lucide-react";

import type { EventInput } from "@fullcalendar/core";

type Props = {
  cal: CalendarState;
  setCal: React.Dispatch<React.SetStateAction<CalendarState>>;
  addMode: "cursor" | "blackout" | "holiday";
  setAddMode: (m: "cursor" | "blackout" | "holiday") => void;
  view: "dayGridMonth" | "timeGridWeek" | "timeGridDay" | "multiMonthYear";
  setView: (v: any) => void;
  catalog: CatalogRow[];
  loadingCatalog: boolean;
  onSave: () => Promise<void>;
  onReset: () => void;
  isDirty: boolean;
  setSavedSnapshot: (snap: CalendarState) => void;

  /** optional: parent can use this to push a reservation pill into the calendar */
  onReservationCreated?: (ev: EventInput) => void;
};

// ---- helpers only used by the test sheet ----
const toMidnightUTC = (isoYmd: string) => new Date(`${isoYmd}T00:00:00Z`);

const ymdUTC = (d: Date) =>
  new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    .toISOString()
    .slice(0, 10);

const toYMD = (d: Date | string) => {
  const x = typeof d === "string" ? new Date(d) : d;
  return new Date(Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()))
    .toISOString()
    .slice(0, 10);
};

function pickCalendarLinkForStart(
  links: { effectiveDate: string }[],
  startYmd: string
) {
  const start = toMidnightUTC(startYmd);
  const eligible = links.filter((l) => toMidnightUTC(l.effectiveDate) <= start);
  if (!eligible.length) return null;
  eligible.sort(
    (a, b) =>
      toMidnightUTC(a.effectiveDate).getTime() -
      toMidnightUTC(b.effectiveDate).getTime()
  );
  return eligible[eligible.length - 1]; // latest <= start
}

function nightsBetween(startYmd: string, endYmd: string) {
  const s = toMidnightUTC(startYmd).getTime();
  const e = toMidnightUTC(endYmd).getTime();
  const n = Math.max(1, Math.round((e - s) / 86400000) || 1);
  return n;
}

export default function HeaderBar({
  cal,
  setCal,
  addMode,
  setAddMode,
  view,
  setView,
  catalog,
  loadingCatalog,
  onSave,
  onReset,
  isDirty,
  setSavedSnapshot,
  onReservationCreated,
}: Props) {
  // ---- test drawer state ----
  const [testOpen, setTestOpen] = useState(false);

  // unit selection (by _id)
  const [units, setUnits] = useState<Unit[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(true);
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");

  // booking inputs
  const [testStart, setTestStart] = useState("");
  const [testEnd, setTestEnd] = useState("");

  // result state
  const [testResult, setTestResult] = useState<{ ok: boolean; reasons: string[] } | null>(null);
  const [chosenUnit, setChosenUnit] = useState<Unit | null>(null);
  const [chosenCalendarInfo, setChosenCalendarInfo] = useState<{ name: string; version: number } | null>(null);
  const [quotedTotal, setQuotedTotal] = useState<number | null>(null);

  // load units (for unit picker)
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

  // submit booking availability check  
  const handleCheckAvailability = async () => {
    setTestResult(null);
    setChosenUnit(null);
    setChosenCalendarInfo(null);
    setQuotedTotal(null);

    // 1) Validate input
    const unitBrief = units.find((u) => String(u._id) === selectedUnitId);
    if (!unitBrief) {
      setTestResult({ ok: false, reasons: ["Please choose a unit."] });
      return;
    }
    if (!testStart) {
      setTestResult({ ok: false, reasons: ["Start date is required."] });
      return;
    }

    const mode: CalendarCategory = cal.category; // or "reservations"
    const startYmd = toYMD(testStart);
    const endYmd = mode === "reservations" ? toYMD(testEnd || testStart) : startYmd;

    // 2) Fetch the full unit to ensure calendars are present & normalized
    //    (falls back to local if fetch fails)
    let unit = await fetchUnitById(String(unitBrief._id)).catch(() => null);
    unit = unit ?? unitBrief;

    const links = (unit.calendars ?? []).map((l: any) => ({
      calendarId: String(l.calendarId),
      name: String(l.name ?? ""),
      version: Number(l.version ?? 1),
      effectiveDate: toYMD(l.effectiveDate), // normalize
    }));

    if (links.length === 0) {
      setTestResult({ ok: false, reasons: ["This unit has no linked calendars."] });
      return;
    }

    // 3) Pick the applicable calendar: latest link with effectiveDate <= start
    const startMs = Date.parse(startYmd);
    const eligible = links
      .filter((l) => Number.isFinite(Date.parse(l.effectiveDate)) && Date.parse(l.effectiveDate) <= startMs)
      .sort((a, b) => Date.parse(a.effectiveDate) - Date.parse(b.effectiveDate));

    const applicable = eligible.at(-1);

    if (!applicable) {
      // show the earliest future effective date (or — if none)
      const future = links
        .map((l) => Date.parse(l.effectiveDate))
        .filter((ms) => Number.isFinite(ms) && ms > startMs)
        .sort((a, b) => a - b)[0];

      const futureYmd = future ? new Date(future).toISOString().slice(0, 10) : "—";
      setTestResult({
        ok: false,
        reasons: [`No applicable calendar for ${startYmd}. Available from: ${futureYmd}.`],
      });
      return;
    }

    // 4) Fetch the selected calendar & evaluate rules
    const theCal = await fetchCalendarById(applicable.calendarId);
    if (!theCal) {
      setTestResult({ ok: false, reasons: ["Linked calendar not found."] });
      return;
    }

    const res = evaluateBookingRequest(theCal, { start: startYmd, end: endYmd, mode });

    // 5) Update UI state (unit + cal info always set)
    setChosenUnit(unit);
    setChosenCalendarInfo({ name: theCal.name, version: theCal.version });

    if (!res.ok) {
      setTestResult(res);
      return;
    }

    // 6) Quote (simple): nightly rate × nights (reservations) or flat (appointments)
    const nights = mode === "reservations" ? nightsBetween(startYmd, endYmd) : 1;
    const total = (unit.rate || 0) * nights;
    setQuotedTotal(total);

    // enrich success with policy details
    setTestResult({
      ok: true,
      reasons: [
        `Rate: ${unit.currency} ${total} (${nights} night${nights > 1 ? "s" : ""})`,
        `Cancel: ${theCal.cancelHours}h notice, fee ${theCal.currency} ${theCal.cancelFee}`,
        `Calendar: ${applicable.name} v${applicable.version} (eff ${applicable.effectiveDate})`,
      ],
    });
  };


  // confirm booking (client-side “stage” only; hand-off to API as needed)
  const handleConfirm = async () => {
    if (!testResult?.ok || !chosenUnit) return;
    const startYmd = testStart;
    const endYmd = cal.category === "reservations" ? (testEnd || testStart) : testStart;

    // Optional: persist via /api/reservations; for now we just create a calendar pill
    const ev: EventInput = {
      id: `resv-${chosenUnit._id}-${startYmd}`,
      start: startYmd,
      end: ymdUTC(new Date(toMidnightUTC(endYmd).getTime() + 86400000)), // exclusive end for all-day span
      allDay: true,
      display: "block",
      title: `${chosenUnit.name}${chosenUnit.unitNumber ? ` #${chosenUnit.unitNumber}` : ""}`,
      classNames: ["fc-reservation-pill"],
    };
    onReservationCreated?.(ev);

    // Close drawer & reset local result
    setTestOpen(false);
    setTestResult(null);
  };

  const handleCancelQuote = () => {
    setTestResult(null);
    setChosenUnit(null);
    setChosenCalendarInfo(null);
    setQuotedTotal(null);
  };

  return (
    <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-3">
      <div className="flex items-center gap-2">
        <CalendarIcon className="h-5 w-5" />
        <span className="font-semibold tracking-tight">Booking Engine</span>

        <Badge className={`ml-2 ${cal.active ? "bg-green-600" : "bg-red-600"} text-white`}>
          {cal.active ? "Active" : "Suspended"}
        </Badge>

        {cal.name ? (
          <Badge className={`ml-1 ${cal.category === "reservations" ? "bg-blue-600" : "bg-green-600"} text-white`}>
            {cal.name} • v{cal.version}
          </Badge>
        ) : (
          <Badge className="ml-1 bg-red-600 text-white">new calendar</Badge>
        )}

        {isDirty && (
          <Badge className="ml-1 border-amber-500 text-amber-700 bg-amber-50">
            Unsaved
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Meta dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1 text-xs">
              <Plus className="h-4 w-4" /> Meta <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[360px] p-3" align="end">
            <DropdownMenuLabel className="text-xs">Calendar Metadata</DropdownMenuLabel>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="col-span-2">
                <Label className="text-xs">Name</Label>
                <Input
                  value={cal.name}
                  onChange={(e) => setCal({ ...cal, name: e.target.value })}
                  placeholder="e.g. Cypress Main"
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <Select
                  value={cal.category}
                  onValueChange={(v: CalendarCategory) => setCal({ ...cal, category: v })}
                >
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reservations">Reservations</SelectItem>
                    <SelectItem value="appointments">Appointments</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Owner</Label>
                <Input value={cal.owner} onChange={(e) => setCal({ ...cal, owner: e.target.value })} className="h-8" />
              </div>
              <div>
                <Label className="text-xs">Currency</Label>
                <Input
                  value={cal.currency}
                  onChange={(e) => setCal({ ...cal, currency: e.target.value.toUpperCase() })}
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-xs">Cancel Notice (hrs)</Label>
                <Input
                  type="number"
                  value={cal.cancelHours}
                  onChange={(e) => setCal({ ...cal, cancelHours: +e.target.value || 0 })}
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-xs">Cancel Fee</Label>
                <Input
                  type="number"
                  value={cal.cancelFee}
                  onChange={(e) => setCal({ ...cal, cancelFee: +e.target.value || 0 })}
                  className="h-8"
                />
              </div>
              <div className="flex items-center justify-between col-span-2 mt-2">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Active</Label>
                  <Switch checked={cal.active} onCheckedChange={(v: any) => setCal({ ...cal, active: v })} />
                </div>
                <Button size="sm" onClick={onSave}><Save className="mr-2 h-4 w-4" />Save</Button>
              </div>
              <div className="col-span-2">
                <p className="text-[10px] text-muted-foreground mt-1">
                  Unique key = (name, version). Creating a new version with the same name increments version.
                </p>
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Existing calendars dropdown (unchanged) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1 text-xs">
              <Database className="h-4 w-4" /> Calendars <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent className="w-[360px]" align="end">
            <DropdownMenuLabel className="text-xs">Select to Edit</DropdownMenuLabel>
            <DropdownMenuSeparator />

            {loadingCatalog && <DropdownMenuItem disabled>Loading…</DropdownMenuItem>}
            {!loadingCatalog && catalog.length === 0 && (
              <DropdownMenuItem disabled>No calendars</DropdownMenuItem>
            )}

            {!loadingCatalog && catalog.length > 0 && (
              <div className="max-h-72 overflow-y-auto pr-1">
                {[...catalog]
                  .sort(
                    (a, b) =>
                      Number(b.active) - Number(a.active) ||
                      b.version - a.version ||
                      a.name.localeCompare(b.name)
                  )
                  .map((c) => (
                    <DropdownMenuItem
                      key={c._id}
                      onClick={async () => {
                        const full = await fetchCalendarById(c._id);
                        if (full) {
                          setCal(full);
                          setSavedSnapshot(full);
                        }
                      }}
                      className="justify-between gap-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            c.active ? "bg-emerald-500" : "bg-zinc-400"
                          }`}
                          aria-hidden
                        />
                        <span className="truncate">{c.name}</span>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        v{c.version}{c.active ? " • active" : ""}
                      </span>
                    </DropdownMenuItem>
                  ))}
              </div>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onReset}>
              <RefreshCcw className="h-3 w-3 mr-2" />
              New Calendar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Mode toggles */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={addMode === "cursor" ? "default" : "ghost"}
              size="icon"
              onClick={() => setAddMode("cursor")}
            >
              <Eye className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Cursor</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={addMode === "blackout" ? "default" : "ghost"}
              size="icon"
              onClick={() => setAddMode(addMode === "blackout" ? "cursor" : "blackout")}
            >
              <Ban className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Blackout Mode</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={addMode === "holiday" ? "default" : "ghost"}
              size="icon"
              onClick={() => setAddMode(addMode === "holiday" ? "cursor" : "holiday")}
            >
              <Sparkles className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Holiday Mode</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCal((p) => ({ ...p, active: !p.active }))}
            >
              {cal.active ? <Power className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{cal.active ? "Suspend" : "Activate"}</TooltipContent>
        </Tooltip>

        {/* View switch */}
        <Select value={view} onValueChange={(v: any) => setView(v)}>
          <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="dayGridMonth">Month</SelectItem>
            <SelectItem value="timeGridWeek">Week</SelectItem>
            <SelectItem value="timeGridDay">Day</SelectItem>
            <SelectItem value="multiMonthYear">Year</SelectItem>
          </SelectContent>
        </Select>

        {/* Test Sheet (upgraded) */}
        <Sheet open={testOpen} onOpenChange={setTestOpen}>
          <SheetTrigger asChild>
            <Button variant="default" size="sm" className="ml-2 gap-1">
              <TestTube2 className="h-4 w-4" /> Test
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[380px]">
            <SheetHeader><SheetTitle>Test Booking</SheetTitle></SheetHeader>
            <div className="mt-4 space-y-3">
              {/* pick unit by _id */}
              <div>
                <Label className="text-xs">Unit</Label>
                <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="Choose unit" /></SelectTrigger>
                  <SelectContent>
                    {loadingUnits && <div className="px-2 py-1 text-xs text-muted-foreground">Loading…</div>}
                    {!loadingUnits && units.length === 0 && <div className="px-2 py-1 text-xs text-muted-foreground">No units</div>}
                    {!loadingUnits && units.map((u) => (
                      <SelectItem key={String(u._id)} value={String(u._id)}>
                        {u.name}{u.unitNumber ? ` #${u.unitNumber}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Mode</Label>
                <Select value={cal.category} onValueChange={(v: CalendarCategory) => setCal({ ...cal, category: v })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reservations">Reservations</SelectItem>
                    <SelectItem value="appointments">Appointments</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Start (yyyy-mm-dd)</Label>
                <Input value={testStart} onChange={(e) => setTestStart(e.target.value)} placeholder="2025-08-29" className="h-8" />
              </div>

              {cal.category === "reservations" && (
                <div>
                  <Label className="text-xs">End (yyyy-mm-dd)</Label>
                  <Input value={testEnd} onChange={(e) => setTestEnd(e.target.value)} placeholder="2025-08-30" className="h-8" />
                </div>
              )}

              <Button onClick={handleCheckAvailability} className="w-full">Check availability</Button>

              {/* Outcome */}
              {testResult && (
                <Card>
                  <CardContent className="pt-4 space-y-2">
                    <div className={`font-medium ${testResult.ok ? "text-green-600" : "text-red-600"}`}>
                      {testResult.ok ? "Available" : "Unavailable"}
                    </div>

                    {/* details on success */}
                    {testResult.ok && chosenUnit && (
                      <div className="text-sm space-y-1">
                        <div>
                          <span className="font-medium">Unit:</span>{" "}
                          {chosenUnit.name}{chosenUnit.unitNumber ? ` #${chosenUnit.unitNumber}` : ""}
                        </div>
                        <div><span className="font-medium">Dates:</span> {testStart}{cal.category === "reservations" ? ` → ${testEnd || testStart}` : ""}</div>
                        {chosenCalendarInfo && (
                          <div className="text-xs text-muted-foreground">
                            Using calendar: {chosenCalendarInfo.name} (v{chosenCalendarInfo.version})
                          </div>
                        )}
                        <div>
                          <span className="font-medium">Rate:</span>{" "}
                          {chosenUnit.currency} {chosenUnit.rate}
                          {cal.category === "reservations" ? " /night" : ""}
                        </div>
                        {quotedTotal !== null && (
                          <div>
                            <span className="font-medium">Total:</span>{" "}
                            {chosenUnit.currency} {quotedTotal}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          Cancellation: {cal.cancelHours}h notice, fee {cal.currency} {cal.cancelFee}
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button size="sm" onClick={handleConfirm}>Confirm</Button>
                          <Button size="sm" variant="outline" onClick={handleCancelQuote}>Cancel</Button>
                        </div>
                      </div>
                    )}

                    {/* reasons on failure */}
                    {!testResult.ok && (
                      <ul className="mt-1 list-disc pl-5 text-sm">
                        {testResult.reasons.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </SheetContent>
        </Sheet>

        <Button
          variant={isDirty ? "default" : "outline"}
          size="sm"
          onClick={onSave}
          className={isDirty ? "relative ring-2 ring-amber-400" : undefined}
        >
          {isDirty && (
            <>
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-amber-500 animate-ping" />
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-amber-500" />
            </>
          )}
          <Save className="h-4 w-4 mr-2" />
          {isDirty ? "Save changes" : "Save"}
        </Button>
      </div>
    </div>
  );
}
