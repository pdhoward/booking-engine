// /app/inventory/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Unit, UnitType, BedSpec } from "@/types/unit";
import type { CatalogRow } from "@/types/calendar";
import { fetchAllUnits, fetchUnitById, saveUnit } from "@/lib/api/units";
import { fetchAllCalendars, fetchCalendarById } from "@/lib/api/calendars";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { Plus, Save, RefreshCcw, Database, ChevronDown, Trash2, X } from "lucide-react";

import { DatePicker } from "@/components/DatePicker";

const UNIT_TYPES: UnitType[] = ["guest_room","suite","villa","cabin","apartment","conference_room"];
const BED_SIZES = ["king","queen","double","twin","bunkbed","daybed","sofa_bed"] as const;
const VIEWS = ["parking","forest","mountain","stream","garden","city","courtyard"] as const;

function emptyUnit(): Unit {
  return {
    name: "",
    unitNumber: "",
    type: "guest_room",
    description: "",
    rate: 0,
    currency: "USD",
    config: {
      squareFeet: undefined,
      view: undefined,
      beds: [],
      shower: true,
      bathtub: false,
      hotTub: false,
      sauna: false,
      ada: false,
    },
    calendars: [],
    active: true,
  };
}

export default function InventoryPage() {
  // Left panel: units list
  const [units, setUnits] = useState<Unit[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Right panel: editor state
  const [u, setU] = useState<Unit>(emptyUnit());
  const [savedSnap, setSavedSnap] = useState<Unit | null>(null);

  // Calendars for linking
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  // New calendar link composer
  const [pickedCalendarId, setPickedCalendarId] = useState<string>("");
  const [pickedEffective, setPickedEffective] = useState<Date | undefined>(undefined);

  // Load units + calendars
  useEffect(() => {
    (async () => {
      setLoadingUnits(true);
      try {
        const list = await fetchAllUnits();
        setUnits(list);
        if (list.length) {
          setSelectedId(String(list[0]._id));
          const full = await fetchUnitById(String(list[0]._id));
          if (full) {
            setU(full);
            setSavedSnap(full);
          }
        }
      } finally {
        setLoadingUnits(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setLoadingCatalog(true);
      try {
        const rows = await fetchAllCalendars();
        setCatalog(rows);
      } finally {
        setLoadingCatalog(false);
      }
    })();
  }, []);

  const isDirty = useMemo(() => {
    if (!savedSnap) return false;
    return JSON.stringify(u) !== JSON.stringify(savedSnap);
  }, [u, savedSnap]);

  const handleSave = async () => {
    const saved = await saveUnit(u);
    setU(saved);
    setSavedSnap(saved);

    // refresh list label if it's a create
    if (!u._id) {
      const list = await fetchAllUnits();
      setUnits(list);
      setSelectedId(String(saved._id));
    } else {
      setUnits((prev) => prev.map((x) => (x._id === saved._id ? { ...x, ...saved } : x)));
    }
  };

  const handleNew = () => {
    const nu = emptyUnit();
    setU(nu);
    setSelectedId(null);
    setSavedSnap(nu);
  };

  const toYMD = (d: Date) =>
  new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    .toISOString()
    .slice(0, 10);


  const loadUnit = async (id: string) => {
    const full = await fetchUnitById(id);
    if (full) {
      setU(full);
      setSavedSnap(full);
      setSelectedId(id);
    }
  };

  const addBed = () => {
    setU((p) => ({
      ...p,
      config: { ...p.config, beds: [...(p.config.beds ?? []), { size: "queen", count: 1 }] },
    }));
  };

  const removeBed = (idx: number) => {
    setU((p) => ({
      ...p,
      config: { ...p.config, beds: (p.config.beds ?? []).filter((_, i) => i !== idx) },
    }));
  };

  const addCalendarLink = async () => {
    if (!pickedCalendarId || !pickedEffective) return;

    const cal = await fetchCalendarById(pickedCalendarId);
    if (!cal) return;

    const eff = toYMD(pickedEffective);  // ← convert Date → yyyy-mm-dd (UTC)

    setU((p) => ({
        ...p,
        calendars: [
        ...p.calendars,
        {
            calendarId: pickedCalendarId,
            name: cal.name,
            version: cal.version,
            effectiveDate: eff,
        },
        ].sort((a, b) => (a.effectiveDate < b.effectiveDate ? -1 : 1)),
    }));

    setPickedCalendarId("");
    setPickedEffective(undefined);
    };


  const removeCalendarLink = (idx: number) => {
    setU((p) => ({ ...p, calendars: p.calendars.filter((_, i) => i !== idx) }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted text-foreground">
      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold tracking-tight">Inventory</span>
            <Badge variant={u.active ? "default" : "secondary"} className="ml-2">
              {u.active ? "Active" : "Suspended"}
            </Badge>
            {u.name ? (
              <Badge className="ml-1 bg-blue-600 text-white">{u.name}{u.unitNumber ? ` #${u.unitNumber}` : ""}</Badge>
            ) : (
              <Badge className="ml-1 bg-red-600 text-white">new unit</Badge>
            )}
            {isDirty && <Badge className="ml-1 border-amber-500 text-amber-700 bg-amber-50">Unsaved</Badge>}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleNew}>
              <Plus className="h-4 w-4 mr-2" /> New
            </Button>
            <Button
              variant={isDirty ? "default" : "outline"}
              size="sm"
              onClick={handleSave}
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
      </header>

      <main className="mx-auto max-w-screen-2xl p-3 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* LEFT: Units list */}
          <Card className="lg:col-span-1">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold">Units</div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1 text-xs">
                      <Database className="h-4 w-4" /> Options <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuLabel className="text-xs">Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={async () => setUnits(await fetchAllUnits())}>
                      Refresh
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="max-h-[60vh] overflow-y-auto space-y-1 pr-1">
                {loadingUnits && <div className="text-sm text-muted-foreground">Loading…</div>}
                {!loadingUnits && units.length === 0 && (
                  <div className="text-sm text-muted-foreground">No units yet</div>
                )}
                {units.map((it) => (
                  <button
                    key={String(it._id)}
                    onClick={() => loadUnit(String(it._id))}
                    className={`w-full text-left rounded px-2 py-1 text-sm hover:bg-muted ${
                      selectedId === it._id ? "bg-muted" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate">{it.name}{it.unitNumber ? ` #${it.unitNumber}` : ""}</span>
                      <span className="text-xs text-muted-foreground">{it.type.replace("_"," ")}</span>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* RIGHT: Unit editor */}
          <Card className="lg:col-span-3">
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Name</Label>
                  <Input value={u.name} onChange={(e) => setU({ ...u, name: e.target.value })} className="h-9" />
                </div>
                <div>
                  <Label className="text-xs">Unit #</Label>
                  <Input value={u.unitNumber ?? ""} onChange={(e) => setU({ ...u, unitNumber: e.target.value })} className="h-9" />
                </div>
                <div>
                  <Label className="text-xs">Type</Label>
                  <Select value={u.type} onValueChange={(v: UnitType) => setU({ ...u, type: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UNIT_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace("_"," ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-3">
                  <Label className="text-xs">Description</Label>
                  <Textarea rows={3} value={u.description ?? ""} onChange={(e) => setU({ ...u, description: e.target.value })} />
                </div>
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Room Rate</Label>
                  <Input type="number" value={u.rate} onChange={(e) => setU({ ...u, rate: +e.target.value || 0 })} className="h-9" />
                </div>
                <div>
                  <Label className="text-xs">Currency</Label>
                  <Input value={u.currency} onChange={(e) => setU({ ...u, currency: e.target.value.toUpperCase() })} className="h-9" />
                </div>
              </div>

              {/* Config */}
              <div className="space-y-3">
                <div className="font-semibold">Configuration</div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs">Square feet</Label>
                    <Input type="number" value={u.config.squareFeet ?? ""} onChange={(e) => setU({ ...u, config: { ...u.config, squareFeet: +e.target.value || undefined } })} className="h-9" />
                  </div>
                  <div>
                    <Label className="text-xs">View</Label>
                    <Select value={u.config.view ?? ""} onValueChange={(v: any) => setU({ ...u, config: { ...u.config, view: v } })}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Select view" /></SelectTrigger>
                      <SelectContent>
                        {VIEWS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end gap-2">
                    <Label className="text-xs sr-only">Beds</Label>
                    <Button size="sm" variant="outline" onClick={addBed}><Plus className="h-4 w-4 mr-2" />Add bed</Button>
                  </div>
                </div>

                {/* Beds list */}
                <div className="space-y-2">
                  {(u.config.beds ?? []).map((b, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Select
                        value={b.size}
                        onValueChange={(v: any) => setU((p) => {
                          const beds = [...(p.config.beds ?? [])];
                          beds[i] = { ...beds[i], size: v };
                          return { ...p, config: { ...p.config, beds } };
                        })}
                      >
                        <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {BED_SIZES.map((s) => <SelectItem key={s} value={s}>{s.replace("_"," ")}</SelectItem>)}
                        </SelectContent>
                      </Select>

                      <Input
                        type="number"
                        className="h-9 w-24"
                        value={b.count}
                        onChange={(e) => setU((p) => {
                          const beds = [...(p.config.beds ?? [])];
                          beds[i] = { ...beds[i], count: +e.target.value || 1 };
                          return { ...p, config: { ...p.config, beds } };
                        })}
                      />
                      <Button size="icon" variant="ghost" onClick={() => removeBed(i)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>

                {/* Booleans */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                  {[
                    ["shower", "Shower"],
                    ["bathtub", "Bathtub"],
                    ["hotTub", "Hot tub"],
                    ["sauna", "Sauna"],
                    ["ada", "ADA"],
                  ].map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={(u.config as any)[key] ?? false}
                        onChange={(e) => setU((p) => ({ ...p, config: { ...p.config, [key]: e.target.checked } }))}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Calendars */}
              <div className="space-y-3">
                <div className="font-semibold">Calendars</div>

                {/* Add calendar link */}
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-56">
                    <Label className="text-xs">Calendar</Label>
                    <Select value={pickedCalendarId} onValueChange={setPickedCalendarId}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Select calendar" /></SelectTrigger>
                      <SelectContent>
                        {loadingCatalog && <div className="px-2 py-1 text-xs text-muted-foreground">Loading…</div>}
                        {!loadingCatalog && catalog.length === 0 && <div className="px-2 py-1 text-xs text-muted-foreground">No calendars</div>}
                        {!loadingCatalog && catalog.map((c) => (
                          <SelectItem key={c._id} value={c._id}>
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate">{c.name}</span>
                              <span className="text-xs text-muted-foreground shrink-0">v{c.version}{c.active ? " • active" : ""}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs">Effective date</Label>                   
                    <DatePicker
                        value={pickedEffective}
                        onChange={setPickedEffective}
                    />                   
                  </div>

                  <Button
                    size="sm"
                    onClick={addCalendarLink}
                    disabled={!pickedCalendarId || !pickedEffective}
                    >
                    Link
                 </Button>
                </div>

                {/* Linked calendars */}
                <div className="space-y-2">
                  {u.calendars.length === 0 && <div className="text-sm text-muted-foreground">No linked calendars</div>}
                  {u.calendars.map((link, i) => (
                    <div key={`${link.calendarId}-${link.effectiveDate}-${i}`} className="flex items-center justify-between rounded border p-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="outline" className="shrink-0">v{link.version}</Badge>
                        <div className="truncate">
                          <div className="truncate font-medium">{link.name}</div>
                          <div className="text-xs text-muted-foreground">Effective {link.effectiveDate}</div>
                        </div>
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => removeCalendarLink(i)}><X className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>

                <div className="text-xs text-muted-foreground">
                  When creating a reservation, pick the calendar whose <em>effectiveDate</em> is the latest date not after the reservation date.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
