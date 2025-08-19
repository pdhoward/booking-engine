// src/modals/CreateCalendarModal.tsx (updated)
'use client';

import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlusIcon, TrashIcon } from 'lucide-react'; // For icons
import { useForm } from 'react-hook-form'; 
import { useRouter } from 'next/navigation';
import { createCalendarAction } from '@/actions/createCalendar'; // Import the exported action
import { Calendar as FullCalendar } from '@fullcalendar/core';
import rrulePlugin from '@fullcalendar/rrule';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import multiMonthPlugin from '@fullcalendar/multimonth'; // For year view
import { EventInput } from '@fullcalendar/core';
import { RRule } from 'rrule';

// Type for form data based on schema
interface CalendarFormData {
  name: string;
  owner: string;
  type: 'hotel' | 'appointment';
  blackouts: Date[];
  recurringBlackouts: string;
  holidays: { date: Date; minNights: number }[];
  rules: { conditions: any; event: any }[]; // Parsed from JSON
  currency: string;
  cancellationPolicy: { hours: number; fee: number };
  versionMode: 'version' | 'overwrite' | 'cancel';
}

// Type for individual rule
interface Rule {
  conditions: any;
  event: any;
}

export default function CreateCalendarModal() {
  const [open, setOpen] = useState(false);
  const [blackouts, setBlackouts] = useState<Date[]>([]);
  const [holidays, setHolidays] = useState<{ date: Date; minNights: number }[]>([]);
  const [rules, setRules] = useState<Rule[]>([]); // Dynamic rules array
  const [recurringBlackouts, setRecurringBlackouts] = useState<string>('');
  const [addMode, setAddMode] = useState<'none' | 'blackout' | 'holiday' | 'restriction'>('none');
  const router = useRouter();
  const calendarRef = useRef<HTMLDivElement>(null);
  const fullCal = useRef<FullCalendar | null>(null);

  const { register, handleSubmit, setValue } = useForm<CalendarFormData>({
    defaultValues: {
      name: '',
      owner: 'Cypress Resorts',
      type: 'hotel',
      currency: 'USD',
      cancellationPolicy: { hours: 48, fee: 100 },
      versionMode: 'version',
    },
  });

  const onSubmit = async (data: CalendarFormData) => {
    try {
      await createCalendarAction({
        ...data,
        blackouts,
        holidays,
        recurringBlackouts,
        rules, // Use dynamic rules
      });
      setOpen(false);
      router.refresh();
    } catch (error) {
      alert('Error creating calendar: ' + (error as Error).message);
    }
  };

  const addBlackoutRange = (start: Date, end?: Date) => {
    if (end) {
      const dates = [];
      let current = new Date(start);
      while (current <= end) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      setBlackouts([...blackouts, ...dates]);
    } else {
      setBlackouts([...blackouts, start]);
    }
  };

  const addHoliday = (date: Date) => {
    const minNights = parseInt(window.prompt('Enter minimum nights for this holiday:', '1') || '1', 10);
    setHolidays([...holidays, { date, minNights: isNaN(minNights) ? 1 : minNights }]);
    // Auto-generate a sample rule for holiday min nights
    addRule({
      conditions: { all: [{ fact: 'checkInDate', operator: 'equals', value: date.toISOString() }] },
      event: { type: 'applyMinNights', params: { min: minNights } },
    });
  };

  const updateHolidayMinNights = (index: number, minNights: number) => {
    const updated = [...holidays];
    updated[index].minNights = minNights;
    setHolidays(updated);
  };

  const removeHoliday = (index: number) => {
    setHolidays(holidays.filter((_, i) => i !== index));
  };

  const removeBlackout = (date: Date) => {
    setBlackouts(blackouts.filter(d => d.toISOString() !== date.toISOString()));
  };

  const addRule = (newRule: Rule = { conditions: {}, event: {} }) => {
    setRules([...rules, newRule]);
  };

  const updateRule = (index: number, field: 'conditions' | 'event', value: string) => {
    try {
      const updated = [...rules];
      updated[index][field] = JSON.parse(value);
      setRules(updated);
    } catch {
      alert('Invalid JSON');
    }
  };

  const removeRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  // Derive FullCalendar events from state
  const events: EventInput[] = [
    ...blackouts.map((d) => ({
      id: `blackout-${d.toISOString()}`,
      start: d,
      allDay: true,
      color: 'gray',
      title: 'Blackout',
      editable: false,
    })),
    ...(recurringBlackouts ? [{
      rrule: recurringBlackouts,
      duration: { days: 1 },
      color: 'darkgray',
      title: 'Recurring Blackout',
    }] : []),
    ...holidays.map((h, i) => ({
      id: `holiday-${h.date.toISOString()}`,
      start: h.date,
      allDay: true,
      color: 'orange',
      title: `Holiday (min ${h.minNights})`,
      extendedProps: { minNights: h.minNights, index: i },
    })),
  ];

  useEffect(() => {
    if (calendarRef.current && !fullCal.current) {
      fullCal.current = new FullCalendar(calendarRef.current, {
        plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin, rrulePlugin, multiMonthPlugin],
        initialView: 'dayGridMonth',
        headerToolbar: {
          left: 'prev,next today',
          center: 'title',
          right: 'multiMonthYear,dayGridMonth,timeGridWeek,timeGridDay',
        },
        height: 400, // Compact but visible; adjust as needed
        selectable: true,
        editable: true,
        events,
        select: (info) => {
          if (addMode === 'blackout') {
            addBlackoutRange(info.start, info.end ? new Date(info.end.getTime() - 1) : undefined);
          }
        },
        dateClick: (info) => {
          if (addMode === 'blackout') {
            addBlackoutRange(info.date);
          } else if (addMode === 'holiday') {
            addHoliday(info.date);
          }
        },
        eventClick: (info) => {
          if (info.event.id?.startsWith('blackout-')) {
            removeBlackout(new Date(info.event.start!));
          } else if (info.event.id?.startsWith('holiday-')) {
            removeHoliday(info.event.extendedProps.index);
          }
        },
        eventChange: (info) => {
          // Handle drag to update dates if needed
        },
      });
      fullCal.current.render();
    } else if (fullCal.current) {
      fullCal.current.getEventSources().forEach(source => source.remove());
      fullCal.current.addEventSource(events);
    }
  }, [events, addMode]);

  // Simple RRULE builder (expand with UI if needed)
  const buildRRULE = () => {
    const rule = new RRule({
      freq: RRule.WEEKLY,
      byweekday: [RRule.SU],
      dtstart: new Date(),
    });
    setRecurringBlackouts(rule.toString());
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create New</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-lg">Create New Calendar</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="wizard" className="relative mr-auto w-full">
          <TabsList className="w-full">
            <TabsTrigger value="wizard" className="flex-1">Wizard (Calendar)</TabsTrigger>
            <TabsTrigger value="form" className="flex-1">Manual Form</TabsTrigger>
          </TabsList>
          <TabsContent value="wizard">
            <div className="flex space-x-2 mb-2">
              <Button variant={addMode === 'blackout' ? 'default' : 'outline'} onClick={() => setAddMode(addMode === 'blackout' ? 'none' : 'blackout')} className="h-8 text-sm flex-1">
                Add Blackout
              </Button>
              <Button variant={addMode === 'holiday' ? 'default' : 'outline'} onClick={() => setAddMode(addMode === 'holiday' ? 'none' : 'holiday')} className="h-8 text-sm flex-1">
                Add Holiday
              </Button>
              {/* Add more buttons for other restrictions as needed */}
            </div>
            <div ref={calendarRef} className="border rounded-md p-2 mb-4" />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">Blackouts</Label>
                <ul className="max-h-[150px] overflow-y-auto text-sm border rounded p-2">
                  {blackouts.map((date, i) => (
                    <li key={i} className="flex items-center justify-between py-1">
                      {date.toDateString()}
                      <Button variant="ghost" size="icon" onClick={() => removeBlackout(date)} className="h-6 w-6">
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <Label className="text-sm">Holidays</Label>
                <ul className="max-h-[150px] overflow-y-auto text-sm border rounded p-2">
                  {holidays.map((holiday, i) => (
                    <li key={i} className="flex items-center justify-between py-1">
                      {holiday.date.toDateString()}
                      <div className="flex items-center">
                        Min Nights:
                        <Input
                          type="number"
                          value={holiday.minNights}
                          onChange={(e) => updateHolidayMinNights(i, Number(e.target.value))}
                          className="w-16 h-8 text-sm ml-2 mr-2"
                        />
                        <Button variant="ghost" size="icon" onClick={() => removeHoliday(i)} className="h-6 w-6">
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="form" className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Label htmlFor="name" className="text-sm">Name (required)</Label>
                <Input id="name" {...register('name')} placeholder="Cypress Resorts Main Calendar" className="h-8 text-sm" />
              </div>
              <div>
                <Label htmlFor="type" className="text-sm">Type</Label>
                <Select onValueChange={(val) => setValue('type', val as 'hotel' | 'appointment')}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hotel">Hotel</SelectItem>
                    <SelectItem value="appointment">Appointment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="owner" className="text-sm">Owner</Label>
                <Input id="owner" {...register('owner')} className="h-8 text-sm" />
              </div>
              <div>
                <Label htmlFor="currency" className="text-sm">Currency</Label>
                <Input id="currency" {...register('currency')} className="h-8 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="cancellationHours" className="text-sm">Cancel Hours</Label>
                <Input id="cancellationHours" type="number" {...register('cancellationPolicy.hours')} className="h-8 text-sm" />
              </div>
              <div>
                <Label htmlFor="cancellationFee" className="text-sm">Cancel Fee</Label>
                <Input id="cancellationFee" type="number" {...register('cancellationPolicy.fee')} className="h-8 text-sm" />
              </div>
            </div>
            <div>
              <Label htmlFor="versionMode" className="text-sm">If Name Exists</Label>
              <Select defaultValue="version" onValueChange={(val) => setValue('versionMode', val as 'version' | 'overwrite' | 'cancel')}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="version">Version (append v2)</SelectItem>
                  <SelectItem value="overwrite">Overwrite</SelectItem>
                  <SelectItem value="cancel">Cancel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="recurringBlackouts" className="text-sm">Recurring Blackouts (RRULE)</Label>
              <Input
                id="recurringBlackouts"
                value={recurringBlackouts}
                onChange={(e) => setRecurringBlackouts(e.target.value)}
                placeholder="FREQ=WEEKLY;BYDAY=SU"
                className="h-8 text-sm"
              />
              <Button type="button" onClick={buildRRULE} className="mt-1 h-8 text-sm">Build RRULE</Button>
              <p className="text-xs text-muted-foreground mt-0.5">Or use: https://jakubroztocil.github.io/rrule/</p>
            </div>
            <div>
              <Label className="text-sm flex items-center justify-between">
                Rules (JSON for json-rules-engine)
                <Button type="button" variant="outline" size="sm" onClick={() => addRule()} className="h-6 text-xs">
                  <PlusIcon className="h-3 w-3 mr-1" /> Add Rule
                </Button>
              </Label>
              <ul className="space-y-2 mt-2">
                {rules.map((rule, i) => (
                  <li key={i} className="border p-2 rounded">
                    <div>
                      <Label htmlFor={`conditions-${i}`} className="text-xs">Conditions JSON</Label>
                      <Textarea
                        id={`conditions-${i}`}
                        value={JSON.stringify(rule.conditions, null, 2)}
                        onChange={(e) => updateRule(i, 'conditions', e.target.value)}
                        rows={3}
                        className="text-xs"
                      />
                    </div>
                    <div className="mt-1">
                      <Label htmlFor={`event-${i}`} className="text-xs">Event JSON</Label>
                      <Textarea
                        id={`event-${i}`}
                        value={JSON.stringify(rule.event, null, 2)}
                        onChange={(e) => updateRule(i, 'event', e.target.value)}
                        rows={3}
                        className="text-xs"
                      />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeRule(i)} className="mt-1 h-6 w-6">
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground mt-1">{`Example: {"conditions": {"all": [{"fact": "checkInDate", "operator": "equals", "value": "2025-12-25"}] }, "event": {"type": "applyMinNights", "params": {"min": 2}} }`}</p>
            </div>
            <Button type="submit" className="w-full h-8 text-sm" onClick={handleSubmit(onSubmit)}>Create</Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}