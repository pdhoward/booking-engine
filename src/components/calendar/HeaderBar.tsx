"use client";

// What: Top navbar actions (meta dropdown, calendar picker, mode toggles,
//       view switch, test sheet, save). Shows active name/version badge.

import React, { useState } from "react";
import { CalendarState, CalendarCategory, CatalogRow } from "@/types/calendar";
import { evaluateBookingRequest } from "@/lib/engine/evaluateBooking";
import { fetchCalendarById } from "@/lib/api/calendars";

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
};

export default function HeaderBar({
  cal, setCal, addMode, setAddMode, view, setView, catalog, loadingCatalog, onSave, onReset
}: Props) {
  // Local state for test drawer
  const [testOpen, setTestOpen] = useState(false);
  const [testStart, setTestStart] = useState("");
  const [testEnd, setTestEnd] = useState("");
  const [testResult, setTestResult] = useState<{ ok: boolean; reasons: string[] } | null>(null);

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
      </div>

      <div className="flex items-center gap-2">
        {/* Meta dropdown (name/owner/etc.) */}
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

        {/* Existing calendars dropdown (scrollable list, active-first, show version + state) */}
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
                      Number(b.active) - Number(a.active) || // active first
                      b.version - a.version ||               // newest version
                      a.name.localeCompare(b.name)           // then by name
                  )
                  .map((c) => (
                    <DropdownMenuItem
                      key={c._id}
                      onClick={async () => {
                        const full = await fetchCalendarById(c._id);
                        if (full) setCal(full);
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
            <Button variant={addMode === "cursor" ? "default" : "ghost"} size="icon" onClick={() => setAddMode("cursor")}><Eye className="h-4 w-4" /></Button>
          </TooltipTrigger>
          <TooltipContent>Cursor</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant={addMode === "blackout" ? "default" : "ghost"} size="icon" onClick={() => setAddMode(addMode === "blackout" ? "cursor" : "blackout")}><Ban className="h-4 w-4" /></Button>
          </TooltipTrigger>
          <TooltipContent>Blackout Mode</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant={addMode === "holiday" ? "default" : "ghost"} size="icon" onClick={() => setAddMode(addMode === "holiday" ? "cursor" : "holiday")}><Sparkles className="h-4 w-4" /></Button>
          </TooltipTrigger>
          <TooltipContent>Holiday Mode</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={() => setCal((p) => ({ ...p, active: !p.active }))}>
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

        {/* Test Sheet */}
        <Sheet open={testOpen} onOpenChange={setTestOpen}>
          <SheetTrigger asChild>
            <Button variant="default" size="sm" className="ml-2 gap-1"><TestTube2 className="h-4 w-4" /> Test</Button>
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
                <Input value={testStart} onChange={(e) => setTestStart(e.target.value)} placeholder="2025-09-15" className="h-8" />
              </div>
              {cal.category === "reservations" && (
                <div>
                  <Label className="text-xs">End (yyyy-mm-dd)</Label>
                  <Input value={testEnd} onChange={(e) => setTestEnd(e.target.value)} placeholder="2025-09-18" className="h-8" />
                </div>
              )}
              <Button
                onClick={() => {
                  const end = cal.category === "reservations" ? (testEnd || testStart) : undefined;
                  const res = evaluateBookingRequest(cal, { start: testStart, end, mode: cal.category });
                  setTestResult(res);
                }}
                className="w-full"
              >
                Submit
              </Button>
              {testResult && (
                <Card>
                  <CardContent className="pt-4">
                    <div className={`font-medium ${testResult.ok ? "text-green-600" : "text-red-600"}`}>
                      {testResult.ok ? "Approved" : "Rejected"}
                    </div>
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

        <Button variant="outline" size="sm" onClick={onSave}><Save className="h-4 w-4 mr-2" />Save</Button>
      </div>
    </div>
  );
}
