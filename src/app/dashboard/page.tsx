"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

// Icons
import { Calendar as CalendarIcon, Plus, Save, X, Wand2, MinusCircle, Settings2, Lock, LockOpen, TestTube2, Sun, Moon, RefreshCcw, Database, Clock, Ban, ListChecks, DollarSign, RotateCcw, UploadCloud, DownloadCloud, ChevronDown, Eye, Waypoints, Layers, Sparkles, Power, BookCheck } from "lucide-react";

// FullCalendar
import { Calendar as FC_Calendar, type EventInput } from "@fullcalendar/core";
import rrulePlugin from "@fullcalendar/rrule";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import multiMonthPlugin from "@fullcalendar/multimonth";

import { RRule, Weekday, Options } from "rrule";

// Local utils (adapted from your codebase)
import { toISODate, expandDateRange, isIsoDate, unique, weekdayChoice } from "@/lib/utils";

// ---- Types ----
export type CalendarCategory = "reservations" | "appointments"; 
export type CatalogRow = { _id: string; name: string; version: number; active: boolean };


interface HolidayRule { date: string; minNights: number }
interface SeasonRule { start: string; end: string; price: number }
interface LeadTimeRule { minDays: number; maxDays: number }

interface CalendarMeta {
  _id?: string;
  name: string;
  owner: string;
  category: CalendarCategory; // maps to old type
  currency: string;
  cancelHours: number;
  cancelFee: number;
  version: number; // auto increment per name
  active: boolean; // active code
}

interface CalendarState extends CalendarMeta {
  blackouts: string[]; // ISO dates
  recurringBlackouts?: string; // RRULE string
  holidays: HolidayRule[];
  minStayByWeekday: Record<string, number>; // Su..Sa -> nights
  seasons: SeasonRule[];
  leadTime: LeadTimeRule;
  rulesJson: string; // raw engine rules JSON
}
// ---- Small helpers ----
const API_BASE = "/api/calendars";

function ymd(d: any): string {
  // normalize to 'yyyy-mm-dd'
  const iso = typeof d === "string" ? d : new Date(d).toISOString();
  return iso.slice(0, 10);
}

function safeParseRules(json: string): any[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : v ? [v] : [];
  } catch {
    return [];
  }
}

function normalizeCalendar(doc: any): CalendarState {
  return {
    _id: String(doc._id),
    name: doc.name ?? "",
    owner: doc.owner ?? "",
    category: (doc.category ?? "reservations") as CalendarCategory,
    currency: doc.currency ?? "USD",
    cancelHours: Number(doc.cancelHours ?? doc.cancellationPolicy?.hours ?? 48),
    cancelFee: Number(doc.cancelFee ?? doc.cancellationPolicy?.fee ?? 0),
    version: Number(doc.version ?? 1),
    active: Boolean(doc.active ?? true),
    blackouts: (doc.blackouts ?? []).map(ymd),
    recurringBlackouts: doc.recurringBlackouts || undefined,
    holidays: (doc.holidays ?? []).map((h: any) => ({
      date: ymd(h.date),
      minNights: Number(h.minNights ?? 1),
    })),
    minStayByWeekday: doc.minStayByWeekday ?? {},
    seasons: (doc.seasons ?? []).map((s: any) => ({
      start: ymd(s.start),
      end: ymd(s.end),
      price: Number(s.price ?? 0),
    })),
    leadTime: doc.leadTime ?? { minDays: 0, maxDays: 365 },
    // Store rules array (if any) in your text area as pretty JSON
    rulesJson: JSON.stringify(doc.rules ?? [], null, 2),
  };
}

// ---- Real API-backed helpers ----

