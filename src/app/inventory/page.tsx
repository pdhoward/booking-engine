// /app/inventory/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Unit } from "@/types/unit";
import type { CatalogRow } from "@/types/calendar";
import { fetchAllUnits, fetchUnitById, saveUnit } from "@/lib/api/units";
import { fetchAllCalendars, fetchCalendarById } from "@/lib/api/calendars";

import { Card, CardContent } from "@/components/ui/card";

import InventoryHeaderBar from "@/components/inventory/InventoryHeaderBar";
import UnitsList from "@/components/inventory/UnitsList";
import UnitForm from "@/components/inventory/UnitForm";

function emptyUnit(): Unit {
  return {
    unit_id: "",
    tenantId: "",
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

const toYMD = (d: Date) =>
  new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    .toISOString()
    .slice(0, 10);

export default function InventoryPage() {
  // Left panel: units list
  const [units, setUnits] = useState<Unit[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Right panel: editor state
  const [u, setU] = useState<Unit>(emptyUnit());
  const [savedSnap, setSavedSnap] = useState<Unit | null>(null);

  // Calendars catalog for linking
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  // New calendar link composer
  const [pickedCalendarId, setPickedCalendarId] = useState<string>("");
  const [pickedEffective, setPickedEffective] = useState<Date | undefined>(undefined);

  // Load units on mount
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

  // Load calendars on mount
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

  const loadUnit = async (id: string) => {
    const full = await fetchUnitById(id);
    if (full) {
      setU(full);
      setSavedSnap(full);
      setSelectedId(id);
    }
  };

  // Calendars: link/unlink handlers
  const addCalendarLink = async () => {
    if (!pickedCalendarId || !pickedEffective) return;

    const cal = await fetchCalendarById(pickedCalendarId);
    if (!cal) return;

    const eff = toYMD(pickedEffective); // Date → yyyy-mm-dd (UTC)
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

  const refreshUnits = async () => setUnits(await fetchAllUnits());

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted text-foreground">
      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <InventoryHeaderBar
          u={u}
          isDirty={isDirty}
          onNew={handleNew}
          onSave={handleSave}
        />
      </header>

      <main className="mx-auto max-w-screen-2xl p-3 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* LEFT: Units list */}
          <Card className="lg:col-span-1">
            <CardContent className="p-3">
              <UnitsList
                units={units}
                loading={loadingUnits}
                selectedId={selectedId}
                onSelect={(id) => loadUnit(id)}
                onRefresh={refreshUnits}
              />
            </CardContent>
          </Card>

          {/* RIGHT: Unit editor */}
          <Card className="lg:col-span-3">
            <CardContent className="p-4">
              <UnitForm
                u={u}
                setU={setU}
                catalog={catalog}
                loadingCatalog={loadingCatalog}
                pickedCalendarId={pickedCalendarId}
                setPickedCalendarId={setPickedCalendarId}
                pickedEffective={pickedEffective}
                setPickedEffective={setPickedEffective}
                addCalendarLink={addCalendarLink}
                removeCalendarLink={removeCalendarLink}
              />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
