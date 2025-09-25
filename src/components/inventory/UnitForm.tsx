// /components/inventory/UnitForm.tsx
// What: Right-hand editor form for a single Unit. Groups Basics, Pricing,
//       Configuration (beds & toggles), and Calendars linking UI.

"use client";

import React from "react";
import { Unit, UnitType } from "@/types/unit";
import type { CatalogRow } from "@/types/calendar";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { DatePicker } from "@/components/DatePicker";

import { Plus, Trash2, X } from "lucide-react";

type Props = {
  u: Unit;
  setU: React.Dispatch<React.SetStateAction<Unit>>;
  catalog: CatalogRow[];
  loadingCatalog: boolean;

  pickedCalendarId: string;
  setPickedCalendarId: (id: string) => void;
  pickedEffective: Date | undefined;
  setPickedEffective: (d: Date | undefined) => void;

  addCalendarLink: () => void;
  removeCalendarLink: (idx: number) => void;
};

const UNIT_TYPES: UnitType[] = [
  "guest_room",
  "suite",
  "villa",
  "cabin",
  "apartment",
  "conference_room",
];

const BED_SIZES = [
  "king",
  "queen",
  "double",
  "twin",
  "bunkbed",
  "daybed",
  "sofa_bed",
] as const;

const VIEWS = [
  "parking",
  "forest",
  "mountain",
  "stream",
  "garden",
  "city",
  "courtyard",
] as const;

export default function UnitForm({
  u, setU,
  catalog, loadingCatalog,
  pickedCalendarId, setPickedCalendarId,
  pickedEffective, setPickedEffective,
  addCalendarLink, removeCalendarLink,
}: Props) {
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

  return (
    <div className="space-y-4">
      {/* Basics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Unit ID</Label>
          <Input value={u.unit_id} onChange={(e) => setU({ ...u, unit_id: e.target.value })} className="h-9" />
        </div>
        <div>
          <Label className="text-xs">Tenant ID</Label>
          <Input value={u.tenantId} onChange={(e) => setU({ ...u, tenantId: e.target.value })} className="h-9" />
        </div>
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
              {UNIT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>
              ))}
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

      {/* Configuration */}
      <div className="space-y-3">
        <div className="font-semibold">Configuration</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Square feet</Label>
            <Input
              type="number"
              value={u.config.squareFeet ?? ""}
              onChange={(e) =>
                setU({
                  ...u,
                  config: { ...u.config, squareFeet: +e.target.value || undefined },
                })
              }
              className="h-9"
            />
          </div>
          <div>
            <Label className="text-xs">View</Label>
            <Select
              value={u.config.view ?? ""}
              onValueChange={(v: any) => setU({ ...u, config: { ...u.config, view: v } })}
            >
              <SelectTrigger className="h-9"><SelectValue placeholder="Select view" /></SelectTrigger>
              <SelectContent>
                {VIEWS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Label className="text-xs sr-only">Beds</Label>
            <Button size="sm" variant="outline" onClick={addBed}>
              <Plus className="h-4 w-4 mr-2" />
              Add bed
            </Button>
          </div>
        </div>

        {/* Beds list */}
        <div className="space-y-2">
          {(u.config.beds ?? []).map((b, i) => (
            <div key={i} className="flex items-center gap-2">
              <Select
                value={b.size}
                onValueChange={(v: any) =>
                  setU((p) => {
                    const beds = [...(p.config.beds ?? [])];
                    beds[i] = { ...beds[i], size: v };
                    return { ...p, config: { ...p.config, beds } };
                  })
                }
              >
                <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BED_SIZES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
                </SelectContent>
              </Select>

              <Input
                type="number"
                className="h-9 w-24"
                value={b.count}
                onChange={(e) =>
                  setU((p) => {
                    const beds = [...(p.config.beds ?? [])];
                    beds[i] = { ...beds[i], count: +e.target.value || 1 };
                    return { ...p, config: { ...p.config, beds } };
                  })
                }
              />
              <Button size="icon" variant="ghost" onClick={() => removeBed(i)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* Feature toggles */}
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
                onChange={(e) =>
                  setU((p) => ({
                    ...p,
                    config: { ...p.config, [key]: e.target.checked },
                  }))
                }
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
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select calendar" />
              </SelectTrigger>
              <SelectContent>
                {loadingCatalog && (
                  <div className="px-2 py-1 text-xs text-muted-foreground">Loading…</div>
                )}
                {!loadingCatalog && catalog.length === 0 && (
                  <div className="px-2 py-1 text-xs text-muted-foreground">No calendars</div>
                )}
                {!loadingCatalog &&
                  catalog.map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{c.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          v{c.version}
                          {c.active ? " • active" : ""}
                        </span>
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
          {u.calendars.length === 0 && (
            <div className="text-sm text-muted-foreground">No linked calendars</div>
          )}
          {u.calendars.map((link, i) => (
            <div
              key={`${link.calendarId}-${link.effectiveDate}-${i}`}
              className="flex items-center justify-between rounded border p-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Badge variant="outline" className="shrink-0">v{link.version}</Badge>
                <div className="truncate">
                  <div className="truncate font-medium">{link.name}</div>
                  <div className="text-xs text-muted-foreground">Effective {link.effectiveDate}</div>
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => removeCalendarLink(i)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="text-xs text-muted-foreground">
          When creating a reservation, pick the calendar whose <em>effectiveDate</em> is the latest date not after the reservation date.
        </div>
      </div>
    </div>
  );
}