// Compact list for the dropdown
async function fetchAllCalendars(): Promise<CatalogRow[]> {
  const res = await fetch(`${API_BASE}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load calendars");
  const data = await res.json();
  // server already returns compact rows; coerce types defensively
  return (data as any[]).map((d) => ({
    _id: String(d._id),
    name: String(d.name),
    version: Number(d.version ?? 1),
    active: Boolean(d.active),
  }));
}

// Full calendar by id
async function fetchCalendarById(id: string): Promise<CalendarState | null> {
  const res = await fetch(`${API_BASE}/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load calendar");
  const doc = await res.json();
  return normalizeCalendar(doc);
}

// Save: POST (new version) or PATCH (edit existing)
async function saveCalendar(
  payload: CalendarState,
  opts?: { mode?: "version" | "overwrite" } // optional toggle if you expose it in UI
): Promise<{ id: string; doc: CalendarState }> {
  const { _id, rulesJson, ...rest } = payload;

  // Map back to API shape (dates as strings are OK; mongoose will coerce)
  const body = {
    ...rest,
    blackouts: rest.blackouts.map(ymd),
    recurringBlackouts: rest.recurringBlackouts || undefined,
    holidays: rest.holidays.map((h) => ({ date: ymd(h.date), minNights: h.minNights })),
    seasons: rest.seasons.map((s) => ({ start: ymd(s.start), end: ymd(s.end), price: s.price })),
    rules: safeParseRules(rulesJson),
    ...(opts?.mode ? { mode: opts.mode } : {}),
  };

  let res: Response;
  if (_id) {
    // Editing this specific version
    res = await fetch(`${API_BASE}/${_id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } else {
    // Creating a new version of this name
    res = await fetch(`${API_BASE}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body), // default mode=version on server
    });
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || "Save failed");
  }

  const saved = await res.json();
  return { id: String(saved._id), doc: normalizeCalendar(saved) };
}
// ---- Booking Test Engine (client-side demo evaluator) ----
function evaluateBookingRequest(
  cal: CalendarState,
  req: { start: string; end?: string; mode: CalendarCategory }
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const today = new Date();
  const start = new Date(req.start);
  const end = req.end ? new Date(req.end) : new Date(req.start);

  // Lead-time rule
  const diffDays = Math.ceil((start.getTime() - today.getTime()) / 86400000);
  if (diffDays < cal.leadTime.minDays) reasons.push(`Too soon. Requires at least ${cal.leadTime.minDays} days lead time.`);
  if (diffDays > cal.leadTime.maxDays) reasons.push(`Too far out. Max advance is ${cal.leadTime.maxDays} days.`);

  // Blackouts
  const requestedDates = expandDateRange(toISODate(start)!, toISODate(end)!);
  const blackoutSet = new Set(cal.blackouts);
  for (const d of requestedDates) {
    if (blackoutSet.has(d)) {
      reasons.push(`Date ${d} is blacked out.`);
    }
  }

  // Holidays (min nights)
  const nights = Math.max(1, requestedDates.length - 1);
  for (const h of cal.holidays) {
    if (requestedDates.includes(h.date) && nights < h.minNights) {
      reasons.push(`Holiday ${h.date} requires minimum ${h.minNights} nights.`);
    }
  }

  // Weekday minimum stay (reservations only)
  if (req.mode === "reservations") {
    const weekday = start.toLocaleDateString(undefined, { weekday: "short" });
    const minStay = cal.minStayByWeekday[weekday] || 1;
    if (nights < minStay) reasons.push(`Min stay from ${weekday} is ${minStay} nights.`);
  }

  return { ok: reasons.length === 0, reasons };
}

