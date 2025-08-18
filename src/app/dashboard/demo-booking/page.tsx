"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/DateRangePicker';
import { format } from 'date-fns';

export default function DemoBooking() {
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [result, setResult] = useState('');

  const handleBook = async () => {
    if (!dateRange.from || !dateRange.to) {
      setResult('Please select a date range');
      return;
    }
    const start = format(dateRange.from, 'yyyy-MM-dd');
    const end = format(dateRange.to, 'yyyy-MM-dd');
    const res = await fetch('/api/calendars/demo-id/bookings', { // Replace with real calendar ID
      method: 'POST',
      body: JSON.stringify({ start, end }),
    });
    const data = await res.json();
    setResult(JSON.stringify(data));
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl mb-4">Demo Booking for Cypress Resorts</h2>
      <DateRangePicker value={dateRange} onChange={setDateRange} />
      <Button className="mt-4" onClick={handleBook}>Book Reservation</Button>
      <p className="mt-4">Result: {result}</p>
    </div>
  );
}