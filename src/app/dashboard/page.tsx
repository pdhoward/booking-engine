// app/dashboard/page.tsx
"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";

import HeaderBar from "@/components/calendar/HeaderBar";
import CalendarGrid from "@/components/calendar/CalendarGrid";
import RightRail from "@/components/calendar/RightRail";
import SummaryBar from "@/components/calendar/SummaryBar";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadCloud, RotateCcw } from "lucide-react";

import type { CalendarState, CatalogRow } from "@/types/calendar";
import { fetchAllCalendars, saveCalendar } from "@/lib/api/calendars";
import {
  normalizeCalendarFromServer,
  denormalizeCalendarForServer,
} from "@/lib/calendar/normalize";

export default function BookingEnginePage() {
  const router = useRouter();

  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

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
    recurringBlackouts: null,
    holidays: [],
    minStayByWeekday: {},
    seasons: [],
    leadTime: { minDays: 0, maxDays: 365 },
    rules: [],
  }));

  const [view, setView] = useState<
    "dayGridMonth" | "timeGridWeek" | "timeGridDay" | "multiMonthYear"
  >("dayGridMonth");
  const [addMode, setAddMode] = useState<"cursor" | "blackout" | "holiday">(
    "cursor"
  );

  const [savedSnapshot, setSavedSnapshot] = useState<CalendarState | null>(
    null
  );

  // Load catalog (list of calendars) for HeaderBar dropdown, etc.
  useEffect(() => {
    (async () => {
      setLoadingCatalog(true);
      try {
        const rows = await fetchAllCalendars();
        setCatalog(
          rows.filter((r) => typeof r._id === "string" && r._id.length > 0)
        );
      } finally {
        setLoadingCatalog(false);
      }
    })();
  }, []);

  // On first mount, prime savedSnapshot so dirty-check starts from initial state
  useEffect(() => {
    if (savedSnapshot === null) setSavedSnapshot(cal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dirty-check: shapes match because we normalize both cal & savedSnapshot
  const isDirty = useMemo(() => {
    if (!savedSnapshot) return false;
    return JSON.stringify(cal) !== JSON.stringify(savedSnapshot);
  }, [cal, savedSnapshot]);

  // Save handler
  const handleSave = async () => {
    // Prepare client state for server
    const payload = denormalizeCalendarForServer(cal);
    const { id, doc } = await saveCalendar(payload);

    // Normalize server doc back into client shape (and include id)
    const next = normalizeCalendarFromServer({ ...doc, _id: id });
    setCal(next);
    setSavedSnapshot(next); // ✅ prevents perpetual "dirty"
    router.refresh?.();
  };

  // Tab-close warning on unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Reset to blank, normalized state
  const resetToNew = () => {
    const next: CalendarState = {
      name: "",
      owner: "",
      category: "reservations",
      currency: "USD",
      cancelHours: 48,
      cancelFee: 0,
      version: 1,
      active: true,
      blackouts: [],
      recurringBlackouts: null,
      holidays: [],
      minStayByWeekday: {},
      seasons: [],
      leadTime: { minDays: 0, maxDays: 365 },
      rules: [],
    };
    setCal(next);
    setSavedSnapshot(next);
  };

  /**
   * NOTE: When you load a specific calendar (e.g., user selects one in HeaderBar),
   * call your fetchCalendarById(id) then:
   *
   *   const serverDoc = await fetchCalendarById(selectedId);
   *   const normalized = normalizeCalendarFromServer(serverDoc);
   *   setCal(normalized);
   *   setSavedSnapshot(normalized);
   *
   * This keeps the UI stable and the dirty-check correct.
   */

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted text-foreground">
      {/* NAVBAR */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <HeaderBar
          cal={cal}
          setCal={setCal}
          addMode={addMode}
          setAddMode={setAddMode}
          view={view}
          setView={setView}
          catalog={catalog}
          loadingCatalog={loadingCatalog}
          onSave={handleSave}
          onReset={resetToNew}
          isDirty={isDirty}
          setSavedSnapshot={setSavedSnapshot}
        />
      </header>

      {/* BODY */}
      <main className="mx-auto max-w-screen-2xl p-3 md:p-6">
        <SummaryBar cal={cal} setCal={setCal} />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <Card className="lg:col-span-3">
            <CardContent className="p-2 md:p-4">
              <CalendarGrid
                cal={cal}
                setCal={setCal}
                view={view}
                addMode={addMode}
                // When cal._id exists, CalendarGrid fetches reservations for the calendar
                calendarMongoId={cal._id as string | undefined}
              />
            </CardContent>
          </Card>

          <RightRail cal={cal} setCal={setCal} />
        </div>
      </main>

      {/* FOOTER */}
      <footer className="mx-auto max-w-screen-2xl px-3 md:px-6 pb-8 pt-2 text-xs text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>
            © {new Date().getFullYear()} Strategic Machines Booking Engine
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                navigator.clipboard.writeText(JSON.stringify(cal, null, 2))
              }
            >
              <UploadCloud className="h-4 w-4 mr-2" />
              Copy JSON
            </Button>
            <Button variant="outline" size="sm" onClick={resetToNew}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}