// ---- Page Component ----
export default function BookingEnginePage() {
  const router = useRouter();

  // Existing calendars (for the second dropdown)
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  // Working calendar state (new by default)
  const [cal, setCal] = useState<CalendarState>(() => ({
    name: "",
    owner: "",
    category: "reservations",
    currency: "USD",
    cancelHours: 48,
    cancelFee: 0,
    version: 1,
    active: true,
    blackouts: [],
    holidays: [],
    minStayByWeekday: {},
    seasons: [],
    leadTime: { minDays: 0, maxDays: 365 },
    rulesJson: "[]",
  }));

  // Calendar UI state
  const [view, setView] = useState<"dayGridMonth" | "timeGridWeek" | "timeGridDay" | "multiMonthYear">("dayGridMonth");
  const [addMode, setAddMode] = useState<"cursor" | "blackout" | "holiday">("cursor");
  const calendarHostRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<FC_Calendar | null>(null);

  // RRULE builder state
  const [rrWeekdays, setRrWeekdays] = useState<Weekday[]>([]);
  const [rrStart, setRrStart] = useState<string>("");

  // Booking test drawer
  const [testOpen, setTestOpen] = useState(false);
  const [testStart, setTestStart] = useState<string>("");
  const [testEnd, setTestEnd] = useState<string>("");
  const [testResult, setTestResult] = useState<{ ok: boolean; reasons: string[] } | null>(null);

  // Load catalog on mount
  useEffect(() => {
    (async () => {
      setLoadingCatalog(true);
      try {
        const rows = await fetchAllCalendars();
        // Sort active first, newest version first by name grouping (optional)
        setCatalog(rows.filter(r => typeof r._id === "string" && r._id.length > 0));
      } finally {
        setLoadingCatalog(false);
      }
    })();
  }, []);

  // Build FullCalendar events
  // refactor to add appointments and reservations
const events: EventInput[] = useMemo(() => {
  const isBgOnly = view === "dayGridMonth" || view === "multiMonthYear";

  const blackoutEvents = cal.blackouts.map((iso) => ({
    id: `blackout-${iso}`,
    start: iso,
    allDay: true,
    display: "background",
    color: "#5b5b5b55",
    title: "Blackout",
  }));

  // holiday event renders as baclground

  // const holidayEvents = cal.holidays.map((h) => ({
  //   id: `holiday-${h.date}`,
  //   start: h.date,
  //   allDay: true,
  //   ...(isBgOnly
  //     ? { display: "background" } // month/multi-month -> no foreground chip
  //     : { title: `Holiday (min ${h.minNights})` } // week/day -> show label
  //   ),
  //   color: "#f59e0b",
  // }));

  // ✅ holidays render as foreground pills with text
  const holidayEvents = cal.holidays.map((h) => ({
    id: `holiday-${h.date}`,
    start: h.date,
    allDay: true,
    display: "block",                 // <-- force foreground, not background
    title: `Holiday (min ${h.minNights})`,
    classNames: ["fc-holiday-pill"],  // for custom styling
    
  }));


  const rruleEvent = cal.recurringBlackouts
    ? [{
        id: "recurring-blackout",
        rrule: cal.recurringBlackouts,
        duration: { days: 1 },
        display: "background",
        color: "#3f3f3f55",
        title: "Recurring Blackout",
      }]
    : [];

  return [...blackoutEvents, ...holidayEvents, ...rruleEvent];
}, [cal.blackouts, cal.holidays, cal.recurringBlackouts, view]); // ✅ include `view`


// ✅ Init/update FullCalendar — rewire handlers whenever addMode changes
// 1) Create once / destroy on unmount
useEffect(() => {
  if (!calendarHostRef.current || calendarRef.current) return;

  const cal = new FC_Calendar(calendarHostRef.current, {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin, rrulePlugin, multiMonthPlugin],
    initialView: view,
    contentHeight: "auto",              // ✅ stable grid height
    headerToolbar: { left: "prev,next today", center: "title", right: "" },
    selectable: addMode !== "cursor",   // initial; will be kept in sync below
    events,                             // initial; will be kept in sync below
    themeSystem: "standard",            // ✅ keeps the standard theme consistent
    dayMaxEvents: true,                 // ✅ prevents overcrowding from distorting rows when events render
    expandRows: true,                   // ✅ keeps month grid height consistent   
    fixedWeekCount: true,               // always 6 weeks in month view (prevents jumpy grids) 
    selectMirror: true,                 // ✅ better UX + fewer accidental drags on touchpads
    longPressDelay: 180,
    selectMinDistance: 8,
  });

  cal.render();
  calendarRef.current = cal;

  return () => {
    cal.destroy();
    calendarRef.current = null;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

// 2) Keep events/view/mode in sync + rebind handlers (batched)
useEffect(() => {
  const cal = calendarRef.current;
  if (!cal) return;

  cal.batchRendering(() => {
    // keep data + view in sync
    cal.setOption("events", events);
    if (cal.view.type !== view) cal.changeView(view);

    // toggle selection based on mode
    cal.setOption("selectable", addMode !== "cursor");

    // rebind handlers so they capture latest addMode
    cal.setOption("select", (info: any) => {
      const start = toISODate(info.start);
      const end = toISODate(new Date(info.end.getTime() - 86400000));
      if (!start || !end) return;

      if (addMode === "blackout") {
        setCal((p) => ({ ...p, blackouts: unique([...p.blackouts, ...expandDateRange(start, end)]) }));
      } 

      if (addMode === "holiday") {
        setCal(p => {
          const seen = new Set(p.holidays.map(h => ymd(h.date)));
          const toAdd = expandDateRange(start, end)
            .filter(d => !seen.has(d))
            .map(d => ({ date: d, minNights: 1 }));
          return { ...p, holidays: [...p.holidays, ...toAdd] };
        });
      }

    });

    cal.setOption("dateClick", (info: any) => {
      const iso = toISODate(info.date);
      if (!iso) return;

      if (addMode === "blackout") {
        setCal((p) => ({ ...p, blackouts: unique([...p.blackouts, iso]) }));
      } 

      if (addMode === "holiday") {
        setCal(p => {
          if (p.holidays.some(h => ymd(h.date) === iso)) return p; // already there
          return { ...p, holidays: [...p.holidays, { date: iso, minNights: 1 }] };
        });
      }
    });

    cal.setOption("eventClick", (info: any) => {
      if (addMode === "cursor") return;

      if (info.event.id?.startsWith("blackout-")) {
        const d = info.event.id.replace("blackout-", "");
        setCal((p) => ({ ...p, blackouts: p.blackouts.filter((x) => x !== d) }));
      } else if (info.event.id?.startsWith("holiday-")) {
        const d = info.event.id.replace("holiday-", "");
        setCal((p) => ({ ...p, holidays: p.holidays.filter((x) => x.date !== d) }));
      } else if (info.event.id === "recurring-blackout") {
        setCal((p) => ({ ...p, recurringBlackouts: undefined }));
      }
    });
  });
  // ensure FC re-measures once after updates (prevents grid jump)
  // function on the Browser being executed
  requestAnimationFrame(() => cal.updateSize()); // ✅ ensure gridlines re-measure post-DOM change
}, [events, view, addMode, setCal]); // 👈 ensure addMode is a dep so handlers rebind

  // RRULE helper
  const buildRRULE = () => {
    try {
      const opts: Partial<Options> = { freq: RRule.WEEKLY };
      if (rrWeekdays.length) opts.byweekday = rrWeekdays;
      if (rrStart && isIsoDate(rrStart)) opts.dtstart = new Date(rrStart);
      const rule = new RRule(opts);
      setCal((p) => ({ ...p, recurringBlackouts: rule.toString() }));
    } catch (e) {
      // noop
    }
  };

  // ✅ CHANGED: use saved doc from server so state snapshot reflects Mongo
  const handleSave = async () => {
    const payload = { ...cal };
    const { id, doc } = await saveCalendar(payload); // uses helper
    setCal({ ...doc, _id: id });                     // keep server truth in UI
    router.refresh?.();
  };

  const resetToNew = () => {
    setCal({
      name: "",
      owner: "",
      category: "reservations",
      currency: "USD",
      cancelHours: 48,
      cancelFee: 0,
      version: 1,
      active: true,
      blackouts: [],
      holidays: [],
      minStayByWeekday: {},
      seasons: [],
      leadTime: { minDays: 0, maxDays: 365 },
      rulesJson: "[]",
    });
  };

  // Derived chips
  const chips = useMemo(() => {
    const out: React.ReactNode[] = [];
    if (cal.blackouts.length) out.push(<Badge key="b" variant="secondary">{cal.blackouts.length} blackouts</Badge>);
    if (cal.holidays.length) out.push(<Badge key="h" variant="secondary">{cal.holidays.length} holidays</Badge>);
    if (cal.recurringBlackouts) out.push(<Badge key="r" variant="secondary">recurring rule</Badge>);
    if (Object.keys(cal.minStayByWeekday).length) out.push(<Badge key="m" variant="secondary">weekday min-stay</Badge>);
    if (cal.seasons.length) out.push(<Badge key="s" variant="secondary">{cal.seasons.length} seasonal bands</Badge>);
    if (cal.leadTime.minDays || cal.leadTime.maxDays < 365) out.push(<Badge key="l" variant="secondary">lead-time</Badge>);
    return out;
  }, [cal]);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted text-foreground">
        {/* NAVBAR */}
        <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-3">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              <span className="font-semibold tracking-tight">Booking Engine</span>
              <Badge variant={cal.active ? "default" : "secondary"} className="ml-2">{cal.active ? "Active" : "Suspended"}</Badge>
              {/* ✅ visual cue for the selected calendar */}
              {cal.name && (
                <Badge
                  className={`ml-1 ${cal.category === "reservations" ? "bg-blue-600" : "bg-green-600"} text-white`}
                >
                  {cal.name} • v{cal.version}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* NEW / EDIT METADATA DROPDOWN (compact) */}
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
                      <Input value={cal.name} onChange={(e) => setCal({ ...cal, name: e.target.value })} placeholder="e.g. Cypress Main" className="h-8" />
                    </div>
                    <div>
                      <Label className="text-xs">Category</Label>
                      <Select value={cal.category} onValueChange={(v: CalendarCategory) => setCal({ ...cal, category: v })}>
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
                      <Input value={cal.currency} onChange={(e) => setCal({ ...cal, currency: e.target.value.toUpperCase() })} className="h-8" />
                    </div>
                    <div>
                      <Label className="text-xs">Cancel Notice (hrs)</Label>
                      <Input type="number" value={cal.cancelHours} onChange={(e) => setCal({ ...cal, cancelHours: +e.target.value || 0 })} className="h-8" />
                    </div>
                    <div>
                      <Label className="text-xs">Cancel Fee</Label>
                      <Input type="number" value={cal.cancelFee} onChange={(e) => setCal({ ...cal, cancelFee: +e.target.value || 0 })} className="h-8" />
                    </div>
                    <div className="flex items-center justify-between col-span-2 mt-2">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">Active</Label>
                        <Switch checked={cal.active} onCheckedChange={(v: any) => setCal({ ...cal, active: v })} />
                      </div>
                      <Button size="sm" onClick={handleSave}><Save className="mr-2 h-4 w-4"/>Save</Button>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[10px] text-muted-foreground mt-1">Unique key = (name, version). Creating a new version with the same name increments version.</p>
                    </div>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* EXISTING CALENDAR PICKER */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1 text-xs">
                    <Database className="h-4 w-4" /> Calendars <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[320px]" align="end">
                  <DropdownMenuLabel className="text-xs">Select to Edit</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {loadingCatalog && <DropdownMenuItem disabled>Loading…</DropdownMenuItem>}
                  {!loadingCatalog && catalog.length === 0 && <DropdownMenuItem disabled>No calendars</DropdownMenuItem>}
                  {!loadingCatalog && catalog.map((c) => (
                    <DropdownMenuItem key={c._id} onClick={async () => {
                      const full = await fetchCalendarById(c._id);
                      if (full) setCal(full);
                    }} className="justify-between">
                      <span>{c.name}</span>
                      <span className="text-xs text-muted-foreground">v{c.version}{c.active ? " • active" : ""}</span>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={resetToNew}><RefreshCcw className="h-3 w-3 mr-2"/>New Calendar</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* ACTION ICONS */}
              <div className="hidden md:flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant={addMode === "cursor" ? "default" : "ghost"} size="icon" onClick={() => setAddMode("cursor")}><Eye className="h-4 w-4"/></Button>
                  </TooltipTrigger>
                  <TooltipContent>Cursor</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant={addMode === "blackout" ? "default" : "ghost"} size="icon" onClick={() => setAddMode(addMode === "blackout" ? "cursor" : "blackout")}><Ban className="h-4 w-4"/></Button>
                  </TooltipTrigger>
                  <TooltipContent>Blackout Mode</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant={addMode === "holiday" ? "default" : "ghost"} size="icon" onClick={() => setAddMode(addMode === "holiday" ? "cursor" : "holiday")}><Sparkles className="h-4 w-4"/></Button>
                  </TooltipTrigger>
                  <TooltipContent>Holiday Mode</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => setCal((p) => ({ ...p, active: !p.active }))}>{cal.active ? <Power className="h-4 w-4"/> : <Lock className="h-4 w-4"/>}</Button>
                  </TooltipTrigger>
                  <TooltipContent>{cal.active ? "Suspend" : "Activate"}</TooltipContent>
                </Tooltip>

                {/* View switcher */}
                <Select value={view} onValueChange={(v: any) => setView(v)}>
                  <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dayGridMonth">Month</SelectItem>
                    <SelectItem value="timeGridWeek">Week</SelectItem>
                    <SelectItem value="timeGridDay">Day</SelectItem>
                    <SelectItem value="multiMonthYear">Year</SelectItem>
                  </SelectContent>
                </Select>

                {/* Booking Test Widget */}
                <Sheet open={testOpen} onOpenChange={setTestOpen}>
                  <SheetTrigger asChild>
                    <Button variant="default" size="sm" className="ml-2 gap-1"><TestTube2 className="h-4 w-4"/> Test</Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[360px]">
                    <SheetHeader><SheetTitle>Test Booking</SheetTitle></SheetHeader>
                    <div className="mt-4 space-y-3">
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
                        <Input value={testStart} onChange={(e) => setTestStart(e.target.value)} placeholder="2025-09-15" className="h-8"/>
                      </div>
                      {cal.category === "reservations" && (
                        <div>
                          <Label className="text-xs">End (yyyy-mm-dd)</Label>
                          <Input value={testEnd} onChange={(e) => setTestEnd(e.target.value)} placeholder="2025-09-18" className="h-8"/>
                        </div>
                      )}
                      <Button onClick={() => {
                        if (!isIsoDate(testStart)) { setTestResult({ ok: false, reasons: ["Start date invalid."] }); return; }
                        if (cal.category === "reservations" && testEnd && !isIsoDate(testEnd)) { setTestResult({ ok: false, reasons: ["End date invalid."] }); return; }
                        const res = evaluateBookingRequest(cal, { start: testStart, end: cal.category === "reservations" ? (testEnd || testStart) : undefined, mode: cal.category });
                        setTestResult(res);
                      }} className="w-full">Submit</Button>
                      {testResult && (
                        <Card>
                          <CardContent className="pt-4">
                            <div className={`font-medium ${testResult.ok ? "text-green-600" : "text-red-600"}`}>{testResult.ok ? "Approved" : "Rejected"}</div>
                            {!testResult.ok && (
                              <ul className="mt-2 list-disc pl-5 text-sm">
                                {testResult.reasons.map((r, i) => <li key={i}>{r}</li>)}
                              </ul>
                            )}
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </SheetContent>
                </Sheet>

                <Button variant="outline" size="sm" onClick={handleSave}><Save className="h-4 w-4 mr-2"/>Save</Button>
              </div>
            </div>
          </div>
        </header>

        {/* BODY */}
        <main className="mx-auto max-w-screen-2xl p-3 md:p-6">
          {/* Summary chips + quick tools */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {chips}
            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setCal((p) => ({ ...p, blackouts: [], holidays: [], recurringBlackouts: undefined }))}><RotateCcw className="h-4 w-4 mr-2"/>Clear</Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm"><ListChecks className="h-4 w-4 mr-2"/>Rules JSON</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[720px]">
                  <DialogHeader><DialogTitle>Engine Rules JSON</DialogTitle></DialogHeader>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                    <div>
                      <Label className="text-xs">Paste/Edit</Label>
                      <Textarea value={cal.rulesJson} onChange={(e) => setCal({ ...cal, rulesJson: e.target.value })} rows={16}/>
                    </div>
                    <div>
                      <Label className="text-xs">State Snapshot</Label>
                      <pre className="text-xs bg-muted p-3 rounded h-[360px] overflow-auto">{JSON.stringify({ blackouts: cal.blackouts, holidays: cal.holidays, recurringBlackouts: cal.recurringBlackouts, minStayByWeekday: cal.minStayByWeekday, seasons: cal.seasons, leadTime: cal.leadTime }, null, 2)}</pre>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Main calendar + side settings */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <Card className="lg:col-span-3">
              <CardContent className="p-2 md:p-4">
                {/* ✅ cursor style change so it feels “in edit mode” */}               
                <div className={addMode !== "cursor" ? "cursor-crosshair" : "cursor-auto"}>
                  <div
                    ref={calendarHostRef}
                    className="w-full border rounded-md p-2 bg-background"  // ✅ host stays constant
                  />
                </div>               
              </CardContent>
            </Card>

            {/* Right Rail Tools */}
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <div className="font-semibold">Recurring Blackouts</div>
                  <Input value={cal.recurringBlackouts || ""} onChange={(e) => setCal((p) => ({ ...p, recurringBlackouts: e.target.value || undefined }))} placeholder="FREQ=WEEKLY;BYDAY=SU" className="h-9"/>
                  <div className="text-xs text-muted-foreground">Builder</div>
                  <div className="flex flex-wrap gap-1">
                    {weekdayChoice.map((w) => (
                      <Button key={w.label} variant={rrWeekdays.includes(w.value) ? "default" : "outline"} size="sm" className="h-7 px-2"
                        onClick={() => setRrWeekdays((prev) => prev.includes(w.value) ? prev.filter((x) => x !== w.value) : [...prev, w.value])}>{w.label}
                      </Button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input placeholder="Start yyyy-mm-dd" value={rrStart} onChange={(e) => setRrStart(e.target.value)} className="h-8"/>
                    <Button size="sm" onClick={buildRRULE}>Build</Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4 space-y-2">
                  <div className="font-semibold">Minimum Stay by Weekday</div>
                  <div className="flex flex-wrap gap-2">
                    {weekdayChoice.map((w) => (
                      <div key={w.label} className="flex items-center gap-1">
                        <span className="text-xs w-6">{w.label}</span>
                        <Input type="number" value={cal.minStayByWeekday[w.label] || 1} onChange={(e) => setCal((p) => ({ ...p, minStayByWeekday: { ...p.minStayByWeekday, [w.label]: +e.target.value || 1 } }))} className="w-14 h-7 text-xs"/>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4 space-y-2">
                  <div className="font-semibold">Seasonal Price Bands</div>
                  <div className="space-y-2">
                    {cal.seasons.map((s, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input value={s.start} onChange={(e) => setCal((p) => ({ ...p, seasons: p.seasons.map((x, j) => j === i ? { ...x, start: e.target.value } : x) }))} placeholder="start yyyy-mm-dd" className="h-8"/>
                        <Input value={s.end} onChange={(e) => setCal((p) => ({ ...p, seasons: p.seasons.map((x, j) => j === i ? { ...x, end: e.target.value } : x) }))} placeholder="end yyyy-mm-dd" className="h-8"/>
                        <Input type="number" value={s.price} onChange={(e) => setCal((p) => ({ ...p, seasons: p.seasons.map((x, j) => j === i ? { ...x, price: +e.target.value || 0 } : x) }))} placeholder="$" className="h-8 w-24"/>
                        <Button variant="ghost" size="icon" onClick={() => setCal((p) => ({ ...p, seasons: p.seasons.filter((_, j) => j !== i) }))}><X className="h-4 w-4"/></Button>
                      </div>
                    ))}
                  </div>
                  <Button size="sm" onClick={() => setCal((p) => ({ ...p, seasons: [...p.seasons, { start: toISODate(new Date())!, end: toISODate(new Date())!, price: 100 }] }))}>+ Add Band</Button>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4 space-y-2">
                  <div className="font-semibold">Lead-Time Restrictions</div>
                  <div className="flex gap-2">
                    <Input type="number" value={cal.leadTime.minDays} onChange={(e) => setCal((p) => ({ ...p, leadTime: { ...p.leadTime, minDays: +e.target.value || 0 } }))} placeholder="Min days" className="w-28 h-8"/>
                    <Input type="number" value={cal.leadTime.maxDays} onChange={(e) => setCal((p) => ({ ...p, leadTime: { ...p.leadTime, maxDays: +e.target.value || 0 } }))} placeholder="Max days" className="w-28 h-8"/>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4 space-y-2">
                  <div className="font-semibold">Blackouts & Holidays</div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Blackouts</div>
                    <ul className="max-h-[120px] overflow-y-auto text-sm space-y-1">
                      {cal.blackouts.map((d) => (
                        <li key={d} className="flex justify-between items-center">
                          {d}
                          <Button variant="ghost" size="icon" onClick={() => setCal((p) => ({ ...p, blackouts: p.blackouts.filter((x) => x !== d) }))}><MinusCircle className="h-4 w-4"/></Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Holidays</div>
                    <ul className="max-h-[120px] overflow-y-auto text-sm space-y-1">
                      {cal.holidays.map((h, i) => (
                        <li key={`${h.date}-${i}`} className="flex items-center gap-2">
                          <span className="w-28">{h.date}</span>
                          <Input type="number" value={h.minNights} onChange={(e) => setCal((p) => ({ ...p, holidays: p.holidays.map((x) => x.date === h.date ? { ...x, minNights: +e.target.value || 1 } : x) }))} className="h-7 w-24 text-xs"/>
                          <Button variant="ghost" size="icon" onClick={() => setCal((p) => ({ ...p, holidays: p.holidays.filter((x) => x.date !== h.date) }))}><MinusCircle className="h-4 w-4"/></Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>

        {/* FOOTER */}
        <footer className="mx-auto max-w-screen-2xl px-3 md:px-6 pb-8 pt-2 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>© {new Date().getFullYear()} Strategic Machines Booking Engine</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(JSON.stringify(cal, null, 2))}><UploadCloud className="h-4 w-4 mr-2"/>Copy JSON</Button>
              <Button variant="outline" size="sm" onClick={resetToNew}><RotateCcw className="h-4 w-4 mr-2"/>Reset</Button>
            </div>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  );
}
