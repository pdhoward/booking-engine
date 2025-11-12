"use client";

// What: Side controls (recurring blackouts builder, min-stay, seasons,
//       lead time, and list editors for blackouts & holidays).

import React, { useState } from "react";
import { CalendarState } from "@/types/calendar";
import { weekdayChoice } from "@/lib/utils"; // expects [{ label: 'Su', value: Weekday }, ...]
import { RRule, Weekday, Options } from "rrule";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MinusCircle, X } from "lucide-react";

type Props = {
  cal: CalendarState;
  setCal: React.Dispatch<React.SetStateAction<CalendarState>>;
};

/** Normalize Date | string into YYYY-MM-DD (safe for React key/value). */
const toYmd = (v: string | Date): string =>
  typeof v === "string" ? v.slice(0, 10) : v.toISOString().slice(0, 10);

/** Safe integer conversion with fallback. */
const toInt = (v: string, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export default function RightRail({ cal, setCal }: Props) {
  // builder state stays local here
  const [rrWeekdays, setRrWeekdays] = useState<Weekday[]>([]);
  const [rrStart, setRrStart] = useState("");

  const buildRRULE = () => {
    try {
      const opts: Partial<Options> = { freq: RRule.WEEKLY };
      if (rrWeekdays.length) opts.byweekday = rrWeekdays;
      if (rrStart) opts.dtstart = new Date(`${rrStart}T00:00:00Z`);
      const rule = new RRule(opts);
      setCal((p) => ({ ...p, recurringBlackouts: rule.toString() }));
    } catch {
      // swallow builder errors; user can correct inputs
    }
  };

  return (
    <div className="space-y-4">
      {/* Recurring Blackouts */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="font-semibold">Recurring Blackouts</div>
          <Input
            value={cal.recurringBlackouts ?? ""}
            onChange={(e) =>
              setCal((p) => ({
                ...p,
                recurringBlackouts: e.target.value ? e.target.value : null,
              }))
            }
            placeholder="FREQ=WEEKLY;BYDAY=SU"
            className="h-9"
          />
          <div className="text-xs text-muted-foreground">Builder</div>
          <div className="flex flex-wrap gap-1">
            {weekdayChoice.map((w) => (
              <Button
                key={w.label}
                variant={rrWeekdays.includes(w.value) ? "default" : "outline"}
                size="sm"
                className="h-7 px-2"
                onClick={() =>
                  setRrWeekdays((prev) =>
                    prev.includes(w.value) ? prev.filter((x) => x !== w.value) : [...prev, w.value]
                  )
                }
              >
                {w.label}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Start yyyy-mm-dd"
              value={rrStart}
              onChange={(e) => setRrStart(e.target.value)}
              className="h-8"
            />
            <Button size="sm" onClick={buildRRULE}>
              Build
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Minimum Stay by Weekday */}
      <Card>
        <CardContent className="pt-4 space-y-2">
          <div className="font-semibold">Minimum Stay by Weekday</div>
          <div className="flex flex-wrap gap-2">
            {weekdayChoice.map((w) => (
              <div key={w.label} className="flex items-center gap-1">
                <span className="text-xs w-6">{w.label}</span>
                <Input
                  type="number"
                  value={String(cal.minStayByWeekday[w.label] ?? 1)}
                  onChange={(e) =>
                    setCal((p) => ({
                      ...p,
                      minStayByWeekday: {
                        ...p.minStayByWeekday,
                        [w.label]: toInt(e.target.value, 1),
                      },
                    }))
                  }
                  className="w-14 h-7 text-xs"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Seasonal Price Bands */}
      <Card>
        <CardContent className="pt-4 space-y-2">
          <div className="font-semibold">Seasonal Price Bands</div>
          <div className="space-y-2">
            {cal.seasons.map((s, i) => {
              const startStr = toYmd(s.start);
              const endStr = toYmd(s.end);
              return (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={startStr}
                    onChange={(e) =>
                      setCal((p) => ({
                        ...p,
                        seasons: p.seasons.map((x, j) =>
                          j === i ? { ...x, start: e.target.value } : x
                        ),
                      }))
                    }
                    placeholder="start yyyy-mm-dd"
                    className="h-8"
                  />
                  <Input
                    value={endStr}
                    onChange={(e) =>
                      setCal((p) => ({
                        ...p,
                        seasons: p.seasons.map((x, j) =>
                          j === i ? { ...x, end: e.target.value } : x
                        ),
                      }))
                    }
                    placeholder="end yyyy-mm-dd"
                    className="h-8"
                  />
                  <Input
                    type="number"
                    value={String(s.price ?? 0)}
                    onChange={(e) =>
                      setCal((p) => ({
                        ...p,
                        seasons: p.seasons.map((x, j) =>
                          j === i ? { ...x, price: toInt(e.target.value, 0) } : x
                        ),
                      }))
                    }
                    placeholder="$"
                    className="h-8 w-24"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setCal((p) => ({
                        ...p,
                        seasons: p.seasons.filter((_, j) => j !== i),
                      }))
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
          <Button
            size="sm"
            onClick={() =>
              setCal((p) => ({
                ...p,
                seasons: [
                  ...p.seasons,
                  { start: toYmd(new Date()), end: toYmd(new Date()), price: 100 },
                ],
              }))
            }
          >
            + Add Band
          </Button>
        </CardContent>
      </Card>

      {/* Lead-Time Restrictions */}
      <Card>
        <CardContent className="pt-4 space-y-2">
          <div className="font-semibold">Lead-Time Restrictions</div>
          <div className="flex gap-2">
            <Input
              type="number"
              value={String(cal.leadTime.minDays ?? 0)}
              onChange={(e) =>
                setCal((p) => ({
                  ...p,
                  leadTime: { ...p.leadTime, minDays: toInt(e.target.value, 0) },
                }))
              }
              placeholder="Min days"
              className="w-28 h-8"
            />
            <Input
              type="number"
              value={String(cal.leadTime.maxDays ?? 0)}
              onChange={(e) =>
                setCal((p) => ({
                  ...p,
                  leadTime: { ...p.leadTime, maxDays: toInt(e.target.value, 0) },
                }))
              }
              placeholder="Max days"
              className="w-28 h-8"
            />
          </div>
        </CardContent>
      </Card>

      {/* Blackouts & Holidays */}
      <Card>
        <CardContent className="pt-4 space-y-2">
          <div className="font-semibold">Blackouts & Holidays</div>

          {/* Blackouts list */}
          <div>
            <div className="text-xs text-muted-foreground mb-1">Blackouts</div>
            <ul className="max-h-[120px] overflow-y-auto text-sm space-y-1">
              {cal.blackouts.map((d) => {
                const label = toYmd(d);
                return (
                  <li key={label} className="flex justify-between items-center">
                    {label}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setCal((p) => ({
                          ...p,
                          blackouts: p.blackouts.filter((x) => toYmd(x) !== label),
                        }))
                      }
                    >
                      <MinusCircle className="h-4 w-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Holidays list */}
          <div>
            <div className="text-xs text-muted-foreground mb-1">Holidays</div>
            <ul className="max-h-[120px] overflow-y-auto text-sm space-y-1">
              {cal.holidays.map((h, i) => {
                const dateStr = toYmd(h.date);
                return (
                  <li key={`${dateStr}-${i}`} className="flex items-center gap-2">
                    <span className="w-28">{dateStr}</span>
                    <Input
                      type="number"
                      value={String(h.minNights ?? 1)}
                      onChange={(e) =>
                        setCal((p) => ({
                          ...p,
                          holidays: p.holidays.map((x, j) =>
                            j === i
                              ? { ...x, minNights: toInt(e.target.value, 1) }
                              : x
                          ),
                        }))
                      }
                      className="h-7 w-24 text-xs"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setCal((p) => ({
                          ...p,
                          holidays: p.holidays.filter((_, j) => j !== i),
                        }))
                      }
                    >
                      <MinusCircle className="h-4 w-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
