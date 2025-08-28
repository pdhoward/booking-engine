// components/ui/date-picker.tsx
"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";

/**
 * You can pass:
 * - defaultMonth: which month the popover calendar opens on
 * - numberOfMonths: show multiple months at once
 * - disabled: disable certain dates (e.g., before check-in)
 * - modifiers + modifiersClassNames: visually mark dates (e.g., the check-in day)
 */
interface DatePickerProps {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  className?: string;
  placeholder?: string;

  defaultMonth?: Date | undefined;
  numberOfMonths?: number;

  // passthroughs to react-day-picker via shadcn Calendar
  disabled?: any;
  modifiers?: Record<string, any>;
  modifiersClassNames?: Record<string, string>;
}

export function DatePicker({
  value,
  onChange,
  className,
  placeholder = "Pick a date",
  defaultMonth,
  numberOfMonths = 1,
  disabled,
  modifiers,
  modifiersClassNames,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (selected: Date | undefined) => {
    onChange(selected);
    setOpen(false);
  };

  return (
    <div className={cn("relative", className)}>
      <Button
        id="date"
        variant="outline"
        className={cn("w-[240px] justify-start text-left font-normal", !value && "text-muted-foreground")}
        onClick={() => setOpen((o) => !o)}
      >
        <CalendarIcon className="mr-2 h-4 w-4" />
        {value ? format(value, "LLL dd, y") : <span>{placeholder}</span>}
      </Button>

      {open && (
        <div className="absolute z-50 mt-2 rounded-md border bg-popover p-0 shadow-md">
          <Calendar
            autoFocus
            mode="single"
            defaultMonth={defaultMonth ?? value}
            selected={value}
            onSelect={handleSelect}
            numberOfMonths={numberOfMonths}
            disabled={disabled}
            modifiers={modifiers}
            modifiersClassNames={{
              // nice pill to highlight e.g. the check-in date
              checkin: "bg-primary text-primary-foreground rounded-full",
              ...(modifiersClassNames ?? {}),
            }}
          />
        </div>
      )}
    </div>
  );
}
