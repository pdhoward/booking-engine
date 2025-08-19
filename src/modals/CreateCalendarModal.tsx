// src/modals/CreateCalendarModal.tsx
'use client';

import * as React from 'react';
import { useState, useRef, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { TrashIcon, CalendarIcon, Wand2, X, Eye } from 'lucide-react';

import { createCalendarAction } from '@/actions/createCalendar';

import { Calendar as FC_Calendar, type EventInput } from '@fullcalendar/core';
import rrulePlugin from '@fullcalendar/rrule';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import multiMonthPlugin from '@fullcalendar/multimonth';
import { RRule, Weekday, Options } from 'rrule';
import { toISODate, expandDateRange, unique, isIsoDate, weekdayChoice } from '@/lib/utils';

type CalendarType = 'hotel' | 'appointment';
type VersionMode = 'version' | 'overwrite' | 'cancel';

interface HolidayRule { date: string; minNights: number }
interface SeasonRule { start: string; end: string; price: number }
interface LeadTimeRule { minDays: number; maxDays: number }

interface CalendarFormData {
  name: string;
  owner: string;
  type: CalendarType;
  currency: string;
  cancellationPolicy: { hours: number; fee: number };
  versionMode: VersionMode;
  blackouts: string[];
  recurringBlackouts: string;
  holidays: HolidayRule[];
  minStayByWeekday: Record<string, number>;
  seasons: SeasonRule[];
  leadTime: LeadTimeRule;
  rules: { conditions: any; event: any }[];
}

type AddMode = 'cursor' | 'blackout' | 'holiday';

export default function CreateCalendarModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // tab state (to re-init calendar when Wizard tab shown)
  const [activeTab, setActiveTab] = useState<'wizard' | 'form'>('wizard');

  // wizard controls
  const [addMode, setAddMode] = useState<AddMode>('cursor');
  const calendarHostRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<FC_Calendar | null>(null);
  const [view, setView] = useState<'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'multiMonthYear'>('dayGridMonth');

  // canonical state
  const [blackouts, setBlackouts] = useState<string[]>([]);
  const [holidays, setHolidays] = useState<HolidayRule[]>([]);
  const [recurringBlackouts, setRecurringBlackouts] = useState<string>('');
  const [minStayByWeekday, setMinStayByWeekday] = useState<Record<string, number>>({});
  const [seasons, setSeasons] = useState<SeasonRule[]>([]);
  const [leadTime, setLeadTime] = useState<LeadTimeRule>({ minDays: 0, maxDays: 365 });

  const [rulesJson, setRulesJson] = useState<string>('[]');

  // form
  const { register, handleSubmit, setValue, reset } = useForm<CalendarFormData>({
    defaultValues: {
      name: '',
      owner: 'Cypress Resorts',
      type: 'hotel',
      currency: 'USD',
      cancellationPolicy: { hours: 48, fee: 100 },
      versionMode: 'version',
      blackouts: [],
      recurringBlackouts: '',
      holidays: [],
      minStayByWeekday: {},
      seasons: [],
      leadTime: { minDays: 0, maxDays: 365 },
      rules: []
    }
  });

  // sync form values
  useEffect(() => { setValue('blackouts', blackouts) }, [blackouts, setValue]);
  useEffect(() => { setValue('holidays', holidays) }, [holidays, setValue]);
  useEffect(() => { setValue('recurringBlackouts', recurringBlackouts) }, [recurringBlackouts, setValue]);
  useEffect(() => { setValue('minStayByWeekday', minStayByWeekday) }, [minStayByWeekday, setValue]);
  useEffect(() => { setValue('seasons', seasons) }, [seasons, setValue]);
  useEffect(() => { setValue('leadTime', leadTime) }, [leadTime, setValue]);

  // hydrate if JSON pasted
  useEffect(() => {
    try {
      const parsed = JSON.parse(rulesJson);
      if (Array.isArray(parsed?.blackouts)) setBlackouts(parsed.blackouts.filter(isIsoDate));
      if (Array.isArray(parsed?.holidays)) setHolidays(parsed.holidays);
      if (parsed?.recurringBlackouts) setRecurringBlackouts(parsed.recurringBlackouts);
      if (parsed?.minStayByWeekday) setMinStayByWeekday(parsed.minStayByWeekday);
      if (parsed?.seasons) setSeasons(parsed.seasons);
      if (parsed?.leadTime) setLeadTime(parsed.leadTime);
    } catch {}
  }, [rulesJson]);

  // build events
  const events: EventInput[] = useMemo(() => {
    const blackoutEvents = blackouts.map((iso) => ({
      id: `blackout-${iso}`, start: iso, allDay: true, display: 'background',
      color: '#5b5b5b55', title: 'Blackout'
    }));
    const holidayEvents = holidays.map((h) => ({
      id: `holiday-${h.date}`, start: h.date, allDay: true,
      title: `Holiday (min ${h.minNights})`, color: '#f59e0b'
    }));
    const rruleEvent = recurringBlackouts ? [{
      id: 'recurring-blackout',
      rrule: recurringBlackouts, duration: { days: 1 },
      display: 'background', color: '#3f3f3f55', title: 'Recurring Blackout'
    }] : [];
    return [...blackoutEvents, ...holidayEvents, ...rruleEvent];
  }, [blackouts, holidays, recurringBlackouts]);

  // init calendar when wizard tab active
  useEffect(() => {
    if (activeTab !== 'wizard') return;
    if (!calendarHostRef.current) return;
    if (!calendarRef.current) {
      calendarRef.current = new FC_Calendar(calendarHostRef.current, {
        plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin, rrulePlugin, multiMonthPlugin],
        initialView: view,
        height: 'auto',
        headerToolbar: { left: 'prev,next today', center: 'title', right: '' },
        selectable: true,
        events,
        select: (info) => {
          const start = toISODate(info.start);
          const end = toISODate(new Date(info.end.getTime() - 86400000));
          if (!start || !end) return;
          if (addMode === 'blackout') {
            setBlackouts((p) => unique([...p, ...expandDateRange(start, end)]));
          } else if (addMode === 'holiday') {
            setHolidays((p) => [...p, ...expandDateRange(start, end).map((d) => ({ date: d, minNights: 1 }))]);
          }
        },
        dateClick: (info) => {
          const iso = toISODate(info.date); if (!iso) return;
          if (addMode === 'blackout') setBlackouts((p) => unique([...p, iso]));
          if (addMode === 'holiday') setHolidays((p) => [...p, { date: iso, minNights: 1 }]);
        },
        eventClick: (info) => {
          if (info.event.id?.startsWith('blackout-')) {
            setBlackouts((p) => p.filter((d) => d !== info.event.id.replace('blackout-', '')));
          } else if (info.event.id?.startsWith('holiday-')) {
            setHolidays((p) => p.filter((h) => h.date !== info.event.id.replace('holiday-', '')));
          } else if (info.event.id === 'recurring-blackout') {
            setRecurringBlackouts('');
          }
        }
      });
      calendarRef.current.render();
    } else {
      calendarRef.current.setOption('events', events);
      if (calendarRef.current.view.type !== view) calendarRef.current.changeView(view);
    }
  }, [activeTab, events, view, addMode]);

  // RRULE builder
  const [rrWeekdays, setRrWeekdays] = useState<Weekday[]>([]);
  const [rrStart, setRrStart] = useState<string>('');
  const buildRRULE = () => {
    try {
      const opts: Partial<Options> = { freq: RRule.WEEKLY };
      if (rrWeekdays.length) opts.byweekday = rrWeekdays;
      if (rrStart && isIsoDate(rrStart)) opts.dtstart = new Date(rrStart);
      const rule = new RRule(opts);
      setRecurringBlackouts(rule.toString());
    } catch (e) { console.error(e); }
  };

  // chips
  const summaryChips = useMemo(() => {
    const chips: string[] = [];
    if (blackouts.length) chips.push(`${blackouts.length} blackout days`);
    if (holidays.length) chips.push(`${holidays.length} holidays`);
    if (recurringBlackouts) chips.push('recurring blackout');
    if (Object.keys(minStayByWeekday).length) chips.push('weekday min stay rules');
    if (seasons.length) chips.push(`${seasons.length} seasonal bands`);
    if (leadTime.minDays || leadTime.maxDays < 365) chips.push('lead-time restriction');
    return chips.map((c, i) => <Badge key={i} variant="secondary">{c}</Badge>);
  }, [blackouts, holidays, recurringBlackouts, minStayByWeekday, seasons, leadTime]);

  const onSubmit = async (data: CalendarFormData) => {
    let extraRules: any[] = [];
    try { extraRules = JSON.parse(rulesJson) } catch {}
    const payload: CalendarFormData = {
      ...data, blackouts, holidays, recurringBlackouts,
      minStayByWeekday, seasons, leadTime, rules: extraRules
    };
    try {
      await createCalendarAction(payload);
      setOpen(false); reset();
      setBlackouts([]); setHolidays([]); setRecurringBlackouts('');
      setMinStayByWeekday({}); setSeasons([]); setLeadTime({ minDays: 0, maxDays: 365 });
      setRulesJson('[]'); router.refresh();
    } catch (err: any) {
      alert('Error creating calendar: ' + err.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><CalendarIcon className="mr-2 h-4 w-4" /> Create Calendar</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[1000px] max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Create New Calendar</DialogTitle></DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="wizard" className="flex-1">Wizard</TabsTrigger>
            <TabsTrigger value="form" className="flex-1">Form</TabsTrigger>
          </TabsList>

          {/* WIZARD */}
          <TabsContent value="wizard" className="mt-3 space-y-4">
            {/* top controls */}
            <div className="flex flex-wrap items-center gap-2">
              <Select value={view} onValueChange={(v) => setView(v as any)}>
                <SelectTrigger className="w-[200px] h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dayGridMonth">Month</SelectItem>
                  <SelectItem value="timeGridWeek">Week</SelectItem>
                  <SelectItem value="timeGridDay">Day</SelectItem>
                  <SelectItem value="multiMonthYear">Year</SelectItem>
                </SelectContent>
              </Select>
              <Button variant={addMode==='cursor'?'default':'outline'} className="h-8" onClick={()=>setAddMode('cursor')}><Eye className="h-4 w-4 mr-2"/>Cursor</Button>
              <Button variant={addMode==='blackout'?'default':'outline'} className="h-8" onClick={()=>setAddMode(addMode==='blackout'?'cursor':'blackout')}><X className="h-4 w-4 mr-2"/>Blackout</Button>
              <Button variant={addMode==='holiday'?'default':'outline'} className="h-8" onClick={()=>setAddMode(addMode==='holiday'?'cursor':'holiday')}><Wand2 className="h-4 w-4 mr-2"/>Holiday</Button>
              <div className="ml-auto"><Button variant="outline" size="sm" onClick={()=>{setBlackouts([]);setHolidays([]);setRecurringBlackouts('')}}>Clear All</Button></div>
            </div>

            <div ref={calendarHostRef} className="border rounded-md p-2 bg-background"/>

            {/* rules panels */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* blackouts */}
              <div><Label>Blackouts</Label>
                <ul className="mt-1 space-y-1 text-sm max-h-[150px] overflow-y-auto">
                  {blackouts.map((d)=>(
                    <li key={d} className="flex justify-between">{d}
                      <Button variant="ghost" size="icon" onClick={()=>setBlackouts(p=>p.filter(x=>x!==d))}><TrashIcon className="h-4 w-4"/></Button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* holidays */}
              <div><Label>Holidays</Label>
                <ul className="mt-1 space-y-1 text-sm max-h-[150px] overflow-y-auto">
                  {holidays.map((h)=>(
                    <li key={h.date} className="flex justify-between">{h.date} (min {h.minNights})
                      <Input type="number" value={h.minNights} onChange={(e)=>setHolidays(prev=>prev.map(x=>x.date===h.date?{...x,minNights:+e.target.value||1}:x))} className="w-16 h-6 text-xs"/>
                    </li>
                  ))}
                </ul>
              </div>

              {/* recurring blackout builder */}
              <div><Label>Recurring Blackouts (RRULE)</Label>
                <Input value={recurringBlackouts} onChange={e=>setRecurringBlackouts(e.target.value)} placeholder="FREQ=WEEKLY;BYDAY=SU" className="h-9"/>
                <div className="mt-2 space-y-2">
                  <div className="flex flex-wrap gap-1">{weekdayChoice.map((w)=>(
                    <Button key={w.label} variant={rrWeekdays.includes(w.value)?'default':'outline'} size="sm" className="h-7 px-2"
                      onClick={()=>setRrWeekdays(prev=>prev.includes(w.value)?prev.filter(x=>x!==w.value):[...prev,w.value])}>{w.label}</Button>
                  ))}</div>
                  <div className="flex gap-2"><Input placeholder="Start yyyy-mm-dd" value={rrStart} onChange={e=>setRrStart(e.target.value)} className="h-8"/><Button onClick={buildRRULE}>Build</Button></div>
                </div>
              </div>
            </div>

            {/* extra quick-actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div><Label>Minimum Stay by Weekday</Label>
                <div className="flex flex-wrap gap-2 mt-1">{weekdayChoice.map((w)=>(
                  <div key={w.label} className="flex items-center gap-1">
                    <span className="text-xs w-6">{w.label}</span>
                    <Input type="number" value={minStayByWeekday[w.label]||1} onChange={(e)=>setMinStayByWeekday(p=>({...p,[w.label]:+e.target.value||1}))} className="w-14 h-7 text-xs"/>
                  </div>
                ))}</div>
              </div>
              <div><Label>Seasonal Price Bands</Label>
                <ul className="space-y-1 text-sm">{seasons.map((s,i)=>(
                  <li key={i} className="flex gap-1 items-center">{s.start}→{s.end}
                    <Input type="number" value={s.price} onChange={e=>setSeasons(prev=>prev.map((x,j)=>j===i?{...x,price:+e.target.value||0}:x))} className="w-20 h-7 text-xs"/>
                    <Button variant="ghost" size="icon" onClick={()=>setSeasons(prev=>prev.filter((_,j)=>j!==i))}><TrashIcon className="h-4 w-4"/></Button>
                  </li>
                ))}</ul>
                <Button size="sm" className="mt-1" onClick={()=>setSeasons(prev=>[...prev,{start:toISODate(new Date())!,end:toISODate(new Date())!,price:100}])}>+ Add Season</Button>
              </div>
              <div><Label>Lead-Time Restrictions</Label>
                <div className="flex gap-2 mt-1">
                  <Input type="number" value={leadTime.minDays} onChange={e=>setLeadTime({...leadTime,minDays:+e.target.value||0})} placeholder="Min days" className="w-20 h-7 text-xs"/>
                  <Input type="number" value={leadTime.maxDays} onChange={e=>setLeadTime({...leadTime,maxDays:+e.target.value||0})} placeholder="Max days" className="w-20 h-7 text-xs"/>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* FORM */}
          <TabsContent value="form" className="mt-3 space-y-3">
            <div className="flex flex-wrap gap-2">{summaryChips}</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2 grid grid-cols-3 gap-2">
                <Input {...register('name',{required:true})} placeholder="Name" className="col-span-2 h-8"/>
                <Select defaultValue="hotel" onValueChange={(v)=>setValue('type',v as CalendarType)}>
                  <SelectTrigger className="h-8"><SelectValue/></SelectTrigger>
                  <SelectContent><SelectItem value="hotel">Hotel</SelectItem><SelectItem value="appointment">Appointment</SelectItem></SelectContent>
                </Select>
                <Input {...register('owner')} placeholder="Owner" className="h-8"/>
                <Input {...register('currency')} placeholder="Currency" className="h-8"/>
                <Input type="number" {...register('cancellationPolicy.hours',{valueAsNumber:true})} placeholder="Cancel Hours" className="h-8"/>
                <Input type="number" {...register('cancellationPolicy.fee',{valueAsNumber:true})} placeholder="Cancel Fee" className="h-8"/>
                <Select defaultValue="version" onValueChange={(v)=>setValue('versionMode',v as VersionMode)}>
                  <SelectTrigger className="h-8"><SelectValue/></SelectTrigger>
                  <SelectContent><SelectItem value="version">Version</SelectItem><SelectItem value="overwrite">Overwrite</SelectItem><SelectItem value="cancel">Cancel</SelectItem></SelectContent>
                </Select>
              </div>
              <div>
                <Label>Engine Rules (JSON)</Label>
                <Textarea value={rulesJson} onChange={e=>setRulesJson(e.target.value)} rows={10}/>
                <pre className="mt-1 text-xs bg-muted p-2 max-h-[150px] overflow-auto">{JSON.stringify({blackouts,holidays,recurringBlackouts,minStayByWeekday,seasons,leadTime},null,2)}</pre>
              </div>
            </div>
            <div className="flex justify-end"><Button onClick={handleSubmit(onSubmit)}>Create Calendar</Button></div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
