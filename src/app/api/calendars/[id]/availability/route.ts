import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Calendar from '@/models/Calendar';
import { buildAvailabilityGrid } from '@/lib/utils';
import { format } from 'date-fns';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const {id} = await params
  await dbConnect();
  const calendar = await Calendar.findById(id);
  if (!calendar) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());

  const availableDates = buildAvailabilityGrid(calendar, year);
  return NextResponse.json({ available: availableDates.map(d => format(d, 'yyyy-MM-dd')) });
}