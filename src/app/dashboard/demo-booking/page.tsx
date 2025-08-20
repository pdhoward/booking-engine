"use client";

import { useEffect, useMemo, useState } from "react";
import { format, isAfter, isEqual } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { DateRangePicker } from "@/components/DateRangePicker";

type CalendarSummary = { id: string; name: string };

export default function DemoBooking() {
  const [calendars, setCalendars] = useState<CalendarSummary[]>([]);
  const [loadingCalendars, setLoadingCalendars] = useState(true);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>("");

  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  // Load calendars
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoadingCalendars(true);
        setError("");
        const res = await fetch("/api/calendars", { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load calendars (${res.status})`);
        const data = await res.json();
        const list: CalendarSummary[] = (Array.isArray(data) ? data : data?.items || []).map((c: any) => ({
          id: String(c.id ?? c._id),
          name: String(c.name ?? "Untitled"),
        }));
        if (!cancelled) {
          setCalendars(list);
          if (list.length) setSelectedCalendarId(list[0].id); // preselect first
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load calendars");
      } finally {
        if (!cancelled) setLoadingCalendars(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedCalendarName = useMemo(
    () => calendars.find((c) => c.id === selectedCalendarId)?.name ?? "",
    [calendars, selectedCalendarId]
  );

  const dateProblem = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return "Please select a check-in and check-out date.";
    if (isAfter(dateRange.from, dateRange.to) || isEqual(dateRange.from, dateRange.to)) {
      return "Check-out must be after check-in.";
    }
    return "";
  }, [dateRange]);

  const canSubmit = !!selectedCalendarId && !dateProblem && !!dateRange?.from && !!dateRange?.to && !loading;

  const handleCalendarSelect = (id: string) => {
    setSelectedCalendarId(id);
    setResult("");
    setError("");
  };

  const handleDateChange = (range: DateRange | undefined) => {
    setDateRange(range);
    setError("");
    setResult("");
  };

  const handleBook = async () => {
    setError("");
    setResult("");
    if (!canSubmit) return;

    const start = format(dateRange!.from!, "yyyy-MM-dd");
    const end = format(dateRange!.to!, "yyyy-MM-dd");

    setLoading(true);
    try {
      const res = await fetch(`/api/calendars/${encodeURIComponent(selectedCalendarId)}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start, end }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Booking failed");
      setResult(JSON.stringify(data, null, 2));
    } catch (e: any) {
      setError(e?.message || "Booking failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Demo Booking</h2>
        <p className="text-sm text-muted-foreground">
          Pick a calendar, choose dates, and simulate an availability/booking request.
        </p>
      </div>

      {/* Calendars list */}
      <section className="space-y-2">
        <Label className="text-sm">Choose a calendar</Label>
        {loadingCalendars ? (
          <div className="text-sm text-muted-foreground">Loading calendars…</div>
        ) : calendars.length ? (
          <div className="flex flex-wrap gap-2">
            {calendars.map((cal) => (
              <Button
                key={cal.id}
                variant={selectedCalendarId === cal.id ? "default" : "link"}
                className="px-2 py-0 h-8"
                onClick={() => handleCalendarSelect(cal.id)}
              >
                {cal.name}
              </Button>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No calendars found.</div>
        )}
        {selectedCalendarName && (
          <div className="text-xs text-muted-foreground">
            Selected: <span className="font-medium">{selectedCalendarName}</span>
          </div>
        )}
      </section>

      <Separator />

      {/* Date range */}
      <section className="space-y-2">
        <Label className="text-sm">Select dates</Label>
        <DateRangePicker value={dateRange} onChange={handleDateChange} />
        {dateProblem ? (
          <div className="text-xs text-red-500">{dateProblem}</div>
        ) : (
          <div className="text-xs text-muted-foreground">
            {dateRange?.from && dateRange?.to
              ? `${format(dateRange.from, "MMM d, yyyy")} → ${format(dateRange.to, "MMM d, yyyy")}`
              : "No dates selected"}
          </div>
        )}
      </section>

      {/* Submit */}
      <div className="flex items-center gap-2">
        <Button onClick={handleBook} disabled={!canSubmit}>
          {loading ? "Checking…" : "Check & Book"}
        </Button>
        {!selectedCalendarId && (
          <span className="text-xs text-muted-foreground">Select a calendar first.</span>
        )}
      </div>

      {(error || result) && <Separator />}

      {error && <p className="text-sm text-red-500">Error: {error}</p>}

      {result && (
        <div className="space-y-1">
          <Label className="text-sm">Result</Label>
          <pre className="text-xs bg-muted rounded p-3 overflow-auto max-h-72">{result}</pre>
        </div>
      )}
    </div>
  );
}
