// components/calendar/SummaryBar.tsx
"use client";

import React, { useMemo, useState, useEffect } from "react";
import { CalendarState } from "@/types/calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RotateCcw, ListChecks } from "lucide-react";

type Props = {
  cal: CalendarState;
  setCal: React.Dispatch<React.SetStateAction<CalendarState>>;
};

export default function SummaryBar({ cal, setCal }: Props) {
  const chips = useMemo(() => {
    const out: React.ReactNode[] = [];
    if (cal.blackouts.length) out.push(<Badge key="b" variant="secondary">{cal.blackouts.length} blackouts</Badge>);
    if (cal.holidays.length) out.push(<Badge key="h" variant="secondary">{cal.holidays.length} holidays</Badge>);
    if (cal.recurringBlackouts) out.push(<Badge key="r" variant="secondary">recurring rule</Badge>);
    if (Object.keys(cal.minStayByWeekday).length) out.push(<Badge key="m" variant="secondary">weekday min-stay</Badge>);
    if (cal.seasons.length) out.push(<Badge key="s" variant="secondary">{cal.seasons.length} seasonal bands</Badge>);
    if (cal.leadTime.minDays || cal.leadTime.maxDays < 365) out.push(<Badge key="l" variant="secondary">lead-time</Badge>);
    return out;
  }, [cal]);

  // Rules editor buffer
  const [open, setOpen] = useState(false);
  const [rulesText, setRulesText] = useState<string>("[]");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (open) {
      setRulesText(JSON.stringify(cal.rules ?? [], null, 2));
      setError("");
    }
  }, [open, cal.rules]);

  const applyRules = () => {
    try {
      const parsed = JSON.parse(rulesText ?? "[]");
      if (!Array.isArray(parsed)) throw new Error("Rules must be an array.");
      setCal((p) => ({ ...p, rules: parsed }));
      setError("");
      setOpen(false);
    } catch (e: any) {
      setError(e?.message || "Invalid JSON");
    }
  };

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {chips}
      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            setCal((p) => ({
              ...p,
              blackouts: [],
              holidays: [],
              recurringBlackouts: null, // keep type stable
            }))
          }
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Clear
        </Button>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm">
              <ListChecks className="h-4 w-4 mr-2" />
              Rules JSON
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[720px]">
            <DialogHeader>
              <DialogTitle>Engine Rules JSON</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
              <div>
                <Label className="text-xs">Paste/Edit (Array)</Label>
                <Textarea
                  value={rulesText}
                  onChange={(e) => setRulesText(e.target.value)}
                  rows={16}
                />
                {error && (
                  <div className="text-xs text-red-600 mt-1">{error}</div>
                )}
                <div className="mt-2">
                  <Button size="sm" onClick={applyRules}>Apply</Button>
                </div>
              </div>
              <div>
                <Label className="text-xs">State Snapshot</Label>
                <pre className="text-xs bg-muted p-3 rounded h-[360px] overflow-auto">
                  {JSON.stringify(
                    {
                      blackouts: cal.blackouts,
                      holidays: cal.holidays,
                      recurringBlackouts: cal.recurringBlackouts,
                      minStayByWeekday: cal.minStayByWeekday,
                      seasons: cal.seasons,
                      leadTime: cal.leadTime,
                      rules: cal.rules,
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
