// components/CalendarManager.tsx
"use client";

import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { addDays, format, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { useRouter } from 'next/navigation'; // Import for refresh after save

interface CalendarManagerProps {
  initialBlackouts: string[]; // e.g., ['2025-12-25']
  calendarId: string;
}

export function CalendarManager({ initialBlackouts, calendarId }: CalendarManagerProps) {
  const [selectedDates, setSelectedDates] = useState<Date[]>(
    initialBlackouts.map((d) => new Date(d))
  );
  const [previewMode, setPreviewMode] = useState(false);
  const router = useRouter(); // For refreshing after save

  const modifiers = {
    blackedOut: (date: Date) =>
      selectedDates.some((d) => isSameDay(d, date)),
    holiday: (date: Date) => format(date, "yyyy-MM-dd") === "2025-07-04", // Example
  };

  const modifiersStyles = {
    blackedOut: { color: "white", backgroundColor: "red" },
    holiday: { color: "white", backgroundColor: "orange" },
  };

  const handleSelect = (dates: Date[] | undefined) => {
    if (dates) setSelectedDates(dates);
  };

  const handleSave = async () => {
    const formatted = selectedDates.map((d) => format(d, "yyyy-MM-dd"));
    await fetch(`/api/calendars/${calendarId}`, {
      method: "PATCH",
      body: JSON.stringify({ blackouts: formatted }),
    });
    router.refresh(); // Revalidate and refresh the page
  };

  return (
    <div className="space-y-4">
      <Calendar
        mode="multiple"
        selected={selectedDates}
        onSelect={handleSelect}
        modifiers={previewMode ? modifiers : undefined}
        modifiersStyles={previewMode ? modifiersStyles : undefined}
        numberOfMonths={2}
        className="rounded-md border"
      />
      <div className="flex space-x-2">
        <Button onClick={() => setPreviewMode(!previewMode)}>
          {previewMode ? "Edit Mode" : "Preview Availability"}
        </Button>
        <Button onClick={handleSave}>Save Blackouts</Button>
      </div>
      {previewMode && (
        <p className="text-sm text-muted-foreground">
          Red: Blacked out | Orange: Holidays (apply rules)
        </p>
      )}
    </div>
  );
}