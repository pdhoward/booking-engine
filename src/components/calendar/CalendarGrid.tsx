"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import rrulePlugin from "@fullcalendar/rrule";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import multiMonthPlugin from "@fullcalendar/multimonth";

import type { CalendarApi, EventSourceFunc, EventSourceInput } from "@fullcalendar/core";
import { CalendarState } from "@/types/calendar";
import { fetchReservationsByCalendar, ReservationLite } from "@/lib/api/reservations";
import { expandDateRange, toISODate, unique } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CircleDot } from "lucide-react";

type Props = {
  cal: CalendarState & { _id?: string };
  setCal: React.Dispatch<React.SetStateAction<CalendarState>>;
  view: "dayGridMonth" | "timeGridWeek" | "timeGridDay" | "multiMonthYear";
  addMode: "cursor" | "blackout" | "holiday";
  calendarMongoId?: string;
};

function toYmd(d: Date | string) {
  const dt = new Date(d);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const day = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function CalendarGrid({
  cal,
  setCal,
  view,
  addMode,
  calendarMongoId,
}: Props) {
  const calendarRef = useRef<FullCalendar | null>(null);
  const [title, setTitle] = useState<string>("");

  // Sync external view with FullCalendar
  useEffect(() => {
    const api: CalendarApi | undefined = calendarRef.current?.getApi();
    if (!api) return;
    if (api.view.type !== view) api.changeView(view);
  }, [view]);

  /** Background blackout events */
  const blackoutBgEvents = useMemo(() => {
    if (!cal?.blackouts?.length) return [];
    return cal.blackouts.map((iso, i) => {
      const start = new Date(`${iso}T00:00:00Z`);
      const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 1));
      return {
        id: `blackout-${iso}-${i}`,
        title: "Blackout",
        start: toYmd(start),
        end: toYmd(end),
        display: "background",
        classNames: ["fc-blackout"],
        allDay: true,
        extendedProps: { z: 0 },
      };
    });
  }, [cal?.blackouts]);

  /** Holiday events */
  const holidayFgEvents = useMemo(() => {
    if (!cal?.holidays?.length) return [];
    return cal.holidays.map((h: any) => {
      const start = new Date(`${toYmd(h.date)}T00:00:00Z`);
      const minN = Number(h.minNights ?? 1);
      const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + minN));
      return {
        id: `holiday-${toYmd(start)}`,
        title: minN > 1 ? `Holiday (min ${minN})` : "Holiday",
        start: toYmd(start),
        end: toYmd(end),
        allDay: true,
        classNames: ["fc-holiday-pill"],
        extendedProps: { z: 10 },
      };
    });
  }, [cal?.holidays]);

  /** Recurring blackouts (RRULE) */
  const recurringBlackoutEvents = useMemo<EventSourceInput>(() => {
    if (!cal?.recurringBlackouts) return [];
    return [
      {
        id: "recurring-blackout",
        rrule: cal.recurringBlackouts,
        duration: { days: 1 },
        display: "background",
        classNames: ["fc-blackout"],
        allDay: true,
        extendedProps: { z: 0 },
      } as any,
    ];
  }, [cal?.recurringBlackouts]);

  /** Reservations for all attached units */
  const reservationsSource: EventSourceFunc = async (info, success, failure) => {
    try {
      if (!calendarMongoId) return success([]);
      const startYmd = toYmd(info.start);
      const endYmd = toYmd(info.end);
      const rows: ReservationLite[] = await fetchReservationsByCalendar(calendarMongoId, startYmd, endYmd);

      const events = rows.map((r) => ({
        id: `res-${r._id}`,
        title: r.unitName ? `Reserved • ${r.unitName}` : "Reserved",
        start: toYmd(new Date(r.startDate)),
        end: toYmd(new Date(r.endDate)),
        allDay: true,
        classNames: ["fc-reservation-pill"],
        extendedProps: { z: 20 },
      }));

      success(events);
    } catch (e) {
      failure(e as any);
    }
  };

  /** Combine all event sources */
  const eventSources: EventSourceInput[] = useMemo(() => {
    const out: EventSourceInput[] = [];
    out.push(reservationsSource);
    if (recurringBlackoutEvents && (recurringBlackoutEvents as any[]).length)
      out.push(recurringBlackoutEvents);
    if (blackoutBgEvents.length) out.push(blackoutBgEvents);
    if (holidayFgEvents.length) out.push(holidayFgEvents);
    return out;
  }, [reservationsSource, recurringBlackoutEvents, blackoutBgEvents, holidayFgEvents]);

  /** Selection handlers */
  const handleSelect = (info: any) => {
    const start = toISODate(info.start);
    const end = toISODate(new Date(info.end.getTime() - 86400000));
    if (!start || !end) return;

    if (addMode === "blackout") {
      setCal((p) => {
        const newDates = expandDateRange(start, end).map(String);
        return {
          ...p,
          blackouts: unique([...p.blackouts.map(String), ...newDates]),
        };
      });
    } else if (addMode === "holiday") {
      setCal((p) => {
        const seen = new Set(p.holidays.map((h) => toYmd(String(h.date))));
        const toAdd = expandDateRange(start, end)
          .map(String)
          .filter((d) => !seen.has(d))
          .map((d) => ({ date: d, minNights: 1 }));
        return { ...p, holidays: [...p.holidays, ...toAdd] };
      });
    }
  };

  const handleDateClick = (info: any) => {
    const iso = toISODate(info.date);
    if (!iso) return;

    if (addMode === "blackout") {
      setCal((p) => ({
        ...p,
        blackouts: unique([...p.blackouts.map(String), String(iso)]),
      }));
    } else if (addMode === "holiday") {
      setCal((p) =>
        p.holidays.some((h) => toYmd(String(h.date)) === String(iso))
          ? p
          : { ...p, holidays: [...p.holidays, { date: String(iso), minNights: 1 }] }
      );
    }
  };

  const handleEventClick = (info: any) => {
    if (addMode === "cursor") return;

    if (info.event.id?.startsWith("blackout-")) {
      const d = info.event.id.replace("blackout-", "").split("-")[0];
      setCal((p) => ({ ...p, blackouts: p.blackouts.filter((x) => x !== d) }));
    } else if (info.event.id?.startsWith("holiday-")) {
      const d = info.event.id.replace("holiday-", "");
      setCal((p) => ({ ...p, holidays: p.holidays.filter((x) => toYmd(x.date) !== d) }));
    } else if (info.event.id === "recurring-blackout") {
      setCal((p) => ({ ...p, recurringBlackouts: null }));
    }
  };

  // Toolbar actions
  const goPrev = () => calendarRef.current?.getApi().prev();
  const goNext = () => calendarRef.current?.getApi().next();
  const goToday = () => calendarRef.current?.getApi().today();

  return (
    <div className="space-y-2">
      {/* Custom slim toolbar */}
      <div className="flex items-center justify-between px-1">
        <div className="text-sm font-semibold truncate">{title}</div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={goPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToday}>
            <CircleDot className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={goNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <FullCalendar
        ref={calendarRef as any}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, rrulePlugin, multiMonthPlugin]}
        initialView={view}
        headerToolbar={false}
        height="auto"
        dayMaxEvents={true}
        expandRows={true}
        fixedWeekCount={true}
        longPressDelay={180}
        selectMinDistance={8}
        selectable={addMode !== "cursor"}
        selectMirror={true}
        select={handleSelect}
        dateClick={handleDateClick}
        eventClick={handleEventClick}
        eventOrder={(a: any, b: any) =>
          ((a.extendedProps as any)?.z ?? 0) - ((b.extendedProps as any)?.z ?? 0)
        }
        eventSources={eventSources}
        key={cal?._id ?? "no-cal"}
        displayEventTime={false}
        datesSet={(arg) => setTitle(arg.view.title)}
      />
    </div>
  );
}
