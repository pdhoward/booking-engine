"use client";

// What: Encapsulates FullCalendar init/update and event building.
// Props: calendar state, mode, and view are controlled by the parent.

import React, { useEffect, useMemo, useRef } from "react";
import { Calendar as FC_Calendar, type EventInput } from "@fullcalendar/core";
import rrulePlugin from "@fullcalendar/rrule";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import multiMonthPlugin from "@fullcalendar/multimonth";
import { CalendarState } from "@/types/calendar";
import { expandDateRange, toISODate, unique } from "@/lib/utils";

type Props = {
  cal: CalendarState;
  setCal: React.Dispatch<React.SetStateAction<CalendarState>>;
  view: "dayGridMonth" | "timeGridWeek" | "timeGridDay" | "multiMonthYear";
  addMode: "cursor" | "blackout" | "holiday";
  reservationEvents?: EventInput[];
};

export default function CalendarGrid({ cal, setCal, view, addMode, reservationEvents=[] }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const fcRef = useRef<FC_Calendar | null>(null);

  // Build events (foreground holidays, background blackouts)
  const events: EventInput[] = useMemo(() => {
    const blackoutEvents = cal.blackouts.map((iso) => ({
      id: `blackout-${iso}`,
      start: iso,
      allDay: true,
      display: "background",
      color: "#5b5b5b55",
      title: "Blackout",
    }));

    const holidayEvents = cal.holidays.map((h) => ({
      id: `holiday-${h.date}`,
      start: h.date,
      allDay: true,
      display: "block",
      title: `Holiday (min ${h.minNights})`,
      classNames: ["fc-holiday-pill"],
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

     return [...blackoutEvents, ...holidayEvents, ...rruleEvent, ...reservationEvents];
  }, [cal.blackouts, cal.holidays, cal.recurringBlackouts, reservationEvents]);

  // Create once / destroy on unmount
  useEffect(() => {
    if (!hostRef.current || fcRef.current) return;

    const fc = new FC_Calendar(hostRef.current, {
      plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin, rrulePlugin, multiMonthPlugin],
      initialView: view,
      contentHeight: "auto",
      headerToolbar: { left: "prev,next today", center: "title", right: "" },
      selectable: addMode !== "cursor",
      events,
      themeSystem: "standard",
      dayMaxEvents: true,
      expandRows: true,
      fixedWeekCount: true,
      selectMirror: true,
      longPressDelay: 180,
      selectMinDistance: 8,
    });

    fc.render();
    fcRef.current = fc;

    return () => {
      fc.destroy();
      fcRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep data/view/mode in sync; rebind handlers to capture latest addMode
  useEffect(() => {
    const fc = fcRef.current;
    if (!fc) return;

    fc.batchRendering(() => {
      fc.setOption("events", events);
      if (fc.view.type !== view) fc.changeView(view);
      fc.setOption("selectable", addMode !== "cursor");

      fc.setOption("select", (info: any) => {
        const start = toISODate(info.start);
        const end = toISODate(new Date(info.end.getTime() - 86400000));
        if (!start || !end) return;

        if (addMode === "blackout") {
          setCal((p) => ({ ...p, blackouts: unique([...p.blackouts, ...expandDateRange(start, end)]) }));
        } else if (addMode === "holiday") {
          setCal((p) => {
            const seen = new Set(p.holidays.map(h => h.date));
            const toAdd = expandDateRange(start, end)
              .filter(d => !seen.has(d))
              .map(d => ({ date: d, minNights: 1 }));
            return { ...p, holidays: [...p.holidays, ...toAdd] };
          });
        }
      });

      fc.setOption("dateClick", (info: any) => {
        const iso = toISODate(info.date);
        if (!iso) return;

        if (addMode === "blackout") {
          setCal((p) => ({ ...p, blackouts: unique([...p.blackouts, iso]) }));
        } else if (addMode === "holiday") {
          setCal((p) => (p.holidays.some(h => h.date === iso) ? p : { ...p, holidays: [...p.holidays, { date: iso, minNights: 1 }] }));
        }
      });

      fc.setOption("eventClick", (info: any) => {
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

    // Smooth re-measure after DOM changes to prevent grid jumps
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => fc.updateSize());
    }
  }, [events, view, addMode, setCal]);

  return (
    // Wrapper toggles crosshair without touching the FC host (prevents grid loss)
    <div className={addMode !== "cursor" ? "cursor-crosshair" : "cursor-auto"}>
      <div ref={hostRef} className="w-full border rounded-md p-2 bg-background" />
    </div>
  );
}
