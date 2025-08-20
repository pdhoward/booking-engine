import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Calendar from '@/models/Calendar';
import { evaluateBooking } from '@/lib/rulesEngine';
// Note: You'd need a Booking model for persistence, but for demo, just evaluate

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const {id} = await params
  await dbConnect();
  const data = await req.json(); // { start: 'yyyy-mm-dd', end: 'yyyy-mm-dd', ... }
  const calendar = await Calendar.findById(id);
  if (!calendar) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    await evaluateBooking(data, calendar);
    // Here: Create booking in DB, but for now, simulate
    return NextResponse.json({ success: true, bookingId: 'demo-' + Date.now() });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}